import { pitchingDecisionCounts } from '../common/pitching-decision.js';
import { mountShell, all, escapeHTML, dateText } from '../common/common.js';
mountShell();
let games = [],
  photos = [],
  stats = [];
const app = document.getElementById('app');
app.innerHTML = /* HTML */ `<div class="page-heading">
    <div>
      <span class="eyebrow">GAME CENTER</span>
      <h1>경기 결과</h1>
    </div>
  </div>
  <div class="result-layout">
    <aside class="game-sidebar panel">
      <div class="result-selectors"><label class="result-select-field" for="result-year"><span>년도</span><select id="result-year" aria-label="경기 연도 선택"></select></label>
      <label class="result-select-field" for="competition-filter"><span>대회</span><select id="competition-filter" aria-label="대회 선택"></select></label></div>
      <div id="game-list" class="game-list"></div>
    </aside>
    <article id="game-detail" class="game-detail panel empty">경기를 선택해 주세요.</article>
  </div>`;
try {
  [games, photos, stats] = await Promise.all([all('games'), all('photos'), all('playerGameStats')]);
  games = games.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const params = new URLSearchParams(location.search);
  const hashGame = games.find((game) => game.id === decodeURIComponent(location.hash.slice(1)));
  const years = [...new Set(games.map(gameYear))].sort().reverse();
  const yearSelect = document.getElementById('result-year');
  yearSelect.innerHTML = years.map((year) => `<option value="${escapeHTML(year)}">${escapeHTML(year)}${year === '날짜 미등록' ? '' : '년'}</option>`).join('');
  const preferredYear = hashGame ? gameYear(hashGame) : params.get('year');
  if (years.includes(preferredYear)) yearSelect.value = preferredYear;
  fillResultCompetitions(hashGame?.competition?.trim() || params.get('competition'));
  yearSelect.addEventListener('change', () => {
    fillResultCompetitions();
    updateResultFilters();
  });
  document.getElementById('competition-filter').addEventListener('change', updateResultFilters);
  document.getElementById('game-list').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-id]');
    if (!button) return;
    location.hash = encodeURIComponent(button.dataset.id);
    render();
  });
  renderList();
  window.addEventListener('hashchange', () => {
    const target = games.find((game) => game.id === decodeURIComponent(location.hash.slice(1)));
    if (target) {
      document.getElementById('result-year').value = gameYear(target);
      fillResultCompetitions(target.competition?.trim() || '기타 대회');
      renderList();
    }
    render();
  });
  render();
} catch (e) {
  document.getElementById('game-list').innerHTML =
    '<div class="empty">경기 정보를 불러오지 못했습니다.</div>';
  console.error(e);
}
function positionMarkup(value) {
  const text = String(value || '—');
  const pattern = /지명타자|유격수|좌익수|중견수|우익수|[123]루수|투수|포수|대타|대주자/g;
  const positions = text.match(pattern) || [];
  const rest = text.replace(pattern, '').replace(/[\s,\/·→>;|-]/g, '');
  return positions.length && !rest ? positions.map(escapeHTML).join('<br>') : escapeHTML(text).replace(/\r?\n/g, '<br>');
}
function gameYear(game) {
  const year = String(game.date || '').slice(0, 4);
  return /^\d{4}$/.test(year) ? year : '날짜 미등록';
}
function fillResultCompetitions(preferred) {
  const year = document.getElementById('result-year').value;
  const names = [...new Set(games.filter((game) => gameYear(game) === year).map((game) => game.competition?.trim() || '기타 대회'))].sort((a, b) => a.localeCompare(b, 'ko'));
  const select = document.getElementById('competition-filter');
  select.innerHTML = names.map((name) => `<option value="${escapeHTML(name)}">${escapeHTML(name)}</option>`).join('');
  if (names.includes(preferred)) select.value = preferred;
  select.disabled = !names.length;
}
function updateResultFilters() {
  const params = new URLSearchParams(location.search);
  params.set('year', document.getElementById('result-year').value);
  params.set('competition', document.getElementById('competition-filter').value);
  history.replaceState(null, '', `${location.pathname}?${params}`);
  renderList(); render();
}
function visibleGames() {
  const year = document.getElementById('result-year').value;
  const competition = document.getElementById('competition-filter').value;
  return games.filter((game) => gameYear(game) === year && (game.competition?.trim() || '기타 대회') === competition);
}
function renderList() {
  const filtered = visibleGames();
  const groups = new Map();
  for (const game of filtered) {
    const name = game.competition?.trim() || '기타 대회';
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(game);
  }
  document.getElementById('game-list').innerHTML = games.length
    ? [...groups]
        .map(
          ([name, entries]) =>
            /* HTML */ `<section class="competition-group">
              <h2>${escapeHTML(name)}</h2>
              ${entries
                .map(
                  (game) =>
                    /* HTML */ `<button type="button" data-id="${escapeHTML(game.id)}">
                      <small>${dateText(game.date)}</small
                      ><span>청운대 vs ${escapeHTML(game.opponent || '상대팀 미정')}</span>
                      ${game.status === 'finished' ? /* HTML */ `<strong>${escapeHTML(game.cwuScore ?? '-')} : ${escapeHTML(game.opponentScore ?? '-')}</strong>` : ''}
                    </button>`,
                )
                .join('')}
            </section>`,
        )
        .join('')
    : '<div class="empty">등록된 경기가 없습니다.</div>';
}

