import { pitchingDecisionCounts } from '../common/pitching-decision.js';
import {
  mountShell,
  all,
  escapeHTML,
  compareUniformNumbers,
  baseballInningsToOuts,
  playerImagePath,
  link,
} from '../common/common.js';
mountShell();
const app = document.getElementById('app');
app.innerHTML = /* HTML */ `<div class="page-heading">
    <div>
      <span class="eyebrow">ROSTER</span>
      <h1>선수 정보</h1>
    </div>
  </div>
  <div class="filters">
    <label class="season-control" for="year"
      >시즌
      <select id="year" aria-label="시즌 선택"></select>
    </label>
    <fieldset class="position-filter">
      <legend>포지션</legend>
      <div class="position-options" aria-label="포지션 선택">
        <button class="position-chip active" type="button" data-position="" aria-pressed="true">
          전체
        </button>
        <button class="position-chip" type="button" data-position="투수" aria-pressed="false">
          투수
        </button>
        <button class="position-chip" type="button" data-position="내야수" aria-pressed="false">
          내야수
        </button>
        <button class="position-chip" type="button" data-position="외야수" aria-pressed="false">
          외야수
        </button>
        <button class="position-chip" type="button" data-position="포수" aria-pressed="false">
          포수
        </button>
        <button class="position-chip" type="button" data-position="미지정" aria-pressed="false">
          미지정
        </button>
      </div>
    </fieldset>
  </div>
  <div id="players" class="player-grid"></div>
  <dialog id="detail" class="modal">
    <div class="modal-body">
      <div class="modal-top">
        <h2 id="detail-title"></h2>
        <button class="close" aria-label="닫기" onclick="this.closest('dialog').close()">×</button>
      </div>
      <div id="detail-content"></div>
    </div>
  </dialog>`;
let roster = [],
  stats = [],
  games = [],
  historyStats = [];
