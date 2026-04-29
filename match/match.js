/* match.js */
import { db } from "../firebase/firebase.js";

let selectedMatchId = null;

document.addEventListener("DOMContentLoaded", () => {
    checkHashAndLoad();
    window.addEventListener('hashchange', checkHashAndLoad);
});

function checkHashAndLoad() {
    const matchId = decodeURIComponent(window.location.hash.substring(1));
    if (!matchId) {
        alert("경기 정보가 없습니다."); 
        return;
    }
    loadMatchData(matchId);
}

async function loadMatchData(docId) {
    try {
        const doc = await db.collection("match").doc(docId).get();
        if (!doc.exists) {
            alert("존재하지 않는 경기입니다.");
            return;
        }
        renderMatchUI(doc.data());
    } catch (error) {
        console.error("데이터 로딩 실패:", error);
    }
}

function renderMatchUI(data) {
    // --- 1. 헤더 정보 ---
    const statusMap = {
        'before': '경기전', 'end': '경기 종료', 'win': '경기 종료', 'loss': '경기 종료', 'draw': '경기 종료',
        'rain_cancel': '우천 취소', 'etc_cancel': '기타 취소', 'rain_suspend': '서스펜디드', 'no_record': '기록 없음'
    };

    document.querySelector('.match-status').textContent = statusMap[data.status] || data.status;
    document.querySelector('.tournament-title').textContent = data.title;

    const [year, month, day] = data.date.split('-');
    const formattedDate = `${year}년 ${month}월 ${day}일`;
    document.querySelector('.match-meta').textContent = `${formattedDate} | ${data.location}`;

    // --- 2. 스코어보드 데이터 준비 ---
    const specialStatuses = ['no_record', 'rain_cancel', 'etc_cancel', 'rain_suspend', 'before'];
    const isSpecialStatus = specialStatuses.includes(data.status);

    let homeScoreArr = Array.isArray(data['home-score']) ? [...data['home-score']] : [];
    let awayScoreArr = Array.isArray(data['away-score']) ? [...data['away-score']] : [];
    let homeR = data['home-run'] || 0;
    let awayR = data['away-run'] || 0;
    let homeH = data['home-hit'] || 0;
    let awayH = data['away-hit'] || 0;
    let homeE = data['home-error'] || 0;
    let awayE = data['away-error'] || 0;
    let homeB = data['home-ball'] || 0;
    let awayB = data['away-ball'] || 0;

    // 표시할 이닝 수 결정 (기본 9회)
    let displayInnings = 9;

    if (!isSpecialStatus) {
        // 스코어보드 10~12회에 점수가 있는지 확인
        for (let i = 9; i < 12; i++) {
            const hVal = String(homeScoreArr[i] || "0").trim();
            const aVal = String(awayScoreArr[i] || "0").trim();
            if ((hVal !== "0" && hVal !== "") || (aVal !== "0" && aVal !== "")) {
                displayInnings = Math.max(displayInnings, i + 1);
            }
        }
        // 타자 상세 기록 10~12회에 결과가 있는지 확인
        if (data['start-line-up']) {
            data['start-line-up'].forEach(str => {
                const parts = str.split(',');
                const innResults = (parts[5] || "").split('|');
                for (let i = 9; i < 12; i++) {
                    if (innResults[i] && innResults[i].trim() !== "") {
                        displayInnings = Math.max(displayInnings, i + 1);
                    }
                }
            });
        }
    }

    let topTeam = {}; let btmTeam = {};
    if (data.homeAway === 'home') {
        topTeam = { name: data.opponent, runs: awayScoreArr, r: awayR, h: awayH, e: awayE, b: awayB };
        btmTeam = { name: "청운대학교", runs: homeScoreArr, r: homeR, h: homeH, e: homeE, b: homeB };
    } else {
        topTeam = { name: "청운대학교", runs: awayScoreArr, r: awayR, h: awayH, e: awayE, b: awayB };
        btmTeam = { name: data.opponent, runs: homeScoreArr, r: homeR, h: homeH, e: homeE, b: homeB };
    }

    const sbMain = document.querySelector('.scoreboard-main');
    sbMain.querySelector('.away .team-name').textContent = topTeam.name;
    sbMain.querySelector('.home .team-name').textContent = btmTeam.name;
    sbMain.querySelector('.away-score').textContent = topTeam.r;
    sbMain.querySelector('.home-score').textContent = btmTeam.r;

    // ⭐ 스코어보드 헤더 제어 (표 깨짐 방지를 위해 CSS display만 변경)
    const scoreHeaderTr = document.querySelector('.score-table thead tr');
    if (scoreHeaderTr) {
        const ths = scoreHeaderTr.querySelectorAll('th');
        // ths[0]은 'TEAM' 자리이므로 i+1부터 12회까지 제어
        for (let i = 0; i < 12; i++) {
            const targetTh = ths[i + 1];
            if (targetTh) {
                if (i < displayInnings) {
                    targetTh.style.display = ''; // 보여줌
                } else {
                    targetTh.style.display = 'none'; // 숨김
                }
            }
        }
    }

    const resLabel = document.querySelector('.match-result-label');
    if (['win', 'loss', 'draw'].includes(data.status)) {
        resLabel.style.display = 'block';
        resLabel.textContent = data.status.toUpperCase();
        resLabel.className = `match-result-label res-${data.status}`;
    } else {
        resLabel.style.display = 'none';
    }

    // 스코어보드 값 채우기
    const tableBody = document.querySelector('.score-table tbody');
    const rows = tableBody.querySelectorAll('tr');
    if (rows.length >= 2) {
        fillScoreRow(rows[0], topTeam, displayInnings);
        fillScoreRow(rows[1], btmTeam, displayInnings);
    }

    // --- 3. 주요 기록 ---
    const statsContainer = document.querySelector('.match-key-stats');
    statsContainer.innerHTML = '';
    if (data.status === 'win') {
        let contentHTML = '';
        if (data['winning-pitcher']) {
            contentHTML += `<div class="stat-item"><span class="stat-label">승리투수</span><span class="stat-value">${data['winning-pitcher'].split('.').pop()}</span></div>`;
        }
        if (data['run-bat-in']) {
            if (contentHTML) contentHTML += `<div class="stat-divider"></div>`;
            contentHTML += `<div class="stat-item"><span class="stat-label">결승타</span><span class="stat-value">${data['run-bat-in']}</span></div>`;
        }
        if (contentHTML) {
            statsContainer.innerHTML = contentHTML;
            statsContainer.style.display = 'flex';
        }
    } else {
        statsContainer.style.display = 'none';
    }

    // --- 4. 교체 명단 ---
    renderTable('#bench-line-up tbody', data['bench-line-up'], 'bench');

    // --- 4.5 이닝별 타임라인 ---
    const timelineContainer = document.querySelector('.match-timeline-container');
    if (timelineContainer && data['bench-line-up'] && data['bench-line-up'].length > 0) {
        let timelineHTML = '<h3 class="section-title">이닝별 주요 상황</h3><div class="timeline-wrapper">';
        const groupedByInning = {};
        data['bench-line-up'].forEach(str => {
            const parts = str.split(',');
            if (!groupedByInning[parts[0]]) groupedByInning[parts[0]] = [];
            let reasonText = parts[3] === 'pinch_hitter' ? '대타' : parts[3] === 'pinch_runner' ? '대주자' : parts[3] === 'pitcher_change' ? '투수 교체' : '수비 교체';
            groupedByInning[parts[0]].push(`<div class="timeline-event"><span class="event-badge ${parts[3]}">${reasonText}</span><span class="event-text"><b>${parts[5]}</b> OUT <i class="icon-arrow-right"></i> <b>${parts[2]}</b> IN</span></div>`);
        });
        Object.keys(groupedByInning).sort((a, b) => a - b).forEach(inn => {
            timelineHTML += `<div class="timeline-inning-block"><div class="inning-badge">${inn}회</div><div class="inning-events">${groupedByInning[inn].join('')}</div></div>`;
        });
        timelineContainer.innerHTML = timelineHTML + '</div>';
        timelineContainer.style.display = 'block';
    } else if (timelineContainer) {
        timelineContainer.style.display = 'none';
    }

    // --- 4.6 선수별 기록 요약 ---
    const playerStatsContainer = document.querySelector('.player-stats-container');
    if (playerStatsContainer && (data['start-line-up'] || data['pitcher-line-up'])) {
        let statsHTML = '<h3 class="section-title">선수별 기록 요약</h3>';

        if (data['start-line-up'] && data['start-line-up'].length > 0) {
            statsHTML += `
                <h4 class="sub-title">타석 상세 결과</h4>
                <div class="table-container" style="overflow-x: auto;">
                    <table class="stats-table" style="min-width: 800px;">
                        <thead>
                            <tr>
                                <th>타순</th><th>이름</th><th>포지션</th>
                                ${Array.from({ length: displayInnings }, (_, i) => `<th>${i + 1}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
            `;
            data['start-line-up'].forEach(str => {
                const parts = str.split(',');
                const innResults = (parts[5] || "").split('|');
                const cells = Array.from({ length: displayInnings }, (_, i) => `<td>${innResults[i] || '-'}</td>`).join('');
                statsHTML += `<tr><td>${parts[0]}</td><td><b>${parts[2]}</b></td><td>${parts[3]}</td>${cells}</tr>`;
            });
            statsHTML += `</tbody></table></div>`;
        }

        if (data['pitcher-line-up'] && data['pitcher-line-up'].length > 0) {
            statsHTML += `
                <h4 class="sub-title" style="margin-top:20px;">투수 상세 기록</h4>
                <div class="table-container" style="overflow-x: auto;">
                    <table class="stats-table" style="min-width: 800px;">
                        <thead>
                            <tr>
                                <th>순서</th><th>이름</th><th>이닝</th><th>H</th><th>BB</th><th>K</th><th>R</th><th>ER</th><th>비고</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            data['pitcher-line-up'].forEach(str => {
                const p = str.split(',');
                let winBadge = (data['winning-pitcher'] && data['winning-pitcher'].includes(p[2])) ? "<span class='badge-win'>승</span> " : "";
                statsHTML += `<tr><td>${p[0]}</td><td><b>${winBadge}${p[2]}</b></td><td>${p[3] || '0'}</td><td>${p[4] || '0'}</td><td>${p[5] || '0'}</td><td>${p[6] || '0'}</td><td>${p[7] || '0'}</td><td>${p[8] || '0'}</td><td class="text-gray">${p[9] || '-'}</td></tr>`;
            });
            statsHTML += `</tbody></table></div>`;
        }
        playerStatsContainer.innerHTML = statsHTML;
        playerStatsContainer.style.display = 'block';
    } else if (playerStatsContainer) {
        playerStatsContainer.style.display = 'none';
    }

    // --- 5. 경기 사진 ---
    const photoSection = document.querySelector('.match-photos-container');
    const photoGallery = document.querySelector('.photo-gallery');
    if (data.photo && data.photo.length > 0) {
        photoGallery.innerHTML = data.photo.map(url => `<div class="photo-item"><img src="${url}" alt="경기 사진" loading="lazy"></div>`).join('');
        photoSection.style.display = 'block';
    } else {
        photoSection.style.display = 'none';
    }
}

