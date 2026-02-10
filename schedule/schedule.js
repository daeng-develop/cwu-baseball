/* schedule.js */

// 1. Firebase 가져오기
import { db } from "../firebase/firebase.js";

// 2. 상태 변수
let currentDate = new Date();
let currentYear = currentDate.getFullYear();
let currentMonth = currentDate.getMonth(); // 0: 1월 ~ 11: 12월

// ⭐ [핵심 추가] 비동기 충돌 방지용 번호표
let currentRenderId = 0;

// DOM 요소
const yearMonthEl = document.getElementById('current-date');
const calendarGridEl = document.getElementById('calendar-grid');
const prevBtn = document.getElementById('btn-prev');
const nextBtn = document.getElementById('btn-next');

// 3. 달력 렌더링 함수
async function renderCalendar() {
    // 1. 요청 번호표 발급 (버튼 누를 때마다 숫자가 올라감)
    const myRenderId = ++currentRenderId;

    // (1) 헤더 텍스트 업데이트
    const monthString = String(currentMonth + 1).padStart(2, '0');
    yearMonthEl.textContent = `${currentYear}. ${monthString}`;

    // (2) 그리드 초기화 (기존 내용 싹 지우기)
    calendarGridEl.innerHTML = '';

    // (3) 요일 헤더
    const weekdays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    weekdays.forEach((day, index) => {
        const div = document.createElement('div');
        div.classList.add('weekday');
        div.textContent = day;
        if (index === 0) div.classList.add('sun');
        if (index === 6) div.classList.add('sat');
        calendarGridEl.appendChild(div);
    });

    // (4) 날짜 계산
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();

    // (5) 앞쪽 빈 칸
    for (let i = 0; i < firstDayIndex; i++) {
        const emptyDiv = document.createElement('div');
        emptyDiv.classList.add('calendar-cell', 'empty');
        calendarGridEl.appendChild(emptyDiv);
    }

    // (6) 날짜 칸 생성
    for (let i = 1; i <= lastDay; i++) {
        const cellDiv = document.createElement('div');
        cellDiv.classList.add('calendar-cell');
        
        // 날짜 데이터 속성 심기 (2026-01-05)
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        cellDiv.dataset.date = dateStr;

        const dateNumSpan = document.createElement('span');
        dateNumSpan.classList.add('date-num');
        dateNumSpan.textContent = i;
        
        // 요일 색상
        const currentDayIndex = (firstDayIndex + i - 1) % 7;
        if (currentDayIndex === 0) cellDiv.classList.add('sun');
        else if (currentDayIndex === 6) cellDiv.classList.add('sat');

        cellDiv.appendChild(dateNumSpan);
        calendarGridEl.appendChild(cellDiv);
    }

    // (7) 뒤쪽 빈 칸
    const totalCellsUsed = firstDayIndex + lastDay;
    const remainingCells = (7 - (totalCellsUsed % 7)) % 7;
    for (let i = 0; i < remainingCells; i++) {
        const emptyDiv = document.createElement('div');
        emptyDiv.classList.add('calendar-cell', 'empty');
        calendarGridEl.appendChild(emptyDiv);
    }

    // ⭐ (8) 일정 데이터 불러오기 (번호표를 함께 넘김)
    await loadMonthlySchedules(currentYear, currentMonth, myRenderId);
}

// 4. 일정 데이터 로드 및 표시 함수
async function loadMonthlySchedules(year, month, reqId) {
    const strMonth = String(month + 1).padStart(2, '0');
    
    // 쿼리 범위
    const start = `${year}-${strMonth}-01`;
    const end = `${year}-${strMonth}-31`;

    try {
        // DB 요청
        const snapshot = await db.collection("schedule")
            .where("date", ">=", start)
            .where("date", "<=", end)
            .orderBy("date", "asc")
            .get();

        // ⭐ [핵심 방어 코드]
        // DB에서 데이터가 도착했을 때, 현재 화면 번호표(currentRenderId)와
        // 내가 요청했던 번호표(reqId)가 다르면? -> 이미 사용자가 다른 달로 이동한 것!
        // 그러니까 아무것도 하지 말고 함수 종료.
        if (reqId !== currentRenderId) {
            // console.log("이전 달력 요청이 취소되었습니다.");
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            const docId = doc.id; 

            // 1. 해당 날짜 칸 찾기
            const targetCell = document.querySelector(`.calendar-cell[data-date="${data.date}"]`);
            
            // 만약 셀을 찾았는데 이미 똑같은 내용이 있으면 추가하지 않음 (이중 방지)
            if (targetCell) {
                // 중복 방지: 같은 ID의 링크가 이미 있는지 확인
                if (targetCell.querySelector(`a[href*="${docId}"]`)) return;

                targetCell.classList.add('has-match');

                const linkEl = document.createElement('a');
                linkEl.className = 'match-info';
                
                // 클릭 시 이동 경로
                if (data.status === 'event') {
                    linkEl.href = `../event/event.html#${docId}`;
                } else {
                    linkEl.href = `../match/match.html#${docId}`;
                }

                // (1) 제목/상대팀
                const titleSpan = document.createElement('span');
                titleSpan.className = 'match-result';
                
                if (data.status === 'event') {
                    titleSpan.style.color = '#333'; 
                    titleSpan.textContent = data.opponent; 
                } else {
                    titleSpan.style.color = '#1565c0'; 
                    titleSpan.textContent = `vs ${data.opponent}`;
                }

                // (2) 장소
                const placeSpan = document.createElement('span');
                placeSpan.className = 'match-place';
                placeSpan.textContent = data.location;

                linkEl.appendChild(titleSpan);
                linkEl.appendChild(placeSpan);
                targetCell.appendChild(linkEl);
            }
        });

    } catch (error) {
        console.error("일정 로딩 실패:", error);
    }
}

// 5. 버튼 이벤트
prevBtn.addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    renderCalendar();
});

nextBtn.addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    renderCalendar();
});

// 초기 실행
renderCalendar();