const positionOptions = new Set(['투수', '내야수', '외야수', '포수', '미지정']);
const requestedPosition = new URLSearchParams(location.search).get('position') || '';
let selectedPosition = positionOptions.has(requestedPosition) ? requestedPosition : '';
document.querySelectorAll('.position-chip').forEach((button) => {
  const selected = button.dataset.position === selectedPosition;
  button.classList.toggle('active', selected);
  button.setAttribute('aria-pressed', String(selected));
});
const box = document.getElementById('players');
try {
  [roster, stats, games, historyStats] = await Promise.all([
    all('players'),
    all('playerGameStats'),
    all('games'),
    all('playerHistoryStats'),
  ]);
  const years = [...new Set(roster.map((p) => String(p.year)))].sort().reverse();
  document.getElementById('year').innerHTML =
    years.map((y) => /* HTML */ `<option>${escapeHTML(y)}</option>`).join('') ||
    /* HTML */ `<option>${new Date().getFullYear()}</option>`;
  render();
} catch (e) {
  box.innerHTML = '<p class="empty">선수 정보를 불러오지 못했습니다.</p>';
  console.error(e);
}
document.getElementById('year').addEventListener('change', render);
document.querySelectorAll('.position-chip').forEach((button) => {
  button.addEventListener('click', () => {
    selectedPosition = button.dataset.position;
    const params = new URLSearchParams(location.search);
    if (selectedPosition) params.set('position', selectedPosition);
    else params.delete('position');
    history.replaceState(
      null,
      '',
      `${location.pathname}${params.size ? `?${params}` : ''}${location.hash}`,
    );
    document.querySelectorAll('.position-chip').forEach((chip) => {
      const selected = chip === button;
      chip.classList.toggle('active', selected);
      chip.setAttribute('aria-pressed', String(selected));
    });
    render();
  });
});
function render() {
  const y = document.getElementById('year').value;
  let list = roster
    .filter((p) => String(p.year) === y && (!selectedPosition || p.position === selectedPosition))
    .sort(compareUniformNumbers);
  box.innerHTML = list.length
    ? list
        .map(
          (p) =>
            /* HTML */ `<button class="player-card" data-id="${escapeHTML(p.id)}">
              ${photoMarkup(p, true)}
              <div class="player-info">
                <strong>No.${escapeHTML(p.number)} ${escapeHTML(p.name)}</strong>
                <p>${escapeHTML(p.position)} · ${escapeHTML(p.grade)}학년</p>
                <p>
                  ${escapeHTML(p.height)}cm / ${escapeHTML(p.weight)}kg ·
                  ${escapeHTML(p.highSchool)}
                </p>
              </div>
            </button>`,
        )
        .join('')
    : '<p class="empty">해당 시즌의 등록 선수가 없습니다.</p>';
  box
    .querySelectorAll('button')
    .forEach((b) => (b.onclick = () => show(roster.find((p) => p.id === b.dataset.id))));
  attachPhotoFallback(box);
}
function photoMarkup(player, card) {
  const path = playerImagePath(player);
  const source = path ? link(path) : player.photoUrl;
  const fallback = path ? player.photoUrl || '' : '';
  if (!source) return card ? '<div class="player-placeholder">CW</div>' : '';
  return /* HTML */ `<img
    ${card ? 'class="player-photo" loading="lazy"' : ''}
    src="${escapeHTML(source)}"
    data-fallback="${escapeHTML(fallback)}"
    alt="${escapeHTML(player.name)}"
  />`;
}
function attachPhotoFallback(container) {
  container.querySelectorAll('img[data-fallback]').forEach((image) => {
    image.addEventListener('error', () => {
      if (image.dataset.fallback) {
        image.src = image.dataset.fallback;
        image.dataset.fallback = '';
      } else if (image.classList.contains('player-photo')) {
        const placeholder = document.createElement('div');
        placeholder.className = 'player-placeholder';
        placeholder.textContent = 'CW';
        image.replaceWith(placeholder);
      } else {
        image.remove();
      }
    });
  });
}
function show(p) {
  document.getElementById('detail-title').textContent = `${p.number} ${p.name}`;
  const personId = p.personId || p.id;
  const linkedIds = new Set(roster.filter((player) => (player.personId || player.id) === personId).map((player) => player.id));
  const records = stats
    .filter((x) => linkedIds.has(x.playerId))
    .map((record) => ({
      ...record,
      game: games.find((g) => g.id === record.gameId) || {},
    }));
  const formerRecords = historyStats
    .filter((x) => linkedIds.has(x.playerId))
    .map((record) => ({
      ...record,
      game: {
        date: record.date,
        competition: `${record.teamName || '이전 소속'} · ${record.competition || '기타 대회'}`,
        opponent: record.opponent,
      },
    }));
  document.getElementById('detail-content').innerHTML = /* HTML */ `<div class="detail-grid">
      <div>${photoMarkup(p, false)}</div>
      <div class="profile-facts">
        <span class="profile-kicker">PLAYER PROFILE</span>
        <p class="profile-position">
          ${escapeHTML(p.position)} <span>· ${escapeHTML(p.grade)}학년</span>
        </p>
        <div class="profile-badges">
          <span>${escapeHTML(p.batsThrows || '투타 미등록')}</span
          ><span>${escapeHTML(p.height)}cm / ${escapeHTML(p.weight)}kg</span
          ><span>${escapeHTML(p.highSchool || '출신 고교 미등록')}</span>
        </div>
      </div>
    </div>
    <div class="record-filter">
      <div class="record-scope" role="group" aria-label="기록 범위">
        <button type="button" class="active" data-scope="all" aria-pressed="true">
          전체 기록 <small>${records.length + formerRecords.length}</small>
        </button>
        <button type="button" data-scope="current" aria-pressed="false">청운대 기록</button>
        <button type="button" data-scope="period" aria-pressed="false">기간 선택</button>
      </div>
      <div class="record-dates" hidden>
        <label>시작일 <input type="date" id="record-from" /></label>
        <span>~</span>
        <label>종료일 <input type="date" id="record-to" /></label>
      </div>
    </div>
    <div class="record-tabs" role="tablist" aria-label="선수 경기 기록">
      <button type="button" role="tab" aria-selected="${p.position !== '투수'}" data-role="batting">
        타자기록
      </button>
      <button
        type="button"
        role="tab"
        aria-selected="${p.position === '투수'}"
        data-role="pitching"
      >
        투수기록
      </button>
    </div>
    <div class="record-view-tabs" role="tablist" aria-label="기록 보기">
      <button type="button" data-view="summary" role="tab" aria-selected="true">기록 합계</button>
      <button type="button" data-view="recent" role="tab" aria-selected="false">최근 5경기</button>
      <button type="button" data-view="competition" role="tab" aria-selected="false">
        대회별 기록
      </button>
    </div>
    <div id="role-records" role="tabpanel"></div>`;
  const content = document.getElementById('detail-content');
  attachPhotoFallback(content);
  const dates = [...records, ...formerRecords]
    .map((r) => r.game.date)
    .filter(Boolean)
    .sort();
  if (dates.length) {
    content.querySelector('#record-from').value = dates[0];
    content.querySelector('#record-to').value = dates.at(-1);
  }
  let selectedRole = p.position === '투수' ? 'pitching' : 'batting';
  let selectedScope = 'all';
  let selectedView = 'summary';
  const showRole = (role) => {
    selectedRole = role;
    const from = content.querySelector('#record-from').value;
    const to = content.querySelector('#record-to').value;
    const activeRecords = (
      selectedScope === 'current' ? records : [...records, ...formerRecords]
    ).filter(
      (r) =>
        selectedScope !== 'period' ||
        (r.game.date && (!from || r.game.date >= from) && (!to || r.game.date <= to)),
    );
    content
      .querySelectorAll('[role="tab"]')
      .forEach((button) =>
        button.setAttribute('aria-selected', String(button.dataset.role === role)),
      );
    const filtered = activeRecords.filter((r) => role !== 'batting' || !(Number(r.batting?.order) > 9)).filter((r) =>
      role === 'batting'
        ? r.batting ||
          Number(r.atBats) ||
          Number(r.hits) ||
          Number(r.rbi) ||
          Number(r.runs) ||
          Number(r.homeRuns)
        : r.pitching || Number(r.inningsOuts) || r.inningsPitched,
    );
    const get = (r) => {
      const values = role === 'batting' ? r.batting || r : r.pitching || r;
      return role === 'pitching' && values.decisionStatsVersion !== 2
        ? { ...values, ...pitchingDecisionCounts(values.decision) } : values;
    };
    const columns =
      role === 'batting'
        ? [
            ['atBats', '타수'],
            ['hits', '안타'],
            ['runs', '득점'],
            ['rbi', '타점'],
            ['homeRuns', '홈런'],
          ]
        : [
            ['wins', '승'], ['losses', '패'], ['saves', '세이브'], ['holds', '홀드'],
            ['inningsOuts', '이닝'],
            ['battersFaced', '타자'],
            ['pitchCount', '투구수'],
            ['atBatsAgainst', '타수'],
            ['hitsAllowed', '피안타'],
            ['homeRunsAllowed', '피홈런'],
            ['walksAndHitByPitch', '4사구'],
            ['strikeouts', '삼진'],
            ['runsAllowed', '실점'],
            ['earnedRuns', '자책'],
          ];
    const total = (group, key) =>
      group.reduce(
        (sum, r) => sum + (Number(get(r)[key] ?? (key === 'pitchCount' ? get(r).pitches : 0)) || 0),
        0,
      );
    const outs = (group) =>
      group.reduce(
        (sum, r) =>
          sum + (Number(get(r).inningsOuts) || baseballInningsToOuts(get(r).inningsPitched) || 0),
        0,
      );
    const innings = (group) => `${Math.floor(outs(group) / 3)}.${outs(group) % 3}`;
    const rate = (group) =>
      role === 'batting'
        ? total(group, 'atBats')
          ? (total(group, 'hits') / total(group, 'atBats')).toFixed(3)
          : '—'
        : outs(group)
          ? ((total(group, 'earnedRuns') * 27) / outs(group)).toFixed(2)
          : '—';
    const summary = (group) =>
      columns.map(([key]) => {
        if (['wins', 'losses', 'saves', 'holds'].includes(key)) {
          const unknown = group.some((r) => get(r)[key] === null || get(r)[key] === undefined);
          const known = group.filter((r) => get(r)[key] !== null && get(r)[key] !== undefined);
          return unknown ? (known.length ? `${total(known, key)} + 미확인` : '미확인') : total(group, key);
        }
        return key === 'inningsOuts' ? innings(group) : total(group, key);
      });
    const table = (group, grouped = false) =>
      /* HTML */ `<div class="scroll-table">
        <table class="data-table detail-table">
          <thead>
            <tr>
              <th>${grouped ? '대회' : '날짜 · 상대'}</th>
              <th>경기</th>
              ${columns.map(([, label]) => /* HTML */ `<th>${label}</th>`).join('')}
              <th>${role === 'batting' ? '타율' : '평균자책점'}</th>
            </tr>
          </thead>
          <tbody>
            ${
              group.length
                ? grouped
                  ? [
                      ...group.reduce((map, r) => {
                        const key = r.game.competition || '기타 대회';
                        map.set(key, [...(map.get(key) || []), r]);
                        return map;
                      }, new Map()),
                    ]
                      .map(
                        ([name, entries]) =>
                          /* HTML */ `<tr>
                            <td>${escapeHTML(name)}</td>
                            <td>${entries.length}</td>
                            ${summary(entries)
                              .map((value) => /* HTML */ `<td>${escapeHTML(value)}</td>`)
                              .join('')}
                            <td>${rate(entries)}</td>
                          </tr>`,
                      )
                      .join('')
                  : group
                      .map(
                        (r) =>
                          /* HTML */ `<tr>
                            <td data-label="날짜 · 상대">
                              <span class="table-date">${escapeHTML(r.game.date || '—')}</span>
                              <span class="table-opponent"
                                >${r.teamName ? `${escapeHTML(r.teamName)} · ` : ''}${escapeHTML(r.game.opponent || '—')}</span
                              >
                            </td>
                            <td data-label="경기">1</td>
                            ${columns.map(([key, label]) => /* HTML */ `<td data-label="${escapeHTML(label)}">${escapeHTML(key === 'inningsOuts' ? get(r).inningsPitched || innings([r]) : (get(r)[key] ?? (key === 'pitchCount' ? get(r).pitches : '—')))}</td>`).join('')}
                            <td data-label="${role === 'batting' ? '타율' : '평균자책점'}">
                              ${escapeHTML(role === 'batting' ? get(r).battingAverage || rate([r]) : get(r).era || rate([r]))}
                            </td>
                          </tr>`,
                      )
                      .join('')
                : `<tr class="no-records"><td colspan="${columns.length + 3}">등록된 ${role === 'batting' ? '타자' : '투수'} 기록이 없습니다.</td></tr>`
            }
          </tbody>
        </table>
      </div>`;
    const sorted = [...filtered].sort((a, b) =>
      (b.game.date || '').localeCompare(a.game.date || ''),
    );
    const competitions = [
      ...filtered.reduce((map, record) => {
        const name = record.game.competition || '기타 대회';
        map.set(name, [...(map.get(name) || []), record]);
        return map;
      }, new Map()),
    ].sort((a, b) => a[0].localeCompare(b[0], 'ko'));
    const competitionCards = competitions.length
      ? competitions
          .map(
            ([name, entries]) => `<section class="competition-stat">
          <div class="competition-stat-head"><strong>${escapeHTML(name)}</strong><span>${entries.length}경기 · ${role === 'batting' ? '타율' : '평균자책점'} <b>${rate(entries)}</b></span></div>
          <div class="competition-metrics">${columns
            .map(
              ([key, label], index) =>
                `<div><small>${label}</small><strong>${escapeHTML(summary(entries)[index])}</strong></div>`,
            )
            .join('')}</div>
        </section>`,
          )
          .join('')
      : '<p class="empty">선택한 범위에 대회별 기록이 없습니다.</p>';
    content
      .querySelectorAll('[data-view]')
      .forEach((button) =>
        button.setAttribute('aria-selected', String(button.dataset.view === selectedView)),
      );
    const heading =
      selectedScope === 'all' ? '전체' : selectedScope === 'period' ? '선택 기간' : '청운대';
    const yearly = [
      ...filtered.reduce((map, record) => {
        const recordYear = record.game.date?.slice(0, 4) || '날짜 미등록';
        map.set(recordYear, [...(map.get(recordYear) || []), record]);
        return map;
      }, new Map()),
    ].sort((a, b) => b[0].localeCompare(a[0]));
    const yearCards = yearly.length
      ? yearly
          .map(
            ([recordYear, entries]) =>
              `<details class="year-stat"><summary><strong>${escapeHTML(recordYear)}${recordYear === '날짜 미등록' ? '' : '년'}</strong><span>${entries.length}경기 · ${role === 'batting' ? '타율' : '평균자책점'} <b>${rate(entries)}</b></span></summary><div class="competition-metrics">${columns.map(([key, label], index) => `<div><small>${label}</small><strong>${summary(entries)[index]}</strong></div>`).join('')}</div></details>`,
          )
          .join('')
      : '<p class="empty">연도별 기록이 없습니다.</p>';
    const summaryView = `<h3>${heading} 기록 합계</h3><div class="record-summary">
      <div><small>출장</small><strong>${filtered.length}</strong></div>
      <div><small>${role === 'batting' ? '타율' : '평균자책점'}</small><strong>${rate(filtered)}</strong></div>
      ${columns.map(([key, label], index) => `<div><small>${label}</small><strong>${summary(filtered)[index]}</strong></div>`).join('')}
    </div>${selectedScope === 'all' ? `<h3>연도별 기록</h3><div class="year-stats">${yearCards}</div>` : ''}`;
    const recentView = `<h3>${heading} 최근 5경기</h3>${table(sorted.slice(0, 5))}`;
    const competitionView = `<h3>${heading} 대회별 기록</h3><div class="competition-stats">${competitionCards}</div>`;
    document.getElementById('role-records').innerHTML =
      `${selectedScope === 'all' && formerRecords.length ? '<p class="scope-note">전체 기록에는 이전 소속 기록이 포함됩니다. 청운대 기록은 별도로 선택해 볼 수 있습니다.</p>' : ''}
      ${selectedView === 'recent' ? recentView : selectedView === 'competition' ? competitionView : summaryView}`;
  };
  content.querySelectorAll('[role="tab"]').forEach((button) => {
    if (button.dataset.role) button.addEventListener('click', () => showRole(button.dataset.role));
  });
  content.querySelectorAll('[data-view]').forEach((button) =>
    button.addEventListener('click', () => {
      selectedView = button.dataset.view;
      showRole(selectedRole);
    }),
  );
  content.querySelectorAll('[data-scope]').forEach((button) =>
    button.addEventListener('click', () => {
      selectedScope = button.dataset.scope;
      content.querySelectorAll('[data-scope]').forEach((item) => {
        const active = item === button;
        item.classList.toggle('active', active);
        item.setAttribute('aria-pressed', String(active));
      });
      content.querySelector('.record-dates').hidden = selectedScope !== 'period';
      showRole(selectedRole);
    }),
  );
  content
    .querySelectorAll('.record-dates input')
    .forEach((input) => input.addEventListener('change', () => showRole(selectedRole)));
  showRole(selectedRole);
  document.getElementById('detail').showModal();
}
