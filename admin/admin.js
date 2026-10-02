import { battingAdditionalStats } from '../common/batting-stats.js';
import { pitchingDecisionCounts } from '../common/pitching-decision.js';
import { parseKbsaHtml } from '../common/kbsa-local.js';
import {
  mountShell,
  db,
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  uploadJpg,
  all,
  escapeHTML,
  compareUniformNumbers,
  baseballInningsToOuts,
  playerImagePath,
} from '../common/common.js';
import { writeBatch } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import {
  getFunctions,
  httpsCallable,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-functions.js';
mountShell();
const app = document.getElementById('app');
app.innerHTML =
  '<div class="desktop-only panel empty">관리자 화면은 PC에서만 사용할 수 있습니다.</div><div id="admin-app" class="admin-wrap"></div>';
const host = document.getElementById('admin-app');
let tab = 'games',
  editing = '',
  players = [],
  games = [],
  events = [],
  photos = [],
  stats = [],
  historyStats = [];
let pendingGameImport = null;
let pendingHistoryImport = null;
let recordEditing = '';
const defs = {
  stats: [
    'gameId',
    'playerId',
    'playerName',
    'position',
    'atBats',
    'hits',
    'rbi',
    'homeRuns',
    'inningsPitched',
    'strikeouts',
  ],
  players: [
    'name',
    'number',
    'year',
    'position',
    'height',
    'weight',
    'batsThrows',
    'highSchool',
    'grade',
  ],
  games: [
    'date',
    'time',
    'competition',
    'venue',
    'opponent',
    'status',
    'cwuScore',
    'opponentScore',
    'sourceGameId',
    'sourceUrl',
    'innings',
  ],
  events: ['date', 'title', 'description'],
  photos: ['photoTarget', 'date', 'caption'],
  history: [
    'date',
    'competition',
    'teamName',
    'wins', 'losses', 'saves', 'holds',
    'opponent',
    'playerId',
    'playerName',
    'plateAppearances', 'walks', 'hitByPitch',
    'atBats',
    'hits',
    'rbi',
    'homeRuns',
    'inningsPitched',
    'strikeouts',
  ],
};
const labels = {
  plateAppearances: '타석', walks: '볼넷', hitByPitch: '사구',
  wins: '승', losses: '패', saves: '세이브', holds: '홀드',
  playerId: '선수 ID (시즌-배번)',
  playerName: '선수 이름',
  atBats: '타수',
  hits: '안타',
  rbi: '타점',
  homeRuns: '홈런',
  inningsPitched: '투구 이닝',
  strikeouts: '탈삼진',
  name: '이름',
  number: '배번',
  year: '시즌 연도',
  position: '포지션',
  height: '키(cm)',
  weight: '몸무게(kg)',
  batsThrows: '투타',
  highSchool: '출신 고교',
  grade: '학년',
  date: '날짜',
  time: '시간',
  competition: '대회',
  venue: '장소',
  opponent: '상대팀',
  status: '경기 상태',
  cwuScore: '청운대 점수',
  opponentScore: '상대팀 점수',
  sourceGameId: '협회 경기 ID',
  sourceUrl: '출처 URL',
  innings: '이닝별 점수 JSON',
  title: '일정명',
  description: '설명',
  caption: '사진 설명',
  gameId: '연결 경기 ID',
  photoTarget: '사진 연결 일정',
  teamName: '당시 소속팀',
};
function latestPlayerChoices() {
  const sorted = [...players].sort((a, b) => Number(b.year) - Number(a.year) || compareUniformNumbers(a, b));
  const choices = [];
  for (const player of sorted) {
    const name = String(player.name || '').normalize('NFC').replace(/\s+/g, '');
    if (choices.some((other) => (other.personId || other.id) === (player.personId || player.id) ||
      (String(other.year) !== String(player.year) && String(other.name || '').normalize('NFC').replace(/\s+/g, '') === name))) continue;
    choices.push(player);
  }
  return choices;
}
const ACCESS_KEY = 'cwu-baseball-admin-open';
const ADMIN_PASSWORD = 'cwutest';

function login() {
  host.innerHTML = /* HTML */ `<div class="panel login">
    <h2>관리자 로그인</h2>
    <form id="login-form">
      <label class="field"
        >관리자 비밀번호
        <input name="password" type="password" autocomplete="current-password" required autofocus />
      </label>
      <p class="status" id="login-status" aria-live="polite"></p>
      <button class="btn">로그인</button>
    </form>
  </div>`;
  document.getElementById('login-form').onsubmit = (event) => {
    event.preventDefault();
    const password = String(new FormData(event.target).get('password') || '');
    if (password !== ADMIN_PASSWORD) {
      document.getElementById('login-status').textContent = '비밀번호를 확인해 주세요.';
      return;
    }
    sessionStorage.setItem(ACCESS_KEY, '1');
    draw();
    void refresh();
  };
}

if (sessionStorage.getItem(ACCESS_KEY) === '1') {
  draw();
  void refresh();
} else {
  login();
}

async function refresh() {
  try {
    [players, games, events, photos, stats, historyStats] = await Promise.all(
      ['players', 'games', 'events', 'photos', 'playerGameStats', 'playerHistoryStats'].map(all),
    );
    draw();
  } catch (e) {
    const body = document.getElementById('admin-body');
    if (body) {
      body.insertAdjacentHTML(
        'afterbegin',
        '<p class="preview-warning">DB를 읽지 못했습니다. Firebase 연결 상태와 공개 규칙 배포를 확인해 주세요.</p>',
      );
    }
    console.error(e);
  }
}
function draw() {
  let options = {
    games: '경기',
    events: '기타 일정',
    players: '선수',
    history: '이전 소속 기록',
    photos: '사진',
  };
  host.innerHTML = /* HTML */ `<div class="page-heading">
      <div>
        <span class="eyebrow">ADMIN</span>
        <h1>관리자 설정</h1>
      </div>
      <button id="logout" class="btn secondary">로그아웃</button>
    </div>
    <div class="tabs">
      ${Object.entries(options)
        .map(
          ([k, v]) =>
            /* HTML */ `<button data-tab="${k}" class="btn secondary ${tab === k ? 'active' : ''}">
              ${v}
            </button>`,
        )
        .join('')}
    </div>
    <div id="admin-body"></div>`;
  document.getElementById('logout').onclick = () => {
    sessionStorage.removeItem(ACCESS_KEY);
    login();
  };
  document.querySelectorAll('[data-tab]').forEach(
    (b) =>
      (b.onclick = () => {
        tab = b.dataset.tab;
        editing = '';
        recordEditing = '';
        pendingGameImport = null;
        draw();
      }),
  );
  drawBody();
}
function field(name, value = '') {
  let input =
    name === 'photoTarget' && tab === 'photos'
      ? `<select name="photoTarget" required><option value="">등록된 경기 또는 기타 일정 선택</option><optgroup label="경기">${[
          ...games,
        ]
          .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
          .map(
            (g) =>
              `<option value="game:${escapeHTML(g.id)}" data-date="${escapeHTML(g.date || '')}" ${value === `game:${g.id}` ? 'selected' : ''}>${escapeHTML(g.date || '날짜 미등록')} · ${escapeHTML(g.competition || '경기')} · vs ${escapeHTML(g.opponent || '상대 미등록')}</option>`,
          )
          .join('')}</optgroup><optgroup label="기타 일정">${[...events]
          .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
          .map(
            (e) =>
              `<option value="event:${escapeHTML(e.id)}" data-date="${escapeHTML(e.date || '')}" ${value === `event:${e.id}` ? 'selected' : ''}>${escapeHTML(e.date || '날짜 미등록')} · ${escapeHTML(e.title || '기타 일정')}</option>`,
          )
          .join('')}</optgroup></select>`
      : name === 'playerId' && tab === 'history'
        ? `<select name="playerId" required><option value="">현재 선수 선택</option>${latestPlayerChoices()
            .map(
              (p) =>
                `<option value="${escapeHTML(p.id)}" ${p.id === value ? 'selected' : ''}>${escapeHTML(p.year)} · #${escapeHTML(p.number)} ${escapeHTML(p.name)}</option>`,
            )
            .join('')}</select>`
        : name === 'position'
          ? /* HTML */ `<select name="position">
              <option>투수</option>
              <option>내야수</option>
              <option>외야수</option>
              <option>포수</option>
              <option>미지정</option>
            </select>`
          : name === 'status'
            ? /* HTML */ `<select name="status">
                <option value="scheduled">경기 예정</option>
                <option value="finished">경기 종료</option>
              </select>`
            : name === 'description' || name === 'innings'
              ? /* HTML */ `<textarea
                  name="${name}"
                  placeholder="${name === 'innings' ? '예: [{&quot;cwu&quot;:1,&quot;opponent&quot;:0}]' : ''}"
                >
