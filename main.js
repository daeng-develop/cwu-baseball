import {
  mountShell,
  all,
  today,
  gameHref,
  link,
  escapeHTML,
  mainImagePath,
} from './common/common.js';
mountShell();
document.getElementById('app').innerHTML = /* HTML */ `<section class="hero" id="hero">
    <div class="hero-content">
      <span class="eyebrow">CHEONGWOON BASEBALL</span>
      <h1>청운대 야구부</h1>
      <p>경기 일정과 결과를 한눈에</p>
    </div>
    <div class="hero-photo"><img id="hero-image" alt="청운대 야구부 단체사진" hidden /></div>
  </section>
  <div class="grid2">
    <section class="home-section panel">
      <div class="section-head">
        <div class="section-heading">
          <span class="section-icon upcoming-icon" aria-hidden="true">⚾</span>
          <div>
            <span class="section-kicker">UP NEXT</span>
            <h2>다가오는 경기</h2>
          </div>
        </div>
        <a class="section-more" href="${link('schedule/schedule.html')}"
          >전체 일정 <span aria-hidden="true">↗</span></a
        >
      </div>
      <div id="upcoming" class="home-games">불러오는 중…</div>
    </section>
    <section class="home-section panel">
      <div class="section-head">
        <div class="section-heading">
          <span class="section-icon result-icon" aria-hidden="true">★</span>
          <div>
            <span class="section-kicker">FINAL SCORES</span>
            <h2>최근 경기 결과</h2>
          </div>
        </div>
        <a class="section-more" href="${link('results/results.html')}"
          >전체 결과 <span aria-hidden="true">↗</span></a
        >
      </div>
      <div id="past" class="home-games">불러오는 중…</div>
    </section>
  </div>`;
const heroImage = document.getElementById('hero-image');
heroImage.addEventListener('load', () => {
  heroImage.hidden = false;
  document.getElementById('hero').classList.add('has-image');
});
heroImage.addEventListener('error', () => heroImage.remove());
heroImage.src = link(mainImagePath);
try {
  let games = await all('games');
  let t = today();
  function rows(arr, el, upcoming) {
    el.innerHTML = arr.length
      ? arr
          .map(
            (g) =>
              /* HTML */ `<a class="game-row" href="${gameHref(g.id)}">
                <span class="date-badge" aria-hidden="true">
                  <small>${escapeHTML(Number(g.date?.slice(5, 7)) || '—')}월</small>
                  <strong>${escapeHTML(Number(g.date?.slice(8, 10)) || '—')}</strong>
                </span>
                <span class="game-copy">
                  <small class="competition-name"
                    >${escapeHTML(g.competition || '청운대 경기')}</small
                  >
                  <strong
                    >청운대
                    <span class="versus">vs</span>
                    ${escapeHTML(g.opponent || '상대팀 미정')}</strong
                  >
                  <span class="game-meta"
                    >${escapeHTML(g.date?.slice(0, 4) || '시즌 미정')}
                    시즌${g.time ? ` · ${escapeHTML(g.time)}` : ''}${g.venue ? ` · ${escapeHTML(g.venue)}` : ''}</span
                  >
                </span>
                <span class="game-status ${upcoming ? 'scheduled' : 'finished'}">
                  ${upcoming ? '예정' : `${escapeHTML(g.cwuScore ?? '—')}<span>:</span>${escapeHTML(g.opponentScore ?? '—')}`}
                </span>
              </a>`,
          )
          .join('')
      : /* HTML */ `<div class="home-empty">
          <span class="empty-ball" aria-hidden="true">⚾</span>
          <strong>${upcoming ? '다음 경기를 기다리고 있어요' : '아직 등록된 결과가 없어요'}</strong>
          <p>
            ${upcoming ? '새 일정이 등록되면 여기서 바로 만날 수 있어요.' : '경기가 끝나면 이곳에 기록이 차곡차곡 쌓여요.'}
          </p>
        </div>`;
  }
  rows(
    games
      .filter((g) => g.date >= t && g.status !== 'finished')
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5),
    document.getElementById('upcoming'),
    true,
  );
  rows(
    games
      .filter((g) => g.date <= t && g.status === 'finished')
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5),
    document.getElementById('past'),
    false,
  );
} catch (e) {
  document
    .querySelectorAll('#upcoming,#past')
    .forEach(
      (el) => (el.textContent = '데이터를 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.'),
    );
  console.error(e);
}
