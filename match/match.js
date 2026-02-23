/* match.js */
import { db } from "../firebase/firebase.js";

let selectedMatchId = null;

document.addEventListener("DOMContentLoaded", () => {
   // 1. 페이지 처음 열릴 때 확인
    checkHashAndLoad();

    // 2. ⭐ [핵심 수정] 해시(#ID)가 변경될 때마다 실행 (뒤로가기, 링크 이동 등)
    window.addEventListener('hashchange', checkHashAndLoad);
});

// 해시값을 읽어서 경기 데이터를 불러오는 함수
function checkHashAndLoad() {
    // URL에서 # 제거하고 ID만 가져옴
    const matchId = decodeURIComponent(window.location.hash.substring(1));
    
    if (!matchId) {
        // ID가 없으면 경고 없이 종료하거나, 목록 페이지로 리다이렉트 처리 가능
        alert("경기 정보가 없습니다."); 
        return;
    }
    
    // 데이터 로드 시작
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

   // ⭐ [수정] 날짜 포맷 변경 (yyyy-mm-dd -> yyyy년 mm월 dd일)
    const [year, month, day] = data.date.split('-'); 
    const formattedDate = `${year}년 ${month}월 ${day}일`;

    document.querySelector('.match-meta').textContent = `${formattedDate} | ${data.location}`;


    // --- 2. 스코어보드 ---
    // ⭐ [추가 1] 점수-경기 상태 불일치 검증
    const ourRun = data.homeAway === 'home' ? Number(data['home-run'] || 0) : Number(data['away-run'] || 0);
    const oppRun = data.homeAway === 'home' ? Number(data['away-run'] || 0) : Number(data['home-run'] || 0);
    
    let isMismatch = false;
    // 승, 패, 무승부인데 점수가 논리적으로 맞지 않는 경우 (스코어 미입력 포함)
    if (data.status === 'win' && ourRun <= oppRun) isMismatch = true;
    if (data.status === 'loss' && ourRun >= oppRun) isMismatch = true;
    if (data.status === 'draw' && ourRun !== oppRun) isMismatch = true;

    // 특수 상태(취소, 중단, 경기전 등)인 경우도 점수 무효화
    const specialStatuses = ['no_record', 'rain_cancel', 'etc_cancel', 'rain_suspend', 'before'];
    if (specialStatuses.includes(data.status)) isMismatch = true;

    // ⭐ [추가 2] 이닝 배열이 모두 0으로만 채워져 있는지 확인 (단순 기록 모드 판별용)
    const isAllZeros = (arr) => Array.isArray(arr) && arr.length > 0 && arr.every(val => val === "0" || val === 0 || val === "");

    // 스코어 변수 초기화
    let homeScoreArr = data['home-score'] || [];
    let awayScoreArr = data['away-score'] || [];
    let homeR = data['home-run'] || 0;
    let awayR = data['away-run'] || 0;
    let homeH = data['home-hit'] || 0;
    let awayH = data['away-hit'] || 0;
    let homeE = data['home-error'] || 0;
    let awayE = data['away-error'] || 0;
    let homeB = data['home-ball'] || 0;
    let awayB = data['away-ball'] || 0;

    if (isMismatch) {
        // 불일치하거나 특수 상태면 모든 기록을 '-' 로 처리
        homeScoreArr = []; awayScoreArr = [];
        homeR = '-'; awayR = '-';
        homeH = '-'; awayH = '-';
        homeE = '-'; awayE = '-';
        homeB = '-'; awayB = '-';
    } else {
        // 정상 상태지만, 이닝 기록이 모두 0이면(상세 모드 미입력) 이닝만 '-' 표시
        if (isAllZeros(homeScoreArr)) homeScoreArr = [];
        if (isAllZeros(awayScoreArr)) awayScoreArr = [];
    }

    let topTeam = {}; 
    let btmTeam = {}; 

    if (data.homeAway === 'home') {
        topTeam = { 
            name: data.opponent, 
            runs: awayScoreArr, 
            r: awayR, h: awayH, e: awayE, b: awayB
        };
        btmTeam = { 
            name: "청운대학교", 
            runs: homeScoreArr, 
            r: homeR, h: homeH, e: homeE , b: homeB
        };
    } else {
        topTeam = { 
            name: "청운대학교", 
            runs: awayScoreArr, 
            r: awayR, h: awayH, e: awayE , b: awayB
        };
        btmTeam = { 
            name: data.opponent, 
            runs: homeScoreArr, 
            r: homeR, h: homeH, e: homeE , b: homeB
        };
    }

    // 메인 스코어보드 (이제 '-'값도 정상적으로 들어갑니다)
    const sbMain = document.querySelector('.scoreboard-main');
    sbMain.querySelector('.away .team-name').textContent = topTeam.name;
    sbMain.querySelector('.home .team-name').textContent = btmTeam.name;
    sbMain.querySelector('.away-score').textContent = topTeam.r;
    sbMain.querySelector('.home-score').textContent = btmTeam.r;

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