${escapeHTML(value)}</textarea>`
              : /* HTML */ `<input
                  name="${name}"
                  type="${name === 'date' ? 'date' : name === 'time' ? 'time' : 'text'}"
                  value="${escapeHTML(value)}"
                  ${name === 'date' && tab === 'photos' ? 'readonly' : ''}
                  ${['name', 'number', 'year', 'date', 'title', 'opponent', 'playerId'].includes(name) || (name === 'playerName' && tab === 'stats') || (name === 'gameId' && tab === 'stats') ? 'required' : ''}
                />`;
  return /* HTML */ `<label class="field">${labels[name]}${input}</label>`;
}
function drawBody() {
  let body = document.getElementById('admin-body');
  let data = { games, events, players, stats, photos, history: historyStats }[tab],
    selected = data.find((x) => x.id === editing) || {},
    fields = defs[tab];
  if (tab === 'history' && selected.pitching && selected.pitching.decisionStatsVersion !== 2)
    selected = { ...selected, pitching: { ...selected.pitching, ...pitchingDecisionCounts(selected.pitching.decision) } };
  if (tab === 'players') data = [...data].sort(compareUniformNumbers);
  body.innerHTML = /* HTML */ `${
      (tab !== 'stats' && tab !== 'history') || editing
        ? `<div class="panel admin-panel">
      <h2>
        ${editing ? '수정' : '새로 등록'} ·
        ${{ games: '경기', events: '기타 일정', players: '선수', stats: '선수 경기 기록', history: '이전 소속 기록', photos: '사진' }[tab]}
      </h2>
      ${
        tab === 'games'
          ? /* HTML */ `<div class="actions">
                <label class="field" style="flex:1"
                  >협회 경기 URL<input
                    id="import-url"
                    type="url"
                    placeholder="https://www.korea-baseball.com/game/record_detail?game_idx=..." /></label
                ><button class="btn secondary" id="import">경기·선수기록 불러오기</button>
              </div>
              <p class="hint">
                경기와 선수 기록을 확인한 뒤 아래 등록 버튼을 누르면 함께 저장됩니다.
              </p>
              <div class="local-import">
                <label class="field"
                  >함수가 없다면 기록 페이지에서 저장한 HTML 파일 선택<input
                    id="record-html"
                    type="file"
                    accept=".html,.htm,text/html" /></label
                ><button class="btn secondary" id="import-html" type="button">
                  HTML 파일에서 불러오기
                </button>
              </div>`
          : ''
      }${
        tab === 'players'
          ? /* HTML */ `<div class="actions">
                <label class="field"
                  >선수 엑셀 일괄 등록<input
                    id="roster-file"
                    type="file"
                    accept=".xls,.xlsx,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" /></label
                ><label class="field"
                  >시즌 연도<input
                    id="roster-year"
                    type="number"
                    min="2000"
                    max="2100"
                    value="2026" /></label
                ><button class="btn secondary" id="roster-preview-button">명단 미리보기</button>
              </div>
              <div id="roster-preview" class="hint"></div>`
          : ''
      }
      ${tab === 'games' ? '<div id="import-preview"></div>' : ''}
      <form id="entry-form">
        <div class="form-grid">
          ${fields.map((k) => field(k, k === 'photoTarget' ? (selected.gameId ? `game:${selected.gameId}` : selected.eventId ? `event:${selected.eventId}` : '') : k === 'innings' ? JSON.stringify(selected[k] || []) : tab === 'stats' || tab === 'history' ? (selected.batting?.[k] ?? selected.pitching?.[k] ?? selected[k] ?? '') : (selected[k] ?? ''))).join('')}${tab === 'players' || tab === 'photos' ? /* HTML */ `<label class="field wide">${tab === 'players' ? '선수' : '갤러리'} JPG<input type="file" name="photo" accept="image/jpeg" ${tab === 'photos' ? 'multiple' : ''} />${tab === 'players' ? '<small>로컬 image/players/년도/배번.jpg에 저장합니다. GitHub 배포 시 사진 파일도 올려 주세요.</small>' : '<small>JPG 여러 장을 선택할 수 있습니다. 각 사진은 250KB 이하로 준비해 주세요.</small>'}</label>` : ''}
        </div>
        <div class="actions">
          <button class="btn">${editing ? '수정 저장' : '등록'}</button
          >${editing ? '<button type="button" class="btn secondary" id="cancel">취소</button>' : ''}
        </div>
        <p class="status"></p>
      </form>
    </div>`
        : ''
    }
    ${['games', 'history'].includes(tab) ? bulkPitchingMarkup() : ''}
    ${tab === 'players' ? rosterLinksMarkup() : ''}
    ${tab === 'games' && recordEditing ? recordEditor() : ''}
    <div class="panel admin-panel">
      <h2>등록 목록</h2>
      <div class="admin-list">
        ${
          tab === 'stats' || tab === 'history'
            ? groupedRecords(data, tab === 'history')
            : data.length
              ? data
                  .map(
                    (x) =>
                      /* HTML */ `<div class="admin-item">
                          <span
                            ><strong
                              >${escapeHTML(x.name || x.playerName || x.title || x.opponent || x.caption || x.id)}</strong
                            ><br /><small
                              >${escapeHTML(x.date || x.year || '')} ·
                              ${escapeHTML(tab === 'games' ? [x.competition, x.venue].filter(Boolean).join(' · ') : tab === 'photos' ? games.find((g) => g.id === x.gameId)?.opponent || events.find((e) => e.id === x.eventId)?.title || '연결된 일정 없음' : x.id)}</small
                            ></span
                          >
                          <div class="actions">
                            <button class="btn secondary" data-edit="${escapeHTML(x.id)}">
                              수정</button
                            ><button class="btn danger" data-delete="${escapeHTML(x.id)}">
                              삭제
                            </button>
                          </div>
                        </div>
                        ${tab === 'games' ? gameRecordRows(x) : ''}`,
                  )
                  .join('')
              : '<div class="empty">등록된 항목이 없습니다.</div>'
        }
      </div>
    </div>`;
  if (tab === 'history' && !editing) {
    body.insertAdjacentHTML(
      'afterbegin',
      `<div class="panel admin-panel"><div class="history-import">
        <h3>이전 소속 경기에서 선수 기록 가져오기</h3>
        <p class="hint">고교 또는 편입 전 대학 기록을 현재 선수에게 연결합니다. 청운대 경기 일정·결과에는 추가되지 않습니다.</p>
        <div class="actions"><label class="field">협회 경기기록 URL<input id="history-url" type="url" placeholder="https://www.korea-baseball.com/game/record_detail?game_idx=..." /></label><button class="btn secondary" id="history-import" type="button">기록 불러오기</button></div>
        <div class="actions"><label class="field">저장한 경기기록 HTML<input id="history-html" type="file" accept=".html,.htm,text/html" /></label><button class="btn secondary" id="history-import-html" type="button">HTML에서 불러오기</button></div>
        <p id="history-status" class="status" aria-live="polite"></p><div id="history-preview"></div>
      </div></div>`,
    );
  }
  const photoTarget = document.querySelector('#entry-form select[name="photoTarget"]');
  photoTarget?.addEventListener('change', () => {
    const date = photoTarget.selectedOptions[0]?.dataset.date;
    if (date) document.querySelector('#entry-form [name="date"]').value = date;
  });
  if (photoTarget && !editing && !games.length && !events.length)
    document.querySelector('#entry-form .status').textContent =
      '먼저 경기 또는 기타 일정을 등록해 주세요.';
  if (document.getElementById('entry-form'))
    document.getElementById('entry-form').onsubmit = (e) =>
      save(e).catch((err) => {
        e.target.querySelector('.status').textContent = err.message;
        console.error(err);
      });
  document.getElementById('cancel')?.addEventListener('click', () => {
    editing = '';
    drawBody();
  });
  document.querySelectorAll('[data-edit]').forEach(
    (b) =>
      (b.onclick = () => {
        editing = b.dataset.edit;
        pendingGameImport = null;
        drawBody();
        document.getElementById('entry-form')?.scrollIntoView();
      }),
  );
  document.querySelectorAll('[data-delete]').forEach(
    (b) =>
      (b.onclick = async () => {
        if (!confirm('삭제할까요? 연결된 선수 기록과 사진은 별도로 남습니다.')) return;
        await act(body, async () => {
          await deleteDoc(
            doc(
              db,
              tab === 'stats' ? 'playerGameStats' : tab === 'history' ? 'playerHistoryStats' : tab,
              b.dataset.delete,
            ),
          );
          await refresh();
        });
      }),
  );
  document.querySelectorAll('[data-record-edit]').forEach((button) =>
    button.addEventListener('click', () => {
      recordEditing = button.dataset.recordEdit;
      drawBody();
      document.getElementById('record-edit-form')?.scrollIntoView({ block: 'center' });
    }),
  );
  document.querySelectorAll('[data-record-delete]').forEach((button) =>
    button.addEventListener('click', async () => {
      if (!confirm('이 선수의 경기 기록을 삭제할까요?')) return;
      await act(body, async () => {
        await deleteDoc(doc(db, 'playerGameStats', button.dataset.recordDelete));
        recordEditing = '';
        await refresh();
      });
    }),
  );
  document.getElementById('record-edit-form')?.addEventListener('submit', saveRecordEdit);
  document.getElementById('record-cancel')?.addEventListener('click', () => {
    recordEditing = '';
    drawBody();
  });
  document.getElementById('roster-preview-button')?.addEventListener('click', rosterPreview);
  document.getElementById('save-roster-links')?.addEventListener('click', saveRosterLinks);
  document.getElementById('bulk-stored-records')?.addEventListener('click', updateStoredRecordFields);
  document.getElementById('bulk-pitching-url')?.addEventListener('click', () => bulkUpdatePitching(false));
  document.getElementById('bulk-pitching-html')?.addEventListener('click', () => bulkUpdatePitching(true));
  document.getElementById('import')?.addEventListener('click', importGame);
  document.getElementById('import-html')?.addEventListener('click', importHtmlGame);
  document.getElementById('history-import')?.addEventListener('click', () => importHistory(false));
  document
    .getElementById('history-import-html')
    ?.addEventListener('click', () => importHistory(true));
  if (selected.position || selected.status) {
    let form = document.getElementById('entry-form');
    if (selected.position) form.position.value = selected.position;
    if (selected.status) form.status.value = selected.status;
  }
}
function rosterLinksMarkup() {
  const years = [...new Set(players.map((p) => String(p.year)))].sort().reverse();
  if (years.length < 2) return '';
  const current = players.filter((p) => String(p.year) === years[0]).sort(compareUniformNumbers);
  const earlier = players.filter((p) => String(p.year) !== years[0]);
  return `<div class="panel admin-panel"><h2>시즌별 동일 선수 연결</h2><p class="hint">이전 시즌 선수를 ${escapeHTML(years[0])}년 명단의 동일 선수에게 직접 연결하세요.</p><div class="roster-preview-table"><table><thead><tr><th>시즌</th><th>선수</th><th>출신교</th><th>최신 시즌 선수</th></tr></thead><tbody>${earlier.map((p) => `<tr><td>${escapeHTML(p.year)}</td><td>#${escapeHTML(p.number)} ${escapeHTML(p.name)}</td><td>${escapeHTML(p.highSchool || '—')}</td><td><select data-link-player="${escapeHTML(p.id)}"><option value="">연결 안 함</option>${current.map((c) => `<option value="${escapeHTML(c.id)}" ${p.personId === c.id ? 'selected' : ''}>#${escapeHTML(c.number)} ${escapeHTML(c.name)}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div><div class="actions"><button type="button" class="btn green" id="save-roster-links">선수 연결 저장</button></div><p id="roster-link-status" class="status"></p></div>`;
}
async function saveRosterLinks() {
  const status = document.getElementById('roster-link-status');
  const button = document.getElementById('save-roster-links');
  button.disabled = true;
  try {
    const batch = writeBatch(db);
    for (const select of document.querySelectorAll('[data-link-player]')) batch.set(doc(db, 'players', select.dataset.linkPlayer), {
      personId: select.value || select.dataset.linkPlayer, updatedAt: serverTimestamp(),
    }, { merge: true });
    await batch.commit();
    await refresh();
  } catch (e) { status.textContent = e.message; button.disabled = false; }
}
function groupedRecords(data, historical) {
  if (!data.length) return '<div class="empty">등록된 선수 기록이 없습니다.</div>';
  const groups = new Map();
  for (const record of data) {
    const game = historical ? record : games.find((g) => g.id === record.gameId) || {};
    const key = historical
      ? `${record.sourceGameId || record.gameId || record.id}:${record.teamName || ''}`
      : record.gameId;
    if (!groups.has(key)) groups.set(key, { game, records: [] });
    groups.get(key).records.push(record);
  }
  return [...groups.values()]
    .sort((a, b) => (b.game.date || '').localeCompare(a.game.date || ''))
    .map(
      ({ game, records }) => `<details class="record-group">
      <summary><span class="record-date">${escapeHTML(game.date || '날짜 미등록')}</span><strong>${escapeHTML(game.competition || '대회 미등록')}</strong><span>${escapeHTML(historical ? (game.teamName || '이전 소속') + ' vs ' + (game.opponent || '상대 미등록') : '청운대 vs ' + (game.opponent || '상대 미등록'))}</span><small>${records.length}명</small></summary>
      <div class="record-people">${records
        .sort((a, b) => (a.playerName || '').localeCompare(b.playerName || '', 'ko'))
        .map(
          (r) =>
            `<div class="admin-item"><span><strong>${escapeHTML(r.playerName || players.find((p) => p.id === r.playerId)?.name || '선수 미등록')}</strong><br><small>${escapeHTML(r.teamName || (historical ? '이전 소속' : '청운대'))} · 타수 ${escapeHTML(r.batting?.atBats ?? r.atBats ?? '—')} / 안타 ${escapeHTML(r.batting?.hits ?? r.hits ?? '—')} · 이닝 ${escapeHTML(r.pitching?.inningsPitched ?? r.inningsPitched ?? '—')}</small></span><div class="actions"><button class="btn secondary" data-edit="${escapeHTML(r.id)}">수정</button><button class="btn danger" data-delete="${escapeHTML(r.id)}">삭제</button></div></div>`,
        )
        .join('')}</div>
    </details>`,
    )
    .join('');
}
async function importHistory(fromHtml) {
  const status = document.getElementById('history-status');
  const preview = document.getElementById('history-preview');
  status.textContent = '경기 기록을 읽는 중…';
  preview.replaceChildren();
  pendingHistoryImport = null;
  try {
    const url = document.getElementById('history-url').value.trim();
    let gameIdx;
    let imported;
    if (fromHtml) {
      const file = document.getElementById('history-html').files[0];
      if (!file || !/\.html?$/i.test(file.name) || file.size > 2_000_000)
        throw Error('2MB 이하의 경기기록 HTML 파일을 선택해 주세요.');
      const html = await file.text();
      const fileId = html.match(/(?:record_detail|box_score)\?game_idx=(\d{1,10})/)?.[1];
      gameIdx = url ? gameIdFromUrl(url) : fileId;
      if (!gameIdx || (fileId && fileId !== gameIdx))
        throw Error('URL과 HTML의 경기 ID를 확인해 주세요.');
      imported = parseKbsaHtml(html, gameIdx, { includeAllTeams: true });
    } else {
      gameIdx = gameIdFromUrl(url);
      if (['localhost', '127.0.0.1'].includes(location.hostname)) {
        const response = await fetch('/api/preview-kbsa-game', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameIdx, mode: 'history' }),
        });
        imported = await response.json();
        if (!response.ok) throw Error(imported.error || '로컬 서버 기록 가져오기에 실패했습니다.');
      } else {
        const result = await httpsCallable(
          getFunctions(undefined, 'asia-northeast3'),
          'previewKbsaGame',
        )({ gameIdx, mode: 'history' });
        imported = result.data;
      }
    }
    if (!imported?.records?.length || !imported.game?.date)
      throw Error('경기 날짜와 선수 기록을 읽지 못했습니다.');
    const historicalChoices = imported.records.map((record, index) => ({ record, index }));
    const sameName = (a, b) =>
      String(a || '')
        .normalize('NFC')
        .replace(/\s+/g, '') ===
      String(b || '')
        .normalize('NFC')
        .replace(/\s+/g, '');
    historyStats = await all('playerHistoryStats');
    pendingHistoryImport = imported;
    const existingHistory = historyStats.filter((record) =>
      String(record.sourceGameId || '') === String(gameIdx) && record.date === imported.game.date);
    const existingForSource = (record) => {
      const candidates = existingHistory.filter((saved) =>
        sameName(saved.sourcePlayerName || saved.playerName, record.playerName) &&
        String(saved.teamName || '') === String(record.teamName || '') &&
        String(saved.sourceNumber ?? saved.number ?? '') === String(record.number || ''));
      return candidates.length === 1 ? candidates[0] : null;
    };
    const teamNames = [...new Set(imported.records.map((r) => r.teamName).filter(Boolean))];
    preview.innerHTML = `<div class="import-preview"><h3>${escapeHTML(imported.game.date)} · ${escapeHTML(imported.game.competition || '경기')}</h3><p class="hint">${teamNames.map(escapeHTML).join(' vs ')} · 원본 선수 ${imported.records.length}명</p>
      <p class="hint">이름·출신 학교로 자동 연결하지 않습니다. 각 행에서 현재 선수 명단을 직접 선택하세요. 기존 연결은 복원됩니다. 연결하지 않은 행의 기존 기록은 유지되며 새로 선택한 선수만 추가하거나 갱신합니다.</p>
      <div class="import-table-wrap"><table class="import-table history-import-table"><thead><tr><th>원본 소속</th><th>원본 선수</th><th>타자 기록</th><th>투수 기록</th><th>현재 명단 선수</th></tr></thead><tbody>
      ${historicalChoices
        .map(({ record: r, index }) => {
          const saved = existingForSource(r);
          const choices = latestPlayerChoices();
          const priorPlayer = players.find((p) => p.id === saved?.playerId);
          if (priorPlayer && !choices.some((p) => p.id === priorPlayer.id)) choices.unshift(priorPlayer);
          const matches = r.playerName ? choices.filter((p) => sameName(p.name, r.playerName)) : [];
          const others = choices.filter((p) => !sameName(p.name, r.playerName));
          const option = (p) => `<option value="${escapeHTML(p.id)}" ${p.id === saved?.playerId ? 'selected' : ''}>${escapeHTML(p.year)} · #${escapeHTML(p.number)} ${escapeHTML(p.name)}</option>`;
          return `<tr class="${matches.length ? 'history-name-match' : ''}"><td>${escapeHTML(r.teamName || '—')}</td><td><strong>#${escapeHTML(r.number || '—')} ${escapeHTML(r.playerName || '—')}</strong>${matches.length ? `<span class="name-match-badge">${matches.length > 1 ? `동명이인 ${matches.length}명 · 직접 확인` : '명단 이름 일치 · 직접 확인'}</span>` : ''}<small>${escapeHTML(r.position || '')}</small></td><td>${r.batting ? `타수 ${escapeHTML(r.batting.atBats ?? '—')} · 안타 ${escapeHTML(r.batting.hits ?? '—')}` : '—'}</td><td>${r.pitching ? `이닝 ${escapeHTML(r.pitching.inningsPitched || '—')} · 삼진 ${escapeHTML(r.pitching.strikeouts ?? '—')}` : '—'}</td><td><select data-history-index="${index}" aria-label="${escapeHTML(r.teamName || '')} ${escapeHTML(r.playerName || '')} 연결 선수"><option value="">연결하지 않음</option>${matches.length ? `<optgroup label="이름 일치 · 먼저 확인">${matches.map(option).join('')}</optgroup>` : ''}<optgroup label="그 외 선수">${others.map(option).join('')}</optgroup></select></td></tr>`;
        })
        .join('')}
      </tbody></table></div><div class="actions"><button type="button" class="btn" id="history-save">선택한 선수 기록 한 번에 저장</button></div></div>`;
    const saveButton = document.getElementById('history-save');
    saveButton.onclick = async () => {
      const selections = [...preview.querySelectorAll('select[data-history-index]')].filter(
        (select) => select.value,
      );
      if (!selections.length) {
        status.textContent = '연결할 현재 선수를 한 명 이상 선택해 주세요.';
        return;
      }
      const chosen = new Set();
      for (const select of selections) {
        if (chosen.has(select.value)) {
          status.textContent = '한 경기에서 같은 현재 선수를 두 번 연결할 수 없습니다.';
          return;
        }
        chosen.add(select.value);
        if (!players.some((player) => player.id === select.value)) {
          status.textContent = '현재 명단 선수를 다시 선택해 주세요.';
          return;
        }
      }
      status.textContent = `${selections.length}명 기록을 저장하는 중…`;
      saveButton.disabled = true;
      try {
        const batch = writeBatch(db);
        for (const select of selections) {
          const r = imported.records[Number(select.dataset.historyIndex)];
          const player = players.find((p) => p.id === select.value);
          const saved = existingForSource(r);
          const targetId = saved?.id || `kbsa-${gameIdx}_${player.id}`;
          const conflict = existingHistory.find((record) => record.playerId === player.id && record.id !== saved?.id);
          if (conflict) throw Error(`${player.name}: 이미 다른 원본 선수에게 연결된 기록이 있습니다. 기존 기록 수정에서 확인해 주세요.`);
          const opponent = teamNames.filter((t) => t !== r.teamName).join(' / ');
          batch.set(
            doc(db, 'playerHistoryStats', targetId),
            {
              ...r,
              gameId: `kbsa-${gameIdx}`,
              sourceGameId: String(gameIdx),
              sourceUrl: `https://www.korea-baseball.com/game/record_detail?game_idx=${gameIdx}`,
              sourceProvider: 'KBSA',
              playerId: player.id,
              playerName: player.name,
              sourcePlayerName: r.playerName,
              sourceNumber: r.number || '',
              date: imported.game.date,
              competition: imported.game.competition || '',
              opponent,
              teamName: r.teamName || '',
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          );
        }
        await batch.commit();
        pendingHistoryImport = null;
        await refresh();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        document
          .querySelector('#admin-body .admin-panel')
          ?.insertAdjacentHTML(
            'afterbegin',
            `<p class="pill">이전 소속 선수 기록 ${selections.length}명 저장 완료</p>`,
          );
      } catch (error) {
        saveButton.disabled = false;
        status.textContent = '저장하지 못했습니다: ' + error.message;
        console.error(error);
      }
    };
    status.textContent = '원본 기록을 확인하고 연결할 현재 선수만 선택해 주세요.';
  } catch (error) {
    const staleParser = /청운대 경기로 확인되지 않았습니다/.test(error.message);
    status.textContent = staleParser
      ? ['localhost', '127.0.0.1'].includes(location.hostname)
        ? '이전 버전 로컬 서버가 청운대 경기만 허용하고 있습니다. 서버 터미널에서 Ctrl+C로 종료한 뒤 새 프로젝트 폴더에서 node local-server.js를 다시 실행하고 페이지를 새로고침해 주세요. 저장한 HTML 파일로도 가져올 수 있습니다.'
        : '배포된 경기 가져오기 함수가 이전 버전입니다. 최신 Firebase 함수를 배포하거나 경기기록 HTML 파일에서 불러와 주세요.'
      : '기록을 불러오지 못했습니다: ' + error.message;
    console.error(error);
  }
}
async function act(form, fn) {
  let status = form.querySelector('.status') || document.querySelector('.status');
  status.textContent = '처리 중…';
  try {
    await fn();
    status.textContent = '저장했습니다.';
  } catch (e) {
    status.textContent = '처리하지 못했습니다: ' + e.message;
    console.error(e);
  }
}
function keyFor(type, v) {
  if (type === 'games' && v.sourceGameId) return 'kbsa-' + v.sourceGameId;
  if (type === 'stats') return `${v.gameId}_${v.playerId}`;
  if (type === 'history') return `${v.sourceGameId || crypto.randomUUID()}_${v.playerId}`;
  if (type === 'players') return `${v.year}-${String(v.number).replace(/[^0-9a-z가-힣-]/gi, '')}`;
  return crypto.randomUUID();
}
async function saveLocalImage(file, player) {
  if (!['localhost', '127.0.0.1'].includes(location.hostname))
    throw Error(
      '프로젝트 폴더의 사진 등록은 로컬 서버에서만 가능합니다. JPG를 image 폴더에 복사한 뒤 GitHub에 올려 주세요.',
    );
  if (file.type !== 'image/jpeg' || file.size > 8 * 1024 * 1024)
    throw Error('8MB 이하 JPG 파일을 선택해 주세요.');
  if (!playerImagePath(player))
    throw Error('선수 사진을 저장하려면 4자리 시즌 연도와 숫자 배번이 필요합니다.');
  const params = new URLSearchParams({ year: player.year, number: player.number });
  const response = await fetch(`/api/upload-image?${params}`, {
    method: 'POST',
    headers: { 'Content-Type': 'image/jpeg' },
    body: file,
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw Error(
      '사진 저장 API가 없습니다. Go Live 대신 node local-server.js로 페이지를 열어 주세요.',
    );
  }
  if (!response.ok) throw Error(result.error || '사진을 저장하지 못했습니다.');
  return result.path;
}
async function save(e) {
  e.preventDefault();
  let form = e.target,
    f = new FormData(form),
    v = Object.fromEntries(defs[tab].map((k) => [k, String(f.get(k) || '').trim()]));
  if (tab === 'photos') {
    const target = v.photoTarget;
    delete v.photoTarget;
    const [kind, targetId] = target.split(':');
    const item =
      kind === 'game'
        ? games.find((g) => g.id === targetId)
        : kind === 'event'
          ? events.find((e) => e.id === targetId)
          : null;
    if (!item) throw Error('등록된 경기 또는 기타 일정을 선택해 주세요.');
    v.gameId = kind === 'game' ? targetId : '';
    v.eventId = kind === 'event' ? targetId : '';
    v.date = item.date;
    const files = [...(form.photo?.files || [])];
    if (!editing && !files.length) throw Error('JPG 사진을 선택해 주세요.');
    if (editing && files.length > 1)
      throw Error('기존 사진 수정 시 JPG는 한 장만 교체할 수 있습니다.');
    for (const file of files)
      if (file.type !== 'image/jpeg' || file.size > 250000)
        throw Error(`${file.name}: 각 사진은 250KB 이하 JPG여야 합니다.`);
    await act(form, async () => {
      if (editing) {
        const old = photos.find((p) => p.id === editing) || {};
        const url = files.length ? await uploadJpg(files[0], `photos/${editing}`) : old.url;
        await setDoc(
          doc(db, 'photos', editing),
          { ...old, ...v, url, updatedAt: serverTimestamp() },
          { merge: true },
        );
      } else {
        for (const file of files) {
          const id = crypto.randomUUID();
          const url = await uploadJpg(file, `photos/${id}`);
          await setDoc(doc(db, 'photos', id), { ...v, url, updatedAt: serverTimestamp() });
        }
      }
      editing = '';
      await refresh();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      document
        .querySelector('#admin-body .admin-panel')
        ?.insertAdjacentHTML(
          'afterbegin',
          `<p class="pill">사진 ${files.length || 1}장 저장 완료</p>`,
        );
    });
    return;
  }
  if (tab === 'games') {
    if (pendingGameImport && v.sourceGameId !== pendingGameImport.game.sourceGameId)
      throw Error('가져온 경기 ID가 변경되었습니다. URL을 다시 불러와 주세요.');
    try {
      v.innings = JSON.parse(v.innings || '[]');
      if (!Array.isArray(v.innings)) throw Error();
    } catch {
      form.querySelector('.status').textContent = '이닝별 점수는 JSON 배열로 입력해 주세요.';
      return;
    }
    for (let k of ['cwuScore', 'opponentScore']) v[k] = v[k] === '' ? null : Number(v[k]);
    if (Object.values(v).some((x) => typeof x === 'number' && !Number.isFinite(x))) {
      form.querySelector('.status').textContent = '점수를 숫자로 입력해 주세요.';
      return;
    }
  }
  if (tab === 'stats' || tab === 'history') {
    if (
      (tab === 'stats' && !games.some((g) => g.id === v.gameId)) ||
      !players.some((p) => p.id === v.playerId)
    )
      throw Error('등록된 경기와 현재 명단의 선수를 선택해 주세요.');
    for (let k of ['atBats', 'hits', 'rbi', 'homeRuns', 'strikeouts'])
      v[k] = v[k] === '' ? 0 : Number(v[k]);
    for (const key of ['plateAppearances', 'walks', 'hitByPitch']) {
      if (!(key in v)) continue;
      v[key] = v[key] === '' ? null : Number(v[key]);
      if (v[key] !== null && (!Number.isInteger(v[key]) || v[key] < 0)) throw Error('타석·볼넷·사구는 0 이상의 정수로 입력해 주세요.');
    }
    v.inningsOuts = baseballInningsToOuts(v.inningsPitched);
    if (v.inningsOuts === null)
      throw Error('투구 이닝은 7, 2.1 또는 2 1/3 형식으로 입력해 주세요.');
    if (Object.values(v).some((x) => typeof x === 'number' && !Number.isFinite(x)))
      throw Error('기록 값을 확인해 주세요.');
  }
  if (tab === 'players') {
    for (let k of ['height', 'weight', 'grade']) v[k] = v[k] === '' ? '' : Number(v[k]);
  }
  const duplicateGame = tab === 'games' && v.sourceGameId
    ? games.find((game) => String(game.sourceGameId || '') === String(v.sourceGameId) && game.date === v.date)
    : null;
  let id = editing || duplicateGame?.id || keyFor(tab, v);
  await act(form, async () => {
    let old =
      { games, events, players, stats, photos, history: historyStats }[tab].find(
        (x) => x.id === id,
      ) || {};
    if (tab === 'stats' && editing) {
      const previous = stats.find((s) => s.id === id);
      if (previous?.batting)
        v.batting = {
          ...previous.batting,
          atBats: v.atBats,
          hits: v.hits,
          rbi: v.rbi,
          homeRuns: v.homeRuns,
        };
      if (previous?.pitching)
        v.pitching = {
          ...previous.pitching,
          inningsPitched: v.inningsPitched,
          inningsOuts: v.inningsOuts,
          strikeouts: v.strikeouts,
        };
    }
    if (tab === 'history') {
      const rosterPlayer = players.find((p) => p.id === v.playerId);
      v.playerName = rosterPlayer.name;
      if (pendingHistoryImport && !editing)
        throw Error('불러온 기록은 위 미리보기의 저장 버튼에서 등록해 주세요.');
      if (editing) {
        for (const key of ['wins', 'losses', 'saves', 'holds']) {
          v[key] = v[key] === '' ? null : Number(v[key]);
          if (v[key] !== null && (!Number.isInteger(v[key]) || v[key] < 0)) throw Error('승·패·세이브·홀드는 0 이상의 정수로 입력해 주세요.');
        }
        if (old.pitching) v.pitching = { ...old.pitching, wins: v.wins, losses: v.losses, saves: v.saves, holds: v.holds, decisionStatsVersion: 2 };
        if (old.batting)
          v.batting = {
            ...old.batting,
            plateAppearances: v.plateAppearances, walks: v.walks, hitByPitch: v.hitByPitch, battingStatsVersion: 2,
            atBats: v.atBats,
            hits: v.hits,
            rbi: v.rbi,
            homeRuns: v.homeRuns,
          };
        if (old.pitching)
          v.pitching = {
            ...(v.pitching || old.pitching),
            inningsPitched: v.inningsPitched,
            inningsOuts: v.inningsOuts,
            strikeouts: v.strikeouts,
          };
      }
    }
    if (
      tab === 'games' &&
      pendingGameImport &&
      v.sourceGameId === pendingGameImport.game.sourceGameId
    ) {
      if (!hasCompleteScoreboard(pendingGameImport.game))
        throw Error(
          '원본에서 R/H/E/B를 모두 읽지 못했습니다. 로컬 서버를 다시 실행하거나 최신 함수를 배포한 뒤 다시 가져와 주세요. HTML 파일 가져오기도 사용할 수 있습니다.',
        );
      if (v.date.slice(0, 4) !== pendingGameImport.year)
        throw Error('경기 날짜의 연도가 가져온 경기 연도와 다릅니다.');
      const selections = [
        ...document.querySelectorAll('#import-preview select[data-record-index]'),
      ];
      const chosen = new Set();
      const batch = writeBatch(db);
      batch.set(
        doc(db, 'games', id),
        {
          ...old,
          ...v,
          ...(Array.isArray(pendingGameImport.game.lineup)
            ? { lineup: pendingGameImport.game.lineup }
            : {}),
          ...(Array.isArray(pendingGameImport.game.pitchingLineup)
            ? { pitchingLineup: pendingGameImport.game.pitchingLineup }
            : {}),
          ...(pendingGameImport.game.scoreboard
            ? { scoreboard: pendingGameImport.game.scoreboard }
            : {}),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      for (const select of selections) {
        if (!select.value)
          throw Error('매칭되지 않은 선수를 명단에서 선택하거나 기록 제외를 선택해 주세요.');
        if (select.value === '__skip__') continue;
        if (chosen.has(select.value))
          throw Error('서로 다른 기록을 같은 선수에게 중복 연결할 수 없습니다.');
        chosen.add(select.value);
        const rosterPlayer = players.find((player) => player.id === select.value);
        if (!rosterPlayer) throw Error('연결한 선수를 찾지 못했습니다.');
        const record = pendingGameImport.records[Number(select.dataset.recordIndex)];
        batch.set(
          doc(db, 'playerGameStats', select.dataset.savedId || `${id}_${rosterPlayer.id}`),
          {
            ...record,
            gameId: id,
            playerId: rosterPlayer.id,
            playerName: rosterPlayer.name,
            sourcePlayerName: record.playerName,
            sourceNumber: record.number || '',
            sourceProvider: 'KBSA',
            sourceGameId: v.sourceGameId,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      }
      await batch.commit();
      const count = chosen.size;
      pendingGameImport = null;
      editing = '';
      await refresh();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      document
        .querySelector('#admin-body .admin-panel')
        ?.insertAdjacentHTML(
          'afterbegin',
          /* HTML */ `<p class="pill">경기와 선수 기록 ${count}건 저장 완료</p>`,
        );
      return;
    }
    if (form.photo?.files[0]) {
      if (tab === 'players') await saveLocalImage(form.photo.files[0], v);
      else v.url = await uploadJpg(form.photo.files[0], `photos/${id}`);
    }
    if (tab === 'photos' && !v.url && !old.url) throw Error('JPG 사진을 선택해 주세요.');
    await setDoc(
      doc(
        db,
        tab === 'stats' ? 'playerGameStats' : tab === 'history' ? 'playerHistoryStats' : tab,
        id,
      ),
      { ...old, ...v, updatedAt: serverTimestamp() },
      { merge: true },
    );
    editing = '';
    await refresh();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}
function parseCSV(text) {
  let rows = [],
    row = [],
    cell = '',
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    let c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((x) => String(x).trim())) rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => String(x).trim())) rows.push(row);
  if (quoted) throw Error('CSV 따옴표가 닫히지 않았습니다.');
  return rows;
}
const columnAliases = {
  name: ['성명', '이름'],
  number: ['백넘버', '배번', '등번호'],
  height: ['신장', '키'],
  weight: ['체중', '몸무게'],
  batsThrows: ['투타', '우투우타', '투타유형'],
  position: ['포지션', '수비위치'],
  highSchool: ['출신교', '출신 고교', '출신고교', '고교'],
  grade: ['학년'],
  year: ['년도', '연도', '시즌'],
};
let pending = [];
let sheetLoader;
function loadSheetJS() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (sheetLoader) return sheetLoader;
  sheetLoader = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
    script.onload = () =>
      window.XLSX ? resolve(window.XLSX) : reject(Error('엑셀 읽기 도구를 불러오지 못했습니다.'));
    script.onerror = () => reject(Error('엑셀 읽기 도구를 불러오지 못했습니다.'));
    document.head.append(script);
  }).catch((e) => {
    sheetLoader = null;
    throw e;
  });
  return sheetLoader;
}
async function readRosterRows(file) {
  if (file.size > 5 * 1024 * 1024) throw Error('5MB 이하 명단 파일을 선택해 주세요.');
  if (/\.csv$/i.test(file.name)) return parseCSV((await file.text()).replace(/^\ufeff/, ''));
  if (!/\.xlsx?$/i.test(file.name)) throw Error('xls, xlsx 또는 csv 파일을 선택해 주세요.');
  const XLSX = await loadSheetJS();
  const book = XLSX.read(await file.arrayBuffer(), {
    type: 'array',
    dense: true,
  });
  if (!book.SheetNames.length) throw Error('시트를 찾을 수 없습니다.');
  return XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], {
    header: 1,
    defval: '',
    raw: false,
    blankrows: false,
  });
}
function normalizedHeader(s) {
  return String(s ?? '')
    .replace(/\s+/g, '')
    .trim();
}
function cleanMeasure(s, unit) {
  let value = String(s ?? '')
    .trim()
    .replace(new RegExp(unit + '$', 'i'), '')
    .trim();
  if (!value) return '';
  if (!/^\d+(?:\.\d+)?$/.test(value)) throw Error(`${unit} 값이 숫자가 아닙니다: ${s}`);
  return Number(value);
}
async function rosterPreview() {
  const file = document.getElementById('roster-file').files[0],
    out = document.getElementById('roster-preview');
  if (!file) {
    out.textContent = '명단 파일을 선택해 주세요.';
    return;
  }
  out.textContent = '파일을 확인하는 중…';
  try {
    const year = String(document.getElementById('roster-year').value).trim();
    if (!/^20\d{2}$/.test(year)) throw Error('시즌 연도를 확인해 주세요.');
    const rows = await readRosterRows(file);
    if (rows.length < 2) throw Error('선수 데이터가 없습니다.');
    const headers = rows.shift().map(normalizedHeader);
    const indexes = Object.fromEntries(
      Object.entries(columnAliases).map(([key, aliases]) => [
        key,
        headers.findIndex((h) => aliases.some((a) => normalizedHeader(a) === h)),
      ]),
    );
    for (const k of ['name', 'number', 'position', 'grade'])
      if (indexes[k] < 0) throw Error(`필수 열이 없습니다: ${columnAliases[k][0]}`);
    const seen = new Set();
    pending = rows.map((row, i) => {
      const get = (k) => (indexes[k] < 0 ? '' : String(row[indexes[k]] ?? '').trim());
      const p = {
        name: get('name'),
        number: get('number').replace(/\.0$/, ''),
        year: get('year') || year,
        position: get('position'),
        height: cleanMeasure(get('height'), 'cm'),
        weight: cleanMeasure(get('weight'), 'kg'),
        batsThrows: get('batsThrows'),
        highSchool: get('highSchool'),
        grade: cleanMeasure(get('grade'), '학년'),
      };
      const line = i + 2;
      if (!p.name || !p.number || !p.position)
        throw Error(`${line}행의 성명·백넘버·포지션을 확인해 주세요.`);
      if (!['투수', '내야수', '외야수', '포수', '미지정'].includes(p.position))
        throw Error(`${line}행의 포지션을 확인해 주세요: ${p.position}`);
      if (!/^20\d{2}$/.test(p.year)) throw Error(`${line}행의 연도를 확인해 주세요.`);
      if (seen.has(keyFor('players', p))) throw Error(`${line}행에 중복된 시즌·백넘버가 있습니다.`);
      seen.add(keyFor('players', p));
      return p;
    });
    if (!pending.length) throw Error('등록할 선수가 없습니다.');
    out.innerHTML = /* HTML */ `<p>
        <strong>${escapeHTML(file.name)}</strong> · ${pending.length}명 · ${escapeHTML(year)}년
      </p>
      <p>기존 같은 시즌·배번 선수는 명단 정보만 갱신하며 사진과 기록은 보존합니다.</p>
      <div class="roster-preview-table">
        <table>
          <thead>
            <tr>
              <th>성명</th>
              <th>배번</th>
              <th>포지션</th>
              <th>학년</th>
              <th>투타</th>
              <th>신장</th>
              <th>체중</th>
              <th>출신교</th>
            </tr>
          </thead>
          <tbody>
            ${pending
              .map(
                (p) =>
                  /* HTML */ `<tr>
                    <td>${escapeHTML(p.name)}</td>
                    <td>${escapeHTML(p.number)}</td>
                    <td>${escapeHTML(p.position)}</td>
                    <td>${escapeHTML(p.grade)}</td>
                    <td>${escapeHTML(p.batsThrows || '—')}</td>
                    <td>${escapeHTML(p.height || '—')}</td>
                    <td>${escapeHTML(p.weight || '—')}</td>
                    <td>${escapeHTML(p.highSchool || '—')}</td>
                  </tr>`,
              )
              .join('')}
          </tbody>
        </table>
      </div>
      <div class="actions">
        <button id="roster-save" class="btn green">${pending.length}명 일괄 등록</button>
      </div>
      <p class="status" aria-live="polite"></p>`;
    document.getElementById('roster-save').onclick = saveRoster;
  } catch (e) {
    pending = [];
    out.textContent = e.message;
    console.error(e);
  }
}
async function saveRoster() {
  const out = document.getElementById('roster-preview'),
    button = document.getElementById('roster-save'),
    status = out.querySelector('.status');
  if (!pending.length) return;
  button.disabled = true;
  status.textContent = '등록 중…';
  try {
    const batch = writeBatch(db);
    for (const p of pending)
      batch.set(
        doc(db, 'players', keyFor('players', p)),
        { ...p, updatedAt: serverTimestamp() },
        { merge: true },
      );
    await batch.commit();
    const count = pending.length;
    pending = [];
    await refresh();
    const list = document.querySelector('#admin-body .admin-panel');
    list.insertAdjacentHTML('afterbegin', /* HTML */ `<p class="pill">${count}명 등록 완료</p>`);
  } catch (e) {
    status.textContent = '등록하지 못했습니다: ' + e.message;
    button.disabled = false;
    console.error(e);
  }
}
async function importGame() {
  const status = document.querySelector('#entry-form .status');
  pendingGameImport = null;
  document.getElementById('import-preview').replaceChildren();
  try {
    const gameIdx = gameIdFromUrl(document.getElementById('import-url').value);
    status.textContent = '경기와 선수 기록을 읽는 중…';
    const local = ['localhost', '127.0.0.1'].includes(location.hostname);
    if (local) {
      const response = await fetch('/api/preview-kbsa-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameIdx }),
      });
      let result;
      try {
        result = await response.json();
      } catch {
        throw Error('로컬 서버가 실행되지 않았습니다. node local-server.js로 다시 열어 주세요.');
      }
      if (!response.ok) throw Error(result.error || '로컬 기록 가져오기에 실패했습니다.');
      if (!hasCompleteScoreboard(result.game))
        throw Error(
          `현재 ${location.host}의 로컬 서버가 R/H/E/B를 보내지 않습니다. 해당 서버 터미널에서 Ctrl+C로 종료한 다음, 수정한 프로젝트 폴더에서 node local-server.js를 다시 실행하고 이 페이지를 새로고침해 주세요.`,
        );
      applyImportedGame(result);
    } else {
      const result = await httpsCallable(
        getFunctions(undefined, 'asia-northeast3'),
        'previewKbsaGame',
      )({ gameIdx });
      if (!hasCompleteScoreboard(result.data?.game))
        throw Error(
          '배포된 Firebase 가져오기 함수가 이전 버전입니다. 최신 functions를 배포하거나 협회 경기기록 HTML 파일로 가져와 주세요.',
        );
      applyImportedGame(result.data);
    }
  } catch (e) {
    status.textContent =
      e.code === 'functions/internal' || e.code === 'functions/not-found'
        ? 'URL 가져오기 함수가 배포되지 않았거나 실행에 실패했습니다. HTML 파일로 불러오거나 Firebase 함수 배포 상태를 확인해 주세요.'
        : '자동 가져오기에 실패했습니다: ' + e.message;
    console.error(e);
  }
}

