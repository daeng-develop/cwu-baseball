/* schedule.js */

// 1. Firebase 가져오기
import { db } from "../firebase.js";

// 2. 상태 변수
let currentDate = new Date();
let currentYear = currentDate.getFullYear();
let currentMonth = currentDate.getMonth(); // 0: 1월 ~ 11: 12월

// DOM 요소
const yearMonthEl = document.getElementById('current-date');
const calendarGridEl = document.getElementById('calendar-grid');
const prevBtn = document.getElementById('btn-prev');
const nextBtn = document.getElementById('btn-next');

// 3. 달력 렌더링 함수
async function renderCalendar() {
    // (1) 헤더 텍스트 업데이트
    const monthString = String(currentMonth + 1).padStart(2, '0');
    yearMonthEl.textContent = `${currentYear}. ${monthString}`;

    // (2) 그리드 초기화
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
        
        // ⭐ 중요: 나중에 데이터를 넣기 위해 날짜 정보를 태그에 심어둠
        // 예: data-date="2026-01-05"
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

    // ⭐ (8) 일정 데이터 불러오기 (비동기)
    await loadMonthlySchedules(currentYear, currentMonth);
}

// 4. 일정 데이터 로드 및 표시 함수
async function loadMonthlySchedules(year, month) {
    const strMonth = String(month + 1).padStart(2, '0');
    
    // 쿼리 범위: 해당 월 1일 ~ 31일
    const start = `${year}-${strMonth}-01`;
    const end = `${year}-${strMonth}-31`;

    try {
        const snapshot = await db.collection("schedule")
            .where("date", ">=", start)
            .where("date", "<=", end)
            .orderBy("date", "asc")
            .get();

        snapshot.forEach(doc => {
            const data = doc.data();
            const docId = doc.id; // 예: 20260101

            // 1. 해당 날짜 칸 찾기
            const targetCell = document.querySelector(`.calendar-cell[data-date="${data.date}"]`);
            
            if (targetCell) {
                // 2. 배경색 변경 (일정이 있는 날 표시)
                targetCell.classList.add('has-match');

                // 3. 링크 생성
                const linkEl = document.createElement('a');
                linkEl.className = 'match-info'; // CSS 스타일 적용
                
                // 클릭 시 이동 경로 설정
                if (data.status === 'event') {
                    // 행사 -> event.html
                    linkEl.href = `../event/event.html#${docId}`;
                } else {
                    // 경기 -> match.html
                    linkEl.href = `../match/match.html#${docId}`;
                }

                // 4. 내용 표시
                // 행사일 때: opponent 필드에 'Title'이 들어있음 -> (Title, Location)
                // 경기일 때: opponent 필드에 '상대팀'이 들어있음 -> (Opponent, Location)
                // 결론: 둘 다 opponent와 location을 보여주면 됨
                
                // (1) 제목/상대팀
                const titleSpan = document.createElement('span');
                titleSpan.className = 'match-result'; // 굵은 글씨 스타일 재사용
                // 행사면 검정색, 경기면 기본색
                if (data.status === 'event') {
                    titleSpan.style.color = '#333'; 
                    titleSpan.textContent = data.opponent; // 행사 제목
                } else {
                    titleSpan.style.color = '#1565c0'; // 경기 상대팀(파란색 계열)
                    titleSpan.textContent = `vs ${data.opponent}`;
                }

                // (2) 장소
                const placeSpan = document.createElement('span');
                placeSpan.className = 'match-place';
                placeSpan.textContent = data.location;

                // 추가
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