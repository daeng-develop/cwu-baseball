import { mountShell, all, gameHref, escapeHTML } from '../common/common.js';
mountShell();
let events = [];
let current = new Date();
current.setDate(1);
document.getElementById('app').innerHTML = /* HTML */ `<div class="page-heading">
    <div>
      <span class="eyebrow">CALENDAR</span>
      <h1>경기 일정</h1>
    </div>
  </div>
  <div class="calendar-head">
    <div>
      <span class="calendar-kicker">GAME CALENDAR</span>
      <h2 id="month"></h2>
    </div>
    <div class="calendar-controls">
      <form id="month-jump" class="month-jump"><label for="jump-month" class="sr-only">이동할 연도와 월</label><input type="month" id="jump-month" required aria-label="이동할 연도와 월" /><button type="submit" class="month-jump-button">이동</button></form>
      <button class="month-button" id="prev" aria-label="이전 달">‹</button>
      <button class="month-button" id="next" aria-label="다음 달">›</button>
    </div>
  </div>
  <div class="calendar-legend">
    <span><i class="legend-game"></i> 경기</span><span><i class="legend-other"></i> 훈련·기타</span>
  </div>
  <div id="calendar" class="calendar"></div>`;
document.getElementById('month-jump').onsubmit = (event) => {
  event.preventDefault();
  const match = document.getElementById('jump-month').value.match(/^(\d{4})-(\d{2})$/);
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) return;
  current = new Date(Number(match[1]), Number(match[2]) - 1, 1);
  render();
};
document.getElementById('prev').onclick = () => {
  current.setMonth(current.getMonth() - 1);
  render();
};
document.getElementById('next').onclick = () => {
  current.setMonth(current.getMonth() + 1);
  render();
};
try {
  events = [...(await all('games')), ...(await all('events'))];
  render();
} catch (e) {
  document.getElementById('calendar').textContent = '일정을 불러오지 못했습니다.';
  console.error(e);
}
function render() {
  const todayKey = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
  let y = current.getFullYear(),
    m = current.getMonth(),
    start = new Date(y, m, 1).getDay(),
    days = new Date(y, m + 1, 0).getDate();
  document.getElementById('jump-month').value = `${y}-${String(m + 1).padStart(2, '0')}`;
  document.getElementById('month').textContent = `${y}년 ${m + 1}월`;
  let html = ['일', '월', '화', '수', '목', '금', '토']
    .map((d) => /* HTML */ `<div class="weekday">${d}</div>`)
    .join('');
  for (let i = 0; i < Math.ceil((start + days) / 7) * 7; i++) {
    let n = i - start + 1,
      date = `${y}-${String(m + 1).padStart(2, '0')}-${String(n).padStart(2, '0')}`;
    html += /* HTML */ `<div
      class="day ${n < 1 || n > days ? 'dim' : ''} ${date === todayKey ? 'today' : ''} ${i % 7 === 0 ? 'sunday' : ''}"
    >
      ${
        n > 0 && n <= days
          ? /* HTML */ `<span class="date-num">${n}</span>
              <div class="day-events">
                ${events
                  .filter((e) => e.date === date)
                  .map((e) =>
                    e.opponent
                      ? /* HTML */ `<a
                          class="event"
                          href="${gameHref(e.id)}"
                          title="${escapeHTML(e.competition || '경기')} · ${escapeHTML(e.opponent)}"
                          >⚾ vs ${escapeHTML(e.opponent)}</a
                        >`
                      : /* HTML */ `<span class="event other">✦ ${escapeHTML(e.title)}</span>`,
                  )
                  .join('')}
              </div>`
          : ''
      }
    </div>`;
  }
  document.getElementById('calendar').innerHTML = html;
}