function render() {
  const id = decodeURIComponent(location.hash.slice(1));
  const visible = visibleGames();
  const g = visible.find((game) => game.id === id) || visible[0];
  if (!g) { document.getElementById('game-detail').innerHTML = '<p class="empty">선택한 연도·대회의 경기가 없습니다.</p>'; return; }
  document
    .querySelectorAll('#game-list button')
    .forEach((b) => b.classList.toggle('active', b.dataset.id === g.id));
  let inn = Array.isArray(g.innings) ? g.innings : [];
  let scoreboard = g.scoreboard || {};
  // Older imports included R/H/E/B as four extra innings. Read those values without mutating Firestore.
  const legacyTotals =
    g.sourceGameId &&
    inn.length >= 11 &&
    Number(inn[inn.length - 4].cwu) === Number(g.cwuScore) &&
    Number(inn[inn.length - 4].opponent) === Number(g.opponentScore) &&
    ['cwu', 'opponent'].every(
      (team) =>
        inn.slice(0, -4).reduce((total, inning) => total + (Number(inning[team]) || 0), 0) ===
        Number(inn[inn.length - 4][team]),
    );
  if (legacyTotals) {
    if (!g.scoreboard) {
      scoreboard = Object.fromEntries(
        ['cwu', 'opponent'].map((team) => [
          team,
          Object.fromEntries(
            ['r', 'h', 'e', 'b'].map((key, index) => [key, inn[inn.length - 4 + index][team]]),
          ),
        ]),
      );
    }
    inn = inn.slice(0, -4);
  }
  const players = stats.filter((s) => s.gameId === g.id);
  const imgs = photos.filter((p) => p.gameId === g.id);
  const batters = players
    .filter((record) => !(Number(record.batting?.order) > 9))
    .filter(
      (s) =>
        s.batting ||
        Number(s.atBats) ||
        Number(s.hits) ||
        Number(s.rbi) ||
        Number(s.runs) ||
        Number(s.homeRuns),
    )
    .sort((a, b) => (a.batting?.lineupSequence ?? 999) - (b.batting?.lineupSequence ?? 999));
  const pitchers = players
    .filter((s) => s.pitching || Number(s.inningsOuts) || s.inningsPitched)
    .sort((a, b) => (a.pitching?.appearanceOrder ?? 999) - (b.pitching?.appearanceOrder ?? 999));
  let scoreRow = (team, key, total) =>
    /* HTML */ `<tr>
      <th>${team}</th>
      ${inn.map((x) => /* HTML */ `<td>${escapeHTML(x[key] ?? '-')}</td>`).join('')}
      ${['r', 'h', 'e', 'b'].map((column) => /* HTML */ `<th class="score-${column}">${escapeHTML(column === 'r' ? (total ?? scoreboard[key]?.r ?? '—') : (scoreboard[key]?.[column] ?? '—'))}</th>`).join('')}
    </tr>`;
  document.getElementById('game-detail').classList.remove('empty');
  document.getElementById('game-detail').innerHTML = /* HTML */ `<div class="score-head">
      <span class="pill">${g.status === 'finished' ? '경기 종료' : '경기 예정'}</span>
      <div class="game-meta">
        <strong>${escapeHTML(g.competition || '기타 대회')}</strong>
        <span
          >${dateText(g.date)} ${escapeHTML(g.time || '')} ·
          ${escapeHTML(g.venue || '구장 미정')}</span
        >
      </div>
      <h2>청운대 vs ${escapeHTML(g.opponent || '상대팀 미정')}</h2>
      <div class="big-score">
        ${escapeHTML(g.cwuScore ?? '-')} : ${escapeHTML(g.opponentScore ?? '-')}
      </div>
    </div>
    <h3>스코어보드</h3>
    <div class="scroll-table">
      <table class="data-table">
        <thead>
          <tr>
            <th>팀</th>
            ${inn.map((_, i) => /* HTML */ `<th>${i + 1}</th>`).join('')}
            <th class="score-r">R</th>
            <th class="score-h">H</th>
            <th class="score-e">E</th>
            <th class="score-b">B</th>
          </tr>
        </thead>
        <tbody>
          ${scoreRow('청운대', 'cwu', g.cwuScore)}${scoreRow(escapeHTML(g.opponent || '상대팀'), 'opponent', g.opponentScore)}
        </tbody>
      </table>
    </div>
    <h3>타자 라인업</h3>
    <div class="scroll-table">
      <table class="data-table detail-table">
        <thead>
          <tr>
            <th>타순</th>
            <th>선수</th>
            <th>수비</th>
            <th>타수</th>
            <th>안타</th>
            <th>타점</th>
            <th>득점</th>
            <th>홈런</th>
            <th>타율</th>
          </tr>
        </thead>
        <tbody>
          ${
            batters.length
              ? batters
                  .map((s) => {
                    const b = s.batting || s;
                    return /* HTML */ `<tr
                      class="${b.entryType && b.entryType !== '선발' ? 'substitute-row' : ''}"
                    >
                      <td>${escapeHTML(b.order || '—')}</td>
                      <td>
                        ${escapeHTML(s.playerName || '')}${b.entryType && b.entryType !== '선발' ? /* HTML */ `<small>↳ ${escapeHTML(b.entryType)}${b.replacedPlayerName ? `` : ''}</small>` : ''}
                      </td>
                      <td class="fielding-positions">${positionMarkup(b.position || s.position)}</td>
                      <td>${escapeHTML(b.atBats ?? '—')}</td>
                      <td>${escapeHTML(b.hits ?? '—')}</td>
                      <td>${escapeHTML(b.rbi ?? '—')}</td>
                      <td>${escapeHTML(b.runs ?? '—')}</td>
                      <td>${escapeHTML(b.homeRuns ?? '—')}</td>
                      <td>
                        ${escapeHTML(b.battingAverage || (Number(b.atBats) ? (Number(b.hits) / Number(b.atBats)).toFixed(3) : '—'))}
                      </td>
                    </tr>`;
                  })
                  .join('')
              : '<tr><td colspan="9">등록된 타자 기록이 없습니다.</td></tr>'
          }
        </tbody>
      </table>
    </div>
    <h3>투수 기록</h3>
    <div class="scroll-table">
      <table class="data-table detail-table">
        <thead>
          <tr>
            <th>선수</th>
            <th>등판</th>
            <th>결과</th>
            <th>승</th>
            <th>패</th>
            <th>세이브</th><th>홀드</th>
            <th>이닝</th>
            <th>타자</th>
            <th>투구수</th>
            <th>타수</th>
            <th>피안타</th>
            <th>피홈런</th>
            <th>4사구</th>
            <th>삼진</th>
            <th>실점</th>
            <th>자책</th>
            <th>평균자책점</th>
          </tr>
        </thead>
        <tbody>
          ${
            pitchers.length
              ? pitchers
                  .map((s) => {
                    const raw = s.pitching || s;
                    const p = raw.decisionStatsVersion === 2 ? raw : { ...raw, ...pitchingDecisionCounts(raw.decision) };
                    const values = [
                      p.appearance,
                      p.decision,
                      p.wins,
                      p.losses,
                      p.saves, p.holds,
                      p.inningsPitched,
                      p.battersFaced,
                      p.pitchCount ?? p.pitches,
                      p.atBatsAgainst,
                      p.hitsAllowed,
                      p.homeRunsAllowed,
                      p.walksAndHitByPitch,
                      p.strikeouts,
                      p.runsAllowed,
                      p.earnedRuns,
                      p.era,
                    ];
                    return /* HTML */ `<tr>
                      <td>${escapeHTML(s.playerName || '')}</td>
                      ${values.map((value) => /* HTML */ `<td>${escapeHTML(value ?? '—')}</td>`).join('')}
                    </tr>`;
                  })
                  .join('')
              : '<tr><td colspan="18">등록된 투수 기록이 없습니다.</td></tr>'
          }
        </tbody>
      </table>
    </div>
    <h3>경기 사진</h3>
    <div class="masonry">
      ${imgs.length ? imgs.map((p) => /* HTML */ `<img src="${escapeHTML(p.url)}" alt="${escapeHTML(p.caption || '경기 사진')}" loading="lazy" />`).join('') : '등록된 사진이 없습니다.'}
    </div>`;
}
