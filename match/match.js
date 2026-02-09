/* match.js */
import { db } from "../firebase.js"; 

document.addEventListener("DOMContentLoaded", () => {
    // 1. URL의 #(해시)값으로 경기 ID 가져오기
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
        
        // 데이터가 있으면 UI 그리기 시작
        renderMatchUI(doc.data());

    } catch (error) {
        console.error("데이터 로딩 실패:", error);
    }
}

function renderMatchUI(data) {
    
    // --- 1. 헤더 정보 (대회명, 날짜, 장소) ---
    const statusMap = {
        'before': '경기전', 'win': '경기 종료', 'loss': '경기 종료', 'draw': '경기 종료', 
        'rain_cancel': '우천 취소', 'etc_cancel': '기타 취소', 'rain_suspend': '서스펜디드'
    };
    
    document.querySelector('.match-status').textContent = statusMap[data.status] || data.status;
    document.querySelector('.tournament-title').textContent = data.title;
    document.querySelector('.match-meta').textContent = `${data.date} | ${data.location}`;


    // --- 2. 스코어보드 (메인 & 테이블) ---
    
    let topTeam = {}; // 초 공격 (Scoreboard 윗줄)
    let btmTeam = {}; // 말 공격 (Scoreboard 아랫줄)

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
            r: data['away-run'], h: data['away-hit'], e: data['away-error'] , b: data['away-ball'] // ⭐ 수정됨
        };
        btmTeam = { 
            name: data.opponent, 
            runs: data['home-score'] || [], 
            r: data['home-run'], h: data['home-hit'], e: data['home-error'] , b: data['home-ball'] // ⭐ 수정됨
        };
    }

    // (1) 메인 스코어보드 (큰 글씨)
    const sbMain = document.querySelector('.scoreboard-main');
    sbMain.querySelector('.away .team-name').textContent = topTeam.name;
    sbMain.querySelector('.home .team-name').textContent = btmTeam.name;
    sbMain.querySelector('.away-score').textContent = topTeam.r || 0;
    sbMain.querySelector('.home-score').textContent = btmTeam.r || 0;

    // (2) 상세 스코어 테이블 (Table)
    const tableBody = document.querySelector('.score-table tbody');
    const rows = tableBody.querySelectorAll('tr'); 
    
    if (rows.length >= 2) {
        fillScoreRow(rows[0], topTeam);
        fillScoreRow(rows[1], btmTeam);
    }


    // --- 3. 주요 기록 (승리투수, 결승타) ---
    const statsContainer = document.querySelector('.match-key-stats');
    statsContainer.innerHTML = ''; 

    if (data.status === 'win') {
        let contentHTML = '';
        let hasItem = false;

        // 승리투수
        if (data['winning-pitcher']) {
            contentHTML += `
                <div class="stat-item">
                    <span class="stat-label">승리투수</span>
                    <span class="stat-value">${data['winning-pitcher']}</span>
                </div>
            `;
            hasItem = true;
        }

        // 결승타
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


    // --- 4. 라인업 테이블 (CSV 문자열 파싱) ---
    renderTable('#start-line-up tbody', data['start-line-up'], 'starting');
    renderTable('#pitcher-line-up tbody', data['pitcher-line-up'], 'pitcher');
    renderTable('#bench-line-up tbody', data['bench-line-up'], 'bench');


    // --- 5. 경기 사진 (Photo Gallery) ---
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

// ==========================================
// [Helper 함수들] UI 채우기 도우미
// ==========================================

// 스코어 테이블 한 줄 채우기
function fillScoreRow(tr, teamData) {
    // 팀 이름
    tr.querySelector('.team-name-cell').textContent = teamData.name;

    // 점수 칸들 (td 태그들)
    const tds = tr.querySelectorAll('td');
    
    // 1~12회 점수 채우기
    for (let i = 0; i < 12; i++) {
        const score = (teamData.runs && teamData.runs[i] !== undefined && teamData.runs[i] !== "") 
                      ? teamData.runs[i] : '-';
        if (tds[i + 1]) tds[i + 1].textContent = score;
    }

    // R, H, E, B 채우기 (마지막 4칸)
    const len = tds.length;
    // ⭐ [수정] cells -> tds 로 변수명 수정
    if (tds[len - 4]) tds[len - 4].textContent = teamData.r || 0; // R
    if (tds[len - 3]) tds[len - 3].textContent = teamData.h || 0; // H
    if (tds[len - 2]) tds[len - 2].textContent = teamData.e || 0; // E
    if (tds[len - 1]) tds[len - 1].textContent = teamData.b || 0; // B
}

// 라인업 테이블 렌더링
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
                <td class="change-out-col">${parts[4]}</td>
            `;
        }
        tbody.appendChild(tr);
    });
}