// --- 유틸 함수들 ---

// ⭐ 스코어 행 값 채우기 (팀 이름과 점수를 정확히 매칭)
function fillScoreRow(tr, teamData, displayInnings) {
    const tds = tr.querySelectorAll('td');
    
    // 1. 첫 번째 칸은 팀 이름 고정
    if (tds[0]) {
        tds[0].textContent = teamData.name;
    }
    
    // 2. 1회~12회 점수는 tds[1]~tds[12]에 매칭
    for (let i = 0; i < 12; i++) {
        const targetTd = tds[i + 1];
        if (targetTd) {
            if (i < displayInnings) {
                targetTd.textContent = teamData.runs[i] || '0';
                targetTd.style.display = ''; // 보이기
            } else {
                targetTd.style.display = 'none'; // 연장전 아니면 숨기기
            }
        }
    }
    
    // 3. R, H, E, B 값 채우기 (마지막 4칸)
    const len = tds.length;
    if (tds[len - 4]) tds[len - 4].textContent = teamData.r || 0;
    if (tds[len - 3]) tds[len - 3].textContent = teamData.h || 0;
    if (tds[len - 2]) tds[len - 2].textContent = teamData.e || 0;
    if (tds[len - 1]) tds[len - 1].textContent = teamData.b || 0;
}

function renderTable(selector, dataArr, type) {
    const tbody = document.querySelector(selector);
    if (!tbody) return;
    tbody.innerHTML = ''; 
    if (!dataArr || dataArr.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="padding:20px; color:#aaa; text-align:center;">등록된 정보가 없습니다.</td></tr>`;
        return;
    }
    if (type === 'bench') {
        dataArr.forEach(str => {
            const parts = str.split(',');
            let reasonText = parts[3] === 'pinch_hitter' ? '대타' : parts[3] === 'pinch_runner' ? '대주자' : parts[3] === 'pitcher_change' ? '투수교체' : '수비교체';
            const tr = document.createElement('tr');
            tr.innerHTML = `<td class="inn-col">${parts[0]}회</td><td class="name-col">${parts[2]} (${parts[1]})</td><td class="change-type-col">${reasonText}</td><td class="change-out-col">${parts[5]} (${parts[4]})</td>`;
            tbody.appendChild(tr);
        });
    }
}