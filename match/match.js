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
        'before': '경기전','end': '경기 종료', 'win': '경기 종료', 'loss': '경기 종료', 'draw': '경기 종료', 
        'rain_cancel': '우천 취소', 'etc_cancel': '기타 취소', 'rain_suspend': '서스펜디드', 'no_record': '기록 없음'
    };
    
    document.querySelector('.match-status').textContent = statusMap[data.status] || data.status;
    document.querySelector('.tournament-title').textContent = data.title;

    const [year, month, day] = data.date.split('-'); 
    const formattedDate = `${year}년 ${month}월 ${day}일`;
    document.querySelector('.match-meta').textContent = `${formattedDate} | ${data.location}`;

    // --- 2. 스코어보드 ---
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

    const isAllZeros = (arr) => arr.length > 0 && arr.every(val => val === "0" || val === 0 || val === "");

    if (isSpecialStatus) {
        homeScoreArr = []; awayScoreArr = [];
        homeR = '-'; awayR = '-'; homeH = '-'; awayH = '-';
        homeE = '-'; awayE = '-'; homeB = '-'; awayB = '-';
    } else {
        if (isAllZeros(homeScoreArr) && isAllZeros(awayScoreArr)) {
            homeScoreArr = []; awayScoreArr = [];
        } else {
            let lastPlayed = 8; 
            for (let i = 11; i >= 9; i--) {
                const hVal = String(homeScoreArr[i] || "0").trim();
                const aVal = String(awayScoreArr[i] || "0").trim();
                if ((hVal !== "0" && hVal !== "") || (aVal !== "0" && aVal !== "")) {
                    lastPlayed = Math.max(lastPlayed, i);
                }
            }
            for (let i = 0; i < 12; i++) {
                if (i > lastPlayed) {
                    homeScoreArr[i] = '-'; awayScoreArr[i] = '-';
                } else {
                    if (homeScoreArr[i] === "" || homeScoreArr[i] === undefined) homeScoreArr[i] = "0";
                    if (awayScoreArr[i] === "" || awayScoreArr[i] === undefined) awayScoreArr[i] = "0";
                }
            }
        }
    }

    let topTeam = {}; let btmTeam = {}; 
    if (data.homeAway === 'home') {
        topTeam = { name: data.opponent, runs: awayScoreArr, r: awayR, h: awayH, e: awayE, b: awayB };
        btmTeam = { name: "청운대학교", runs: homeScoreArr, r: homeR, h: homeH, e: homeE , b: homeB };
    } else {
        topTeam = { name: "청운대학교", runs: awayScoreArr, r: awayR, h: awayH, e: awayE , b: awayB };
        btmTeam = { name: data.opponent, runs: homeScoreArr, r: homeR, h: homeH, e: homeE , b: homeB };
    }

    const sbMain = document.querySelector('.scoreboard-main');
    sbMain.querySelector('.away .team-name').textContent = topTeam.name;
    sbMain.querySelector('.home .team-name').textContent = btmTeam.name;
    sbMain.querySelector('.away-score').textContent = topTeam.r;
    sbMain.querySelector('.home-score').textContent = btmTeam.r;

    const resLabel = document.querySelector('.match-result-label');
    const status = data.status;

    if (['win', 'loss', 'draw'].includes(status)) {
        resLabel.style.display = 'block';
        if (status === 'win') {
            resLabel.textContent = 'WIN'; resLabel.className = 'match-result-label res-win';
        } else if (status === 'loss') {
            resLabel.textContent = 'LOSE'; resLabel.className = 'match-result-label res-loss';
        } else if (status === 'draw') {
            resLabel.textContent = 'DRAW'; resLabel.className = 'match-result-label res-draw';
        }
    } else {
        resLabel.style.display = 'none';
    }

    const tableBody = document.querySelector('.score-table tbody');
    const rows = tableBody.querySelectorAll('tr'); 
    if (rows.length >= 2) {
        fillScoreRow(rows[0], topTeam);
        fillScoreRow(rows[1], btmTeam);
    }

    // --- 3. 주요 기록 ---
    const statsContainer = document.querySelector('.match-key-stats');
    statsContainer.innerHTML = ''; 

    if (data.status === 'win') {
        let contentHTML = '';
        let hasItem = false;

        if (data['winning-pitcher']) {
            let winP = data['winning-pitcher'];
            if (winP.includes('.')) winP = winP.split('.')[1].trim(); 

            contentHTML += `
                <div class="stat-item">
                    <span class="stat-label">승리투수</span>
                    <span class="stat-value">${winP}</span>
                </div>
            `;
            hasItem = true;
        }

        if (data['run-bat-in']) {
            if (hasItem) contentHTML += `<div class="stat-divider"></div>`;
            contentHTML += `
                <div class="stat-item">
                    <span class="stat-label">결승타</span>
                    <span class="stat-value">${data['run-bat-in']}</span>
                </div>
            `;
        }

        if (contentHTML) {
            statsContainer.innerHTML = contentHTML;
            statsContainer.style.display = 'flex';
        } else {
            statsContainer.style.display = 'none';
        }
    } else {
        statsContainer.style.display = 'none';
    }

    // --- 4. 라인업 ---
    renderTable('#start-line-up tbody', data['start-line-up'], 'starting');
    renderTable('#pitcher-line-up tbody', data['pitcher-line-up'], 'pitcher');
    renderTable('#bench-line-up tbody', data['bench-line-up'], 'bench');

    // ⭐ [추가] --- 4.5 이닝별 타임라인 (교체 기록 바탕) ---
    const timelineContainer = document.querySelector('.match-timeline-container');
    if (timelineContainer && data['bench-line-up'] && data['bench-line-up'].length > 0) {
        let timelineHTML = '<h3 class="section-title">이닝별 주요 상황</h3><div class="timeline-wrapper">';
        
        const groupedByInning = {};
        data['bench-line-up'].forEach(str => {
            const parts = str.split(',');
            const inn = parts[0];
            if (!groupedByInning[inn]) groupedByInning[inn] = [];
            
            let reasonText = parts[3] === 'pinch_hitter' ? '대타' : 
                             parts[3] === 'pinch_runner' ? '대주자' : 
                             parts[3] === 'pitcher_change' ? '투수 교체' : '수비 교체';
                             
            groupedByInning[inn].push(`
                <div class="timeline-event">
                    <span class="event-badge ${parts[3]}">${reasonText}</span>
                    <span class="event-text">
                        <b>${parts[5]}</b> OUT <i class="icon-arrow-right"></i> <b>${parts[2]}</b> IN
                    </span>
                </div>
            `);
        });

        Object.keys(groupedByInning).sort((a, b) => Number(a) - Number(b)).forEach(inn => {
            timelineHTML += `
                <div class="timeline-inning-block">
                    <div class="inning-badge">${inn}회</div>
                    <div class="inning-events">
                        ${groupedByInning[inn].join('')}
                    </div>
                </div>
            `;
        });

        timelineHTML += '</div>';
        timelineContainer.innerHTML = timelineHTML;
        timelineContainer.style.display = 'block';
    } else if (timelineContainer) {
        timelineContainer.style.display = 'none';
    }

    // ⭐ [추가] --- 4.6 선수별 기록 요약 ---
    const playerStatsContainer = document.querySelector('.player-stats-container');
    
    if (playerStatsContainer && (data['start-line-up'] || data['pitcher-line-up'])) {
        let statsHTML = '<h3 class="section-title">선수별 기록 요약</h3>';
        
        if (data['start-line-up'] && data['start-line-up'].length > 0) {
            statsHTML += `
                <h4 class="sub-title">타자 기록</h4>
                <div class="table-container">
                    <table class="stats-table">
                        <thead>
                            <tr>
                                <th>타순</th><th>이름</th><th>포지션</th><th>결과 요약</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            data['start-line-up'].forEach(str => {
                const parts = str.split(',');
                const summary = parts[5] || '<span class="text-gray">-</span>';
                statsHTML += `
                    <tr>
                        <td>${parts[0]}</td>
                        <td><b>${parts[2]}</b></td>
                        <td>${parts[3]}</td>
                        <td>${summary}</td>
                    </tr>
                `;
            });
            statsHTML += `</tbody></table></div>`;
        }

        if (data['pitcher-line-up'] && data['pitcher-line-up'].length > 0) {
            statsHTML += `
                <h4 class="sub-title" style="margin-top:20px;">투수 기록</h4>
                <div class="table-container">
                    <table class="stats-table">
                        <thead>
                            <tr>
                                <th>순서</th><th>이름</th><th>투구 이닝</th><th>결과</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            data['pitcher-line-up'].forEach(str => {
                const parts = str.split(',');
                const summary = parts[4] || ''; 
                let isWinPitcher = "";
                if (data['winning-pitcher'] && data['winning-pitcher'].includes(parts[2])) {
                    isWinPitcher = "<span class='badge-win' style='margin-right:5px;'>승리</span>";
                }

                statsHTML += `
                    <tr>
                        <td>${parts[0]}</td>
                        <td><b>${parts[2]}</b></td>
                        <td>${parts[3]}</td>
                        <td>${isWinPitcher}${summary}</td>
                    </tr>
                `;
            });
            statsHTML += `</tbody></table></div>`;
        }

        playerStatsContainer.innerHTML = statsHTML;
        playerStatsContainer.style.display = 'block';
    } else if (playerStatsContainer) {
        playerStatsContainer.style.display = 'none';
    }

    // --- 5. 사진 ---
    const photoSection = document.querySelector('.match-photos-container');
    const photoGallery = document.querySelector('.photo-gallery');
    
    if (data.photo && data.photo.length > 0) {
        photoGallery.innerHTML = ''; 
        data.photo.forEach(url => {
            const div = document.createElement('div');
            div.className = 'photo-item'; 
            div.innerHTML = `<img src="${url}" alt="경기 사진" loading="lazy">`;
            photoGallery.appendChild(div);
        });
        photoSection.style.display = 'block'; 
    } else {
        photoSection.style.display = 'none'; 
    }
}

