/* match.js */
import { db } from "../firebase.js"; 

document.addEventListener("DOMContentLoaded", () => {
    const matchId = window.location.hash.substring(1);
    if (!matchId) {
        alert("경기 정보가 없습니다.");
        return;
    }
    loadMatchData(matchId);
});

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
        'before': '경기전', 'win': '경기 종료', 'loss': '경기 종료', 'draw': '경기 종료', 
        'rain_cancel': '우천 취소', 'etc_cancel': '기타 취소', 'rain_suspend': '서스펜디드'
    };
    
    document.querySelector('.match-status').textContent = statusMap[data.status] || data.status;
    document.querySelector('.tournament-title').textContent = data.title;
    
   // ⭐ [수정] 날짜 포맷 변경 (yyyy-mm-dd -> yyyy년 mm월 dd일)
    const [year, month, day] = data.date.split('-'); 
    const formattedDate = `${year}년 ${month}월 ${day}일`;

    document.querySelector('.match-meta').textContent = `${formattedDate} | ${data.location}`;


    // --- 2. 스코어보드 ---
    let topTeam = {}; 
    let btmTeam = {}; 

    if (data.homeAway === 'home') {
        // 우리가 홈 (말공격)
        topTeam = { 
            name: data.opponent, 
            runs: data['away-score'] || [], 
            r: data['away-run'], h: data['away-hit'], e: data['away-error'], b: data['away-ball']
        };
        btmTeam = { 
            name: "청운대학교", 
            runs: data['home-score'] || [], 
            r: data['home-run'], h: data['home-hit'], e: data['home-error'] , b: data['home-ball']
        };
    } else {
        // 우리가 어웨이 (초공격)
        topTeam = { 
            name: "청운대학교", 
            runs: data['away-score'] || [], 
            r: data['away-run'], h: data['away-hit'], e: data['away-error'] , b: data['away-ball']
        };
        btmTeam = { 
            name: data.opponent, 
            runs: data['home-score'] || [], 
            r: data['home-run'], h: data['home-hit'], e: data['home-error'] , b: data['home-ball']
        };
    }

    // 메인 스코어보드
    const sbMain = document.querySelector('.scoreboard-main');
    sbMain.querySelector('.away .team-name').textContent = topTeam.name;
    sbMain.querySelector('.home .team-name').textContent = btmTeam.name;
    sbMain.querySelector('.away-score').textContent = topTeam.r || 0;
    sbMain.querySelector('.home-score').textContent = btmTeam.r || 0;

    // 경기 결과 뱃지
    const resLabel = document.querySelector('.match-result-label');
    const status = data.status;

    if (['win', 'loss', 'draw'].includes(status)) {
        resLabel.style.display = 'block';
        if (status === 'win') {
            resLabel.textContent = 'WIN';
            resLabel.className = 'match-result-label res-win';
        } else if (status === 'loss') {
            resLabel.textContent = 'LOSE';
            resLabel.className = 'match-result-label res-loss';
        } else if (status === 'draw') {
            resLabel.textContent = 'DRAW';
            resLabel.className = 'match-result-label res-draw';
        }
    } else {
        resLabel.style.display = 'none';
    }


    // 상세 스코어 테이블
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
            // ⭐ [수정] "배번.이름" -> "이름"만 추출
            let winP = data['winning-pitcher'];
            if (winP.includes('.')) {
                winP = winP.split('.')[1].trim(); 
            }

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
            // ⭐ [수정] OUT 선수 표시 로직 (배번이 있는지 확인)
            let outPlayerDisplay = parts[4];
            
            // 만약 OUT 선수가 "17.나예준" 처럼 저장되어 있다면 -> "나예준 (17)"로 변환
            if (outPlayerDisplay && outPlayerDisplay.includes('.')) {
                const [num, name] = outPlayerDisplay.split('.');
                outPlayerDisplay = `${name} (${num})`;
            }

            tr.innerHTML = `
                <td class="inn-col">${parts[0]}회</td>
                <td class="name-col">${parts[1]} (${parts[2]})</td>
                <td class="change-type-col">${parts[3]}</td>
                <td class="change-out-col">${outPlayerDisplay}</td>
            `;
        }
        tbody.appendChild(tr);
    });
}