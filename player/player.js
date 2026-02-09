// 1. 설정 파일에서 db와 storage 가져오기
import { db, storage } from "../firebase.js";

const posNames = { 'pitcher': '투수', 'catcher': '포수', 'infielder': '내야수', 'outfielder': '외야수'};
const posMap = { 'pitcher': 0, 'catcher': 1, 'infielder': 2, 'outfielder': 3 };
const doc_map = { 0: 'pitcher', 1: 'catcher', 2: 'infielder', 3: 'outfielder' };

// 페이지가 열리자마자 실행되는 코드
document.addEventListener("DOMContentLoaded", () => {

    /*********** year select box click event ***********/
    // 1. 연도 선택 박스 찾기
    const yearSelect = document.getElementById('year-select'); // 또는 querySelector('.year-select')
    
    // 2. 이벤트 연결 (값이 바뀌면 changeYear 함수 실행)
    if (yearSelect) {
        yearSelect.addEventListener('change', changeYear);
    }

    /*********** position box button click event ***********/
    // 1. 모든 포지션 버튼을 다 가져옵니다.
    const posButtons = document.querySelectorAll('.position-btn');

    // 2. 버튼 하나하나에 클릭 이벤트를 달아줍니다.
    posButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // HTML에 적어둔 data-position 값 ("pitcher" 등)을 가져옵니다.
            const newPos = btn.dataset.position;
            changePosition(newPos);
        });
    });
    
    // 초기 화면 렌더링
    update_page();
});

// URL 변경을 감지하여 화면 새로고침 없이 대응 (해시 변경 시)
window.addEventListener('hashchange', update_page);

async function update_page() {
    const urlParams = new URLSearchParams(window.location.search);
    let currentYear = urlParams.get('year') || '2026';
    let currentHash = window.location.hash.replace('#', '') || 'pitcher';

     const listArea = document.getElementById('player-list-area'); //화면에 그리기 위한 변수

    // 1. UI 업데이트
    document.getElementById('display-year').innerText = currentYear;
    document.getElementById('year-select').value = currentYear;

    document.getElementById('display-position').innerText = posNames[currentHash];
    updateButtonStyles(currentHash);

    try
    {
          // 2. firestore에서 선수 데이터 불러오기
    // 경로: player -> 2026 -> pitcher (컬렉션)
    const snapshot = await db.collection("player").doc(currentYear).collection(currentHash).get();

    // 문서가 하나도 없는지 확인
    if (snapshot.empty) {
        listArea.innerHTML = `<div class="no-data">해당 조건의 선수가 없습니다.</div>`;
        return;
    }
    
    // 데이터 가공 (Snapshot -> Array)
    let players = [];
    snapshot.forEach(doc => {
        players.push(doc.data());
    });

    //등번호 순으로 정렬 (오름차순: 1번 -> 99번)
    players.sort((a, b) => a.number - b.number);

    // 3. 화면에 그리기
    listArea.innerHTML = players.map(player => `
        <div class="player-card">
            <div class="player-image-box">
                <img src="${player.photo || '../images/default-player.png'}" 
                    alt="${player.name}" 
                    onerror="this.src='../images/default-player.png'">
            </div>
            <div class="player-details">
                <div class="player-number">No. ${player.number}</div>
                <div class="player-name">${player.name}</div>
                <div class="player-main-info">${player.type}</div>
                <div class="player-grade">${player.height}cm, ${player.weight}kg | ${player.grade}학년</div>
                <div class="player-school">${player.school}</div>
            </div>
        </div>
    `).join('');
    } catch (error) {
        console.error("데이터 불러오기 실패:", error);
        listArea.innerHTML = `<div class="no-data">데이터를 불러오는 중 오류가 발생했습니다.</div>`;
    }
}

/**
 * 연도 변경 시 (Select Box)
 */
async function changeYear() {
    const yearSelect = document.getElementById('year-select');
    const selectedYear = yearSelect?.value;

    if (!selectedYear) {
        console.error("연도 선택 박스를 찾을 수 없습니다!");
        return; // 함수 중단
    }

    const currentHash = window.location.hash || '#pitcher';
    window.location.href = `player.html?year=${selectedYear}${currentHash}`;

    console.log("연도 변경:", selectedYear);
}

// 포지션 변경 함수
function changePosition(pos) {
    // 1. 주소창의 해시(#) 변경
    //페이지 새로고침 없이 주소만 바뀝니다. (예: #catcher)
    window.location.hash = pos;
}

/**
 * 버튼 활성화 디자인 적용
 */
function updateButtonStyles(activeHash) {
    const buttons = document.querySelectorAll('.position-btn');
    
    buttons.forEach(btn => btn.classList.remove('active'));
    
    const activeIdx = posMap[activeHash];
    if (buttons[activeIdx]) {
        buttons[activeIdx].classList.add('active');
    }
}