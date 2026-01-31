// schedule.js

// 1. 상태 변수 (현재 보여줄 년/월)
let currentDate = new Date(); // 오늘 날짜 기준 시작
let currentYear = currentDate.getFullYear();
let currentMonth = currentDate.getMonth(); // 0: 1월, 1: 2월 ... 11: 12월

// 2. DOM 요소 가져오기
const yearMonthEl = document.getElementById('current-date');
const calendarGridEl = document.getElementById('calendar-grid');
const prevBtn = document.getElementById('btn-prev');
const nextBtn = document.getElementById('btn-next');

// 3. 달력 렌더링 함수
function renderCalendar() {
    // (1) 헤더 텍스트 업데이트 (예: 2026. 01)
    // 월은 0부터 시작하므로 +1, padStart로 두 자리 맞춤 (1 -> 01)
    const monthString = String(currentMonth + 1).padStart(2, '0');
    yearMonthEl.textContent = `${currentYear}. ${monthString}`;

    // (2) 그리드 초기화
    calendarGridEl.innerHTML = '';

    // (3) 요일 헤더 그리기 (JS로 매번 다시 그려야 순서가 맞음)
    const weekdays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    weekdays.forEach((day, index) => {
        const div = document.createElement('div');
        div.classList.add('weekday');
        div.textContent = day;
        
        // 일요일(0), 토요일(6) 색상 클래스 추가
        if (index === 0) div.classList.add('sun');
        if (index === 6) div.classList.add('sat');
        
        calendarGridEl.appendChild(div);
    });

    // (4) 날짜 계산
    // 이번 달 1일이 무슨 요일인지 (0:일, 1:월 ... 6:토)
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    
    // 이번 달 마지막 날짜가 며칠인지 (0을 넣으면 지난달 마지막 날 -> 즉 이번달 마지막 날)
    const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();

    // (5) 빈 칸 채우기 (1일 이전)
    for (let i = 0; i < firstDayIndex; i++) {
        const emptyDiv = document.createElement('div');
        emptyDiv.classList.add('calendar-cell', 'empty');
        calendarGridEl.appendChild(emptyDiv);
    }

    // (6) 날짜 채우기 (1일 ~ 말일)
    for (let i = 1; i <= lastDay; i++) {
        const cellDiv = document.createElement('div');
        cellDiv.classList.add('calendar-cell');

        // 날짜 숫자 태그
        const dateNumSpan = document.createElement('span');
        dateNumSpan.classList.add('date-num');
        dateNumSpan.textContent = i;
        
        // 무슨 요일인지 계산하여 색상 클래스 부여
        // (빈 칸 개수 + 현재 날짜 - 1) % 7
        const currentDayIndex = (firstDayIndex + i - 1) % 7;
        
        if (currentDayIndex === 0) {
            cellDiv.classList.add('sun');
        } else if (currentDayIndex === 6) {
            cellDiv.classList.add('sat');
        }

        cellDiv.appendChild(dateNumSpan);
        
        // 여기에 나중에 경기 일정을 추가하는 코드가 들어갈 예정
        // const matchInfo = document.createElement('div'); ...

        calendarGridEl.appendChild(cellDiv);
    }

    // ⭐ [추가] (7) 뒷부분 빈 칸 채우기
    // 지금까지 채운 칸 개수 = (앞 빈칸) + (이번달 날짜 수)
    const totalCellsUsed = firstDayIndex + lastDay;
    
    // 7로 나눈 나머지를 구해서, 남은 칸이 몇 개인지 계산
    const remainingCells = (7 - (totalCellsUsed % 7)) % 7;

    // 남은 칸만큼 빈 셀 추가
    for (let i = 0; i < remainingCells; i++) {
        const emptyDiv = document.createElement('div');
        emptyDiv.classList.add('calendar-cell', 'empty');
        calendarGridEl.appendChild(emptyDiv);
    }
}

// 4. 이벤트 리스너 (이전 달 / 다음 달 이동)
prevBtn.addEventListener('click', () => {
    currentMonth--; 
    if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    }
    renderCalendar();
});

nextBtn.addEventListener('click', () => {
    currentMonth++; 
    if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    }
    renderCalendar();
});

// 5. 초기 실행
renderCalendar();