function gameIdFromUrl(source) {
  const url = new URL(source);
  if (
    !['www.korea-baseball.com', 'korea-baseball.com'].includes(url.hostname) ||
    !['/game/box_score', '/game/record_detail'].includes(url.pathname) ||
    !/^\d{1,10}$/.test(url.searchParams.get('game_idx') || '')
  )
    throw Error('협회 경기요약 또는 경기기록 URL을 입력해 주세요.');
  return url.searchParams.get('game_idx');
}

async function importHtmlGame() {
  const status = document.querySelector('#entry-form .status');
  const file = document.getElementById('record-html').files[0];
  if (!file) {
    status.textContent = '저장한 경기기록 HTML 파일을 선택해 주세요.';
    return;
  }
  pendingGameImport = null;
  document.getElementById('import-preview').replaceChildren();
  try {
    if (file.size > 2_000_000 || !/\.html?$/i.test(file.name))
      throw Error('2MB 이하 HTML 파일을 선택해 주세요.');
    status.textContent = 'HTML 파일에서 선수 기록을 읽는 중…';
    const html = await file.text();
    const fileGameId = html.match(/(?:record_detail|box_score)\?game_idx=(\d{1,10})/)?.[1];
    const source = document.getElementById('import-url').value.trim();
    const gameIdx = source ? gameIdFromUrl(source) : fileGameId;
    if (!gameIdx || (fileGameId && fileGameId !== gameIdx))
      throw Error('URL의 경기 ID와 HTML 파일의 경기 ID가 다르거나 확인할 수 없습니다.');
    const imported = parseKbsaHtml(html, gameIdx);
    if (!hasCompleteScoreboard(imported.game))
      throw Error(
        '선택한 HTML 파일에서 R/H/E/B를 읽지 못했습니다. 협회 경기기록 전체 페이지를 다시 저장해 주세요.',
      );
    applyImportedGame(imported);
  } catch (error) {
    status.textContent = 'HTML 파일 가져오기에 실패했습니다: ' + error.message;
    console.error(error);
  }
}