// ---------------- Helper Functions ----------------

function fillScoreRow(tr, teamData) {
    tr.querySelector('.team-name-cell').textContent = teamData.name;
    const tds = tr.querySelectorAll('td');
    
    for (let i = 0; i < 12; i++) {
        const score = (teamData.runs && teamData.runs[i] !== undefined && teamData.runs[i] !== "") 
                      ? teamData.runs[i] : '-';
        if (tds[i + 1]) tds[i + 1].textContent = score;
    }

    const len = tds.length;
    // R, H, E, B
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
        const colSpan = (type === 'starting' || type === 'bench') ? 4 : 3;
        tbody.innerHTML = `<tr><td colspan="${colSpan}" style="padding:20px; color:#aaa; text-align:center;">등록된 정보가 없습니다.</td></tr>`;
        return;
    }

    dataArr.forEach(str => {
        const parts = str.split(','); 
        const tr = document.createElement('tr');

        if (type === 'starting') {
            tr.innerHTML = `
                <td>${parts[0]}</td>
                <td>${parts[2]} (${parts[1]})</td>
                <td>${parts[3]}</td>
                <td>${parts[4]}</td>
            `;
        } else if (type === 'pitcher') {
            tr.innerHTML = `
                <td>${parts[0]}</td>
                <td>${parts[2]} (${parts[1]})</td>
                <td>${parts[3]}</td>
            `;
        } else if (type === 'bench') {
            tr.innerHTML = `
                <td class="inn-col">${parts[0]}회</td>
                <td class="name-col">${parts[1]} (${parts[2]})</td>
                <td class="change-type-col">${parts[3]}</td>
                <td class="change-out-col">${parts[5]} (${parts[4]})</td>
            `;
        }
        tbody.appendChild(tr);
    });
}