function applyImportedGame(imported) {
  if (!imported?.game || !Array.isArray(imported.records) || !imported.records.length)
    throw Error('선수 기록을 찾지 못했습니다.');
  pendingGameImport = imported;
  editing = '';
  const form = document.getElementById('entry-form');
  for (const key of defs.games) {
    if (imported.game[key] !== undefined && imported.game[key] !== null && form.elements[key])
      form.elements[key].value =
        key === 'innings' ? JSON.stringify(imported.game[key]) : imported.game[key];
  }
  renderGameImportPreview(imported);
  const matched = [...document.querySelectorAll('#import-preview select[data-record-index]')]
    .filter((select) => select.value && select.value !== '__skip__').length;
  document.querySelector('#entry-form .status').textContent =
    `${imported.records.length}개 선수 기록 중 ${matched}개 명단 연결됨. 경기와 기록을 확인한 뒤 등록해 주세요.` +
    (!hasCompleteScoreboard(imported.game)
      ? ' 이 가져오기 결과에는 R/H/E/B가 없어 저장할 수 없습니다. 로컬 서버를 다시 실행하거나 최신 함수를 배포한 뒤 다시 가져와 주세요.'
      : '');
}

function hasCompleteScoreboard(game) {
  return ['cwu', 'opponent'].every((team) =>
    ['r', 'h', 'e', 'b'].every((key) => Number.isFinite(game.scoreboard?.[team]?.[key])),
  );
}

function renderGameImportPreview(imported) {
  const sameSeason = players.filter((player) => String(player.year) === imported.year);
  const olderGame = players.length > 0 && Number(imported.year) < Math.min(...players.map((p) => Number(p.year)));
  const roster = olderGame ? latestPlayerChoices() : sameSeason.sort(compareUniformNumbers);
  const existingGame = games.find((game) => String(game.sourceGameId || '') === String(imported.game.sourceGameId) && game.date === imported.game.date);
  const priorRecords = existingGame ? stats.filter((record) => record.gameId === existingGame.id) : [];
  const normalized = (value) =>
    String(value ?? '')
      .replace(/\s+/g, '')
      .trim();
  const rows = imported.records.map((record, index) => {
    const sourceMatches = (olderGame ? players : roster).filter(
      (player) => Number(player.number) === Number(record.number) &&
        normalized(player.name) === normalized(record.playerName),
    );
    const matches = olderGame
      ? roster.filter((player) => sourceMatches.some((source) =>
          (source.personId || source.id) === (player.personId || player.id) ||
          normalized(source.name) === normalized(player.name),
        ))
      : sourceMatches;
    const priorMatches = priorRecords.filter((saved) =>
      normalized(saved.sourcePlayerName || saved.playerName) === normalized(record.playerName) &&
      String(saved.sourceNumber ?? saved.number ?? '') === String(record.number || ''));
    const previous = priorMatches.length === 1 ? priorMatches[0] : null;
    const previousPlayer = players.find((player) => player.id === previous?.playerId);
    if (previousPlayer && !roster.some((player) => player.id === previousPlayer.id)) roster.push(previousPlayer);
    const matchId = previousPlayer?.id || (matches.length === 1 ? matches[0].id : '');
    const nameMatch = roster.some((player) => normalized(player.name) === normalized(record.playerName));
    const skipByDefault = !matchId && !nameMatch;
    const nameOnlyMatch = nameMatch && !matchId;
    const nameChoices = roster.filter((player) => normalized(player.name) === normalized(record.playerName));
    const otherChoices = roster.filter((player) => normalized(player.name) !== normalized(record.playerName));
    const choiceOption = (player) => `<option value="${escapeHTML(player.id)}" ${player.id === matchId ? 'selected' : ''}>${escapeHTML(player.year)} · #${escapeHTML(player.number)} ${escapeHTML(player.name)}</option>`;
    return /* HTML */ `<tr class="${nameOnlyMatch ? 'name-review' : ''}">
      <td>${escapeHTML(record.number)}</td>
      <td>${escapeHTML(record.playerName)}${nameOnlyMatch ? '<small class="name-review-badge">이름 일치 · 배번 확인</small>' : nameMatch ? '<small> · 이름·배번 일치</small>' : ''}</td>
      <td>
        ${escapeHTML(record.batting ? `${record.batting.order}번 · ${record.batting.entryType} · ${record.batting.position}` : '투수 전용')}
      </td>
      <td>
        ${escapeHTML(record.atBats)} / ${escapeHTML(record.hits)} / ${escapeHTML(record.rbi)} /
        ${escapeHTML(record.homeRuns)}
      </td>
      <td>
        ${record.pitching ? `${escapeHTML(record.pitching.inningsPitched)} / ${escapeHTML(record.pitching.strikeouts)} / ${escapeHTML(record.pitching.pitchCount)}구` : '—'}
      </td>
      <td>
        <select
          data-record-index="${index}"
          data-saved-id="${escapeHTML(previous?.id || '')}"
          class="${nameOnlyMatch ? 'name-review-select' : ''}"
          aria-label="${escapeHTML(record.playerName)} 명단 연결"
        >
          <option value="">명단 선수 선택</option>
          ${nameChoices.length ? `<optgroup label="이름 일치 · 먼저 확인">${nameChoices.map(choiceOption).join('')}</optgroup>` : ''}
          <optgroup label="그 외 선수">${otherChoices.map(choiceOption).join('')}</optgroup>
          <option value="__skip__" ${skipByDefault ? 'selected' : ''}>이 기록 제외</option>
        </select>
      </td>
    </tr>`;
  });
  document.getElementById('import-preview').innerHTML = /* HTML */ `<div class="import-preview">
    <h3>가져온 선수 기록 <span class="pill">${rows.length}명</span></h3>
    <p class="hint">
      스코어보드 R/H/E/B · 청운대
      ${['r', 'h', 'e', 'b'].map((key) => `${key.toUpperCase()} ${escapeHTML(imported.game.scoreboard?.cwu?.[key] ?? '—')}`).join(' / ')}
      · 상대팀
      ${['r', 'h', 'e', 'b'].map((key) => `${key.toUpperCase()} ${escapeHTML(imported.game.scoreboard?.opponent?.[key] ?? '—')}`).join(' / ')}
    </p>
    <p class="hint">
      ${olderGame ? `${escapeHTML(imported.year)}년 명단 없이 경기를 등록할 수 있습니다. 등록된 2025년 이후 선수에게 연결할 수 있습니다. 명단에 이름이 없는 기록은 자동으로 제외됩니다. 이름과 배번이 모두 일치하는 선수 한 명만 자동 선택됩니다. 저장 전 연결을 확인해 주세요.` : `${escapeHTML(imported.year)}년 선수 명단의 이름과 배번을 확인해 연결했습니다. 명단에 이름이 없는 기록은 자동 제외되며, 이름만 일치하는 항목은 직접 확인해 주세요.`}
    </p>
    <div class="import-table-wrap">
      <table class="import-table">
        <thead>
          <tr>
            <th>배번</th>
            <th>원본 선수</th>
            <th>타순 · 출전 · 수비</th>
            <th>타수 / 안타 / 타점 / 홈런</th>
            <th>투구 이닝 / 삼진 / 투구수</th>
            <th>등록 선수 연결</th>
          </tr>
        </thead>
        <tbody>
          ${rows.join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

function gameRecordRows(game) {
  const entries = stats
    .filter((record) => record.gameId === game.id)
    .sort((a, b) => (a.playerName || '').localeCompare(b.playerName || '', 'ko'));
  if (!entries.length) return '';
  return `<details class="game-records"><summary>선수 기록 ${entries.length}명 보기</summary><div class="record-people">
    ${entries.map((record) => `<div class="admin-item"><span><strong>${escapeHTML(record.playerName || players.find((p) => p.id === record.playerId)?.name || '선수 미등록')}</strong><br><small>타수 ${escapeHTML(record.batting?.atBats ?? record.atBats ?? '—')} · 안타 ${escapeHTML(record.batting?.hits ?? record.hits ?? '—')} / 이닝 ${escapeHTML(record.pitching?.inningsPitched ?? record.inningsPitched ?? '—')} · 삼진 ${escapeHTML(record.pitching?.strikeouts ?? record.strikeouts ?? '—')}</small></span><div class="actions"><button class="btn secondary" data-record-edit="${escapeHTML(record.id)}">기록 수정</button><button class="btn danger" data-record-delete="${escapeHTML(record.id)}">삭제</button></div></div>`).join('')}
  </div></details>`;
}
const recordFields = [
  ['plateAppearances', '타석', 'batting'], ['walks', '볼넷', 'batting'], ['hitByPitch', '사구', 'batting'],
  ['atBats', '타수', 'batting'],
  ['hits', '안타', 'batting'],
  ['runs', '득점', 'batting'],
  ['rbi', '타점', 'batting'],
  ['homeRuns', '홈런', 'batting'],
  ['wins', '승', 'pitching'], ['losses', '패', 'pitching'],
  ['saves', '세이브', 'pitching'], ['holds', '홀드', 'pitching'],
  ['inningsPitched', '이닝', 'pitching'],
  ['battersFaced', '타자', 'pitching'],
  ['pitchCount', '투구수', 'pitching'],
  ['atBatsAgainst', '타수', 'pitching'],
  ['hitsAllowed', '피안타', 'pitching'],
  ['homeRunsAllowed', '피홈런', 'pitching'],
  ['walksAndHitByPitch', '4사구', 'pitching'],
  ['strikeouts', '삼진', 'pitching'],
  ['runsAllowed', '실점', 'pitching'],
  ['earnedRuns', '자책', 'pitching'],
];
function recordEditor() {
  const record = stats.find((r) => r.id === recordEditing);
  if (!record) return '';
  const game = games.find((g) => g.id === record.gameId);
  const battingValues = record.batting?.battingStatsVersion === 2 ? record.batting : { ...record.batting, ...battingAdditionalStats(record.batting || record) };
  const pitchingValues = record.pitching?.decisionStatsVersion === 2 ? record.pitching : { ...record.pitching, ...pitchingDecisionCounts(record.pitching?.decision) };
  const roles = ['batting', 'pitching'].filter((role) =>
    role === 'batting'
      ? record.batting || Number(record.atBats) || Number(record.hits)
      : record.pitching || Number(record.inningsOuts) || record.inningsPitched,
  );
  if (!roles.length) roles.push(record.position === '투수' ? 'pitching' : 'batting');
  return `<div class="panel admin-panel record-editor"><h2>${escapeHTML(game?.date || '경기')} · ${escapeHTML(game?.opponent || '')} · ${escapeHTML(record.playerName || '')} 기록 수정</h2>
    <form id="record-edit-form"><div class="record-edit-groups">
    ${roles
      .map(
        (
          role,
        ) => `<fieldset><legend>${role === 'batting' ? '타자 기록' : '투수 기록'}</legend><div class="form-grid">
      ${recordFields
        .filter(([, , group]) => group === role)
        .map(
          ([key, label]) =>
            `<label class="field">${label}<input name="${key}" type="text" inputmode="${key === 'inningsPitched' ? 'decimal' : 'numeric'}" value="${escapeHTML((role === 'pitching' ? pitchingValues[key] : battingValues[key]) ?? record[key] ?? '')}" /></label>`,
        )
        .join('')}
    </div></fieldset>`,
      )
      .join(
        '',
      )}</div><div class="actions"><button class="btn">기록 저장</button><button type="button" class="btn secondary" id="record-cancel">취소</button></div><p class="status"></p></form>
  </div>`;
}
async function saveRecordEdit(event) {
  event.preventDefault();
  const form = event.target;
  const previous = stats.find((r) => r.id === recordEditing);
  if (!previous) return;
  const values = new FormData(form);
  const next = { ...previous, ...(previous.pitching ? { pitching: previous.pitching.decisionStatsVersion === 2 ? { ...previous.pitching } : { ...previous.pitching, ...pitchingDecisionCounts(previous.pitching.decision) } } : {}) };
  if (previous.batting) next.batting = previous.batting.battingStatsVersion === 2 ? { ...previous.batting } : { ...previous.batting, ...battingAdditionalStats(previous.batting) };
  try {
    for (const [key, label, role] of recordFields) {
      const raw = String(values.get(key) || '').trim();
      if (raw === '') continue;
      const value = key === 'inningsPitched' ? raw : Number(raw);
      if (key === 'inningsPitched') {
        const outs = baseballInningsToOuts(raw);
        if (outs === null) throw Error('투구 이닝은 7, 2.1 또는 2 1/3 형식으로 입력해 주세요.');
        next.inningsOuts = outs;
        next.pitching = { ...(next.pitching || {}), inningsOuts: outs };
      } else if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
        throw Error(`${label} 기록은 0 이상의 정수로 입력해 주세요.`);
      }
      next[key] = value;
      next[role] = { ...(next[role] || {}), [key]: value };
    }
    if (next.batting && Number(next.batting.atBats))
      next.batting.battingAverage = (
        Number(next.batting.hits || 0) / Number(next.batting.atBats)
      ).toFixed(3);
    if (next.pitching && Number(next.pitching.inningsOuts))
      next.pitching.era = (
        (Number(next.pitching.earnedRuns || 0) * 27) /
        Number(next.pitching.inningsOuts)
      ).toFixed(2);
    await act(form, async () => {
      if (next.batting) next.batting.battingStatsVersion = 2;
      if (next.pitching) next.pitching.decisionStatsVersion = 2;
      const { id, ...recordData } = next;
      await setDoc(
        doc(db, 'playerGameStats', previous.id),
        { ...recordData, updatedAt: serverTimestamp() },
        { merge: true },
      );
      recordEditing = '';
      await refresh();
    });
  } catch (error) {
    form.querySelector('.status').textContent = error.message;
  }
}

function bulkPitchingMarkup() {
  return `<details class="record-update-tools"><summary>기록 업데이트 도구</summary><div class="panel admin-panel"><h2>선수 기록 일괄 업데이트</h2>
    <p class="hint">등록된 ${tab === 'games' ? '청운대 경기' : '이전 소속 경기'} 저장된 타격 내용으로 전체 업데이트하거나 원본을 다시 읽어 타석·볼넷·사구와 투수 승·패·세이브·홀드를 갱신합니다. 선수 연결과 나머지 기록은 유지됩니다. 실패한 기록은 변경하지 않습니다.</p>
    <div class="actions"><button type="button" class="btn green" id="bulk-stored-records">저장된 청운대·이전 기록 전체 업데이트</button><button type="button" class="btn secondary" id="bulk-pitching-url">등록된 경기 원본 다시 읽기</button>
    <label class="field">저장한 경기 HTML 여러 개<input id="bulk-pitching-files" type="file" multiple accept=".html,.htm,text/html" /></label>
    <button type="button" class="btn secondary" id="bulk-pitching-html">선택한 HTML로 일괄 업데이트</button></div>
    <p id="bulk-pitching-status" class="status" aria-live="polite"></p><div id="bulk-pitching-results"></div></div></details>`;
}
async function readBulkGame(gameIdx, historical) {
  if (['localhost', '127.0.0.1'].includes(location.hostname)) {
    const response = await fetch('/api/preview-kbsa-game', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameIdx, mode: historical ? 'history' : 'game' }),
    });
    const data = await response.json();
    if (!response.ok) throw Error(data.error || '원본 읽기 실패');
    return data;
  }
  return (await httpsCallable(getFunctions(undefined, 'asia-northeast3'), 'previewKbsaGame')({
    gameIdx, mode: historical ? 'history' : 'game',
  })).data;
}
async function bulkUpdatePitching(fromFiles) {
  const historical = tab === 'history';
  const collectionName = historical ? 'playerHistoryStats' : 'playerGameStats';
  const status = document.getElementById('bulk-pitching-status');
  const results = document.getElementById('bulk-pitching-results');
  const controls = [...document.querySelectorAll('#bulk-stored-records, #bulk-pitching-url, #bulk-pitching-html, [data-tab]')];
  const files = [...(document.getElementById('bulk-pitching-files').files || [])];
  if (fromFiles && !files.length) { status.textContent = 'HTML 파일을 선택해 주세요.'; return; }
  controls.forEach((button) => button.disabled = true);
  results.replaceChildren();
  let updated = 0, failures = 0;
  const report = (message) => {
    const line = document.createElement('p'); line.textContent = message; results.append(line);
  };
  try {
    const [savedRecords, savedGames] = await Promise.all([all(collectionName), all('games')]);
    const groups = new Map();
    for (const record of savedRecords.filter((record) => record.pitching || record.batting)) {
      const game = historical ? record : savedGames.find((game) => game.id === record.gameId);
      const id = String(record.sourceGameId || game?.sourceGameId ||
        (record.sourceUrl || game?.sourceUrl || '').match(/game_idx=(\d+)/)?.[1] || '');
      if (!/^\d{1,10}$/.test(id)) { failures++; report(`${record.playerName || record.id}: 원본 경기 ID가 없어 유지했습니다.`); continue; }
      if (!groups.has(id)) groups.set(id, []);
      groups.get(id).push({ record, date: game?.date || record.date });
    }
    const tasks = fromFiles ? files : [...groups.keys()];
    if (!tasks.length) { status.textContent = '갱신할 등록 선수 기록이 없습니다.'; return; }
    for (let index = 0; index < tasks.length; index++) {
      const task = tasks[index];
      status.textContent = `${index + 1}/${tasks.length} 처리 중 · ${updated}건 갱신`;
      try {
        let id, imported;
        if (fromFiles) {
          if (task.size > 2_000_000) throw Error('HTML은 파일당 2MB 이하여야 합니다.');
          const html = await task.text();
          id = html.match(/game_idx=(\d{1,10})/)?.[1] || task.name.match(/(?:kbsa-|game[_-]?idx[_-]?)(\d+)/)?.[1];
          if (!id) throw Error('HTML에서 game_idx를 찾지 못했습니다. 원본 전체 페이지로 저장해 주세요.');
          imported = parseKbsaHtml(html, id, { includeAllTeams: historical });
        } else { id = task; imported = await readBulkGame(id, historical); }
        if (!groups.has(id)) throw Error(`경기 ${id}에 연결된 등록 선수 기록이 없습니다.`);
        const batch = writeBatch(db);
        let count = 0;
        for (const { record, date } of groups.get(id)) {
          if (date && date !== imported.game?.date) { failures++; report(`${id} · ${record.playerName}: 원본 날짜 불일치, 기존 기록 유지`); continue; }
          const norm = (value) => String(value || '').normalize('NFC').replace(/\s+/g, '');
          const matches = imported.records.filter((source) => (source.pitching || source.batting) &&
            norm(source.playerName) === norm(record.sourcePlayerName || record.playerName) &&
            String(source.number || '') === String(record.sourceNumber ?? record.number ?? '') &&
            (!historical || norm(source.teamName) === norm(record.teamName)));
          if (matches.length !== 1) { failures++; report(`${id} · ${record.playerName}: 원본 선수를 확정할 수 없어 기존 기록 유지`); continue; }
          const source = matches[0];
          const patch = { updatedAt: serverTimestamp() };
          if (source.batting && (record.batting || record.atBats != null) && !(Number(source.batting.order) > 9)) {
            const extra = battingAdditionalStats(source.batting);
            if (extra.plateAppearances != null) patch.batting = { ...(record.batting || Object.fromEntries(['atBats', 'hits', 'runs', 'rbi', 'homeRuns'].filter((key) => record[key] !== undefined).map((key) => [key, record[key]]))), ...extra };
          }
          if (source.pitching && record.pitching) {
            const counts = pitchingDecisionCounts(source.pitching.decision);
            if (!Object.values(counts).some((value) => value === null)) patch.pitching = { ...record.pitching, ...counts, decision: source.pitching.decision, decisionStatsVersion: 2 };
          }
          if (!patch.batting && !patch.pitching) { failures++; report(`${id} · ${record.playerName}: 추가 항목 미확인, 기존 기록 유지`); continue; }
          batch.set(doc(db, collectionName, record.id), patch, { merge: true });
          count++;
        }
        if (count) { await batch.commit(); updated += count; }
        report(`경기 ${id}: ${count}건 갱신`);
      } catch (error) { failures++; report(`${fromFiles ? task.name : task}: ${error.message}`); }
    }
    if (historical) historyStats = await all(collectionName);
    else stats = await all(collectionName);
    status.textContent = `완료 · ${updated}건 갱신 · ${failures}건 실패/미확인 (기존 기록 유지)`;
  } catch (error) { status.textContent = '업데이트 실패: ' + error.message; }
  finally { controls.forEach((button) => button.disabled = false); }
}

async function updateStoredRecordFields() {
  const status = document.getElementById('bulk-pitching-status');
  const results = document.getElementById('bulk-pitching-results');
  const controls = [...document.querySelectorAll('#bulk-stored-records, #bulk-pitching-url, #bulk-pitching-html, [data-tab]')];
  controls.forEach((button) => button.disabled = true);
  results.replaceChildren();
  let updated = 0, unknown = 0, unchanged = 0;
  try {
    for (const collectionName of ['playerGameStats', 'playerHistoryStats']) {
      const records = await all(collectionName);
      let batch = writeBatch(db), pending = 0;
      for (const record of records) {
        const patch = {};
        const batting = record.batting || (record.atBats != null ? Object.fromEntries(['atBats', 'hits', 'runs', 'rbi', 'homeRuns', 'events', 'plateAppearances', 'walks', 'hitByPitch', 'battingStatsVersion'].filter((key) => record[key] !== undefined).map((key) => [key, record[key]])) : null);
        if (batting && !(Number(batting.order) > 9)) {
          if (batting.battingStatsVersion !== 2) {
            const extra = battingAdditionalStats(batting);
            patch.batting = { ...batting, ...extra };
          }
          const values = patch.batting || batting;
          if (['plateAppearances', 'walks', 'hitByPitch'].some((key) => values[key] == null)) unknown++;
        }
        if (record.pitching && record.pitching.decisionStatsVersion !== 2) {
          const counts = pitchingDecisionCounts(record.pitching.decision);
          if (!Object.values(counts).some((value) => value === null)) patch.pitching = { ...record.pitching, ...counts, decisionStatsVersion: 2 };
        }
        if (!Object.keys(patch).length) { unchanged++; continue; }
        batch.set(doc(db, collectionName, record.id), { ...patch, updatedAt: serverTimestamp() }, { merge: true });
        pending++;
        if (pending === 400) {
          await batch.commit(); updated += pending; pending = 0; batch = writeBatch(db);
          status.textContent = `${updated}건 갱신 중`;
        }
      }
      if (pending) { await batch.commit(); updated += pending; }
    }
    [stats, historyStats] = await Promise.all([all('playerGameStats'), all('playerHistoryStats')]);
    status.textContent = `완료 · ${updated}건 갱신 · ${unchanged}건 유지 · 타자 ${unknown}건 미확인`;
    const line = document.createElement('p');
    line.textContent = '선수 연결과 기존 기록은 유지했습니다. 타격 내용이 없는 미확인 기록은 로컬 원본 다시 읽기 또는 HTML 일괄 업데이트로 보완해 주세요.';
    results.append(line);
  } catch (error) { status.textContent = `업데이트 중단 · ${updated}건 완료: ${error.message} · 다시 실행하면 이어서 처리됩니다.`; }
  finally { controls.forEach((button) => button.disabled = false); }
}
