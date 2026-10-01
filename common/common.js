import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js';
export const firebaseConfig = {
  apiKey: 'AIzaSyBaSjDWV0MtsQ-ql9XuMQg8lRBVMuPObPU',
  authDomain: 'cwu-baseball.firebaseapp.com',
  databaseURL: 'https://cwu-baseball-default-rtdb.firebaseio.com',
  projectId: 'cwu-baseball',
  storageBucket: 'cwu-baseball.firebasestorage.app',
  messagingSenderId: '492761605175',
  appId: '1:492761605175:web:3e4a4debd2d367990ccbb2',
};
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app),
  storage = getStorage(app);
export {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  ref,
  uploadBytes,
  getDownloadURL,
};
export const root = new URL('../', import.meta.url);
export const link = (path) => new URL(path, root).href;
export const escapeHTML = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
export function compareUniformNumbers(a, b) {
  const numberOf = (player) => {
    const value = String(player.number ?? '').trim();
    const number = Number(value);
    return value !== '' && Number.isFinite(number) ? number : Infinity;
  };
  const first = numberOf(a);
  const second = numberOf(b);
  const byNumber = first === second ? 0 : first - second;
  return (
    byNumber ||
    Number(b.year || 0) - Number(a.year || 0) ||
    String(a.name || '').localeCompare(String(b.name || ''), 'ko')
  );
}
export function baseballInningsToOuts(value) {
  const text = String(value ?? '').trim();
  if (!text) return 0;
  const mixed = text.match(/^(\d+)\s+(1|2)\/3$/);
  if (mixed) return Number(mixed[1]) * 3 + Number(mixed[2]);
  const decimal = text.match(/^(\d+)(?:\.([012]))?$/);
  return decimal ? Number(decimal[1]) * 3 + Number(decimal[2] || 0) : null;
}
export function gameHref(id) {
  return link('results/results.html') + '#' + encodeURIComponent(id);
}
export const mainImagePath = 'image/main/main.jpg';
export function playerImagePath(player) {
  const year = String(player.year ?? '').trim();
  const number = String(player.number ?? '').trim();
  return /^\d{4}$/.test(year) && /^\d{1,3}$/.test(number)
    ? `image/players/${year}/${number}.jpg`
    : '';
}
function fillCompetitionMenu(games) {
  const menu = document.getElementById('competition-submenu');
  if (!menu) return;
  const years = [...new Set(games.map((game) => String(game.date || '').slice(0, 4)).filter((year) => /^\d{4}$/.test(year)))].sort().reverse();
  menu.innerHTML = years.length ? years.map((year) => {
    const competitions = [...new Set(games.filter((game) => String(game.date || '').startsWith(year)).map((game) => game.competition?.trim() || '기타 대회'))].sort((a, b) => a.localeCompare(b, 'ko'));
    return `<details class="competition-year"><summary>${escapeHTML(year)}년</summary><div>${competitions.map((name) => `<a href="${link('results/results.html')}?year=${encodeURIComponent(year)}&competition=${encodeURIComponent(name)}">${escapeHTML(name)}</a>`).join('')}</div></details>`;
  }).join('') : '<span class="menu-empty">등록된 경기가 없습니다.</span>';

}
export function mountShell() {
  document.getElementById('site-header').innerHTML = /* HTML */ `<div class="site-header">
    <div class="container header-inner">
      <a class="brand" href="${link('main.html')}"
        ><img
          class="brand-logo"
          src="${link('assets/cwu-logo.png')}"
          alt=""
          width="52"
          height="43"
        /><span>청운대 야구부</span></a
      ><button
        class="menu-toggle"
        aria-controls="site-nav"
        aria-expanded="false"
        aria-label="메뉴 열기"
      >
        ☰
      </button>
      <button class="nav-backdrop" type="button" tabindex="-1" aria-label="메뉴 닫기"></button>
      <nav id="site-nav" class="nav" aria-label="주 메뉴">
        <div class="mobile-nav-head">
          <strong>메뉴</strong
          ><button type="button" class="nav-close" aria-label="메뉴 닫기">×</button>
        </div>
        <div class="nav-group">
          <a class="nav-link" href="${link('players/players.html')}">선수 정보</a>
          <div class="submenu">
            ${['투수', '내야수', '외야수', '포수']
              .map(
                (position) =>
                  `<a href="${link('players/players.html')}?position=${encodeURIComponent(position)}">${position}</a>`,
              )
              .join('')}
          </div>
        </div>
        <div class="nav-group">
          <a class="nav-link" href="${link('results/results.html')}">경기 결과</a>
          <div class="submenu" id="competition-submenu">
            <span class="menu-empty">연도별 대회를 불러오는 중…</span>
          </div>
        </div>
        <div class="nav-group">
          <a class="nav-link" href="${link('schedule/schedule.html')}">경기 일정</a>
        </div>
        <div class="nav-group">
          <a class="nav-link" href="${link('gallery/gallery.html')}">기타</a>
        </div>
      </nav>
    </div>
  </div>`;
  document.getElementById('site-footer').innerHTML = /* HTML */ `<div class="site-footer">
    <div class="container footer-inner">
      <span>© daeng_shot. All rights reserved.</span><a href="${link('admin/admin.html')}">⚙</a>
    </div>
  </div>`;
  let b = document.querySelector('.menu-toggle'),
    n = document.querySelector('.nav');
  const closeMenu = () => {
    n.classList.remove('open');
    document.body.classList.remove('nav-open');
    b.setAttribute('aria-expanded', 'false');
    b.setAttribute('aria-label', '메뉴 열기');
  };
  b.onclick = () => {
    let o = n.classList.toggle('open');
    document.body.classList.toggle('nav-open', o);
    b.setAttribute('aria-expanded', String(o));
    b.setAttribute('aria-label', o ? '메뉴 닫기' : '메뉴 열기');
  };
  document.querySelector('.nav-backdrop').onclick = closeMenu;
  document.querySelector('.nav-close').onclick = closeMenu;
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && n.classList.contains('open')) closeMenu();
  });
  n.querySelectorAll('a').forEach((anchor) => {
    const target = new URL(anchor.href);
    if (
      target.pathname === location.pathname &&
      (!target.search || target.search === location.search)
    )
      anchor.setAttribute('aria-current', 'page');
  });
  n.addEventListener('click', (e) => {
    if (e.target.closest('a')) {
      closeMenu();
    }
  });
  void all('games')
    .then(fillCompetitionMenu)
    .catch((error) => console.error('대회 메뉴를 불러오지 못했습니다.', error));
}
export const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
export const dateText = (s) =>
  s
    ? new Date(s + 'T00:00:00').toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '날짜 미정';
let pendingGames;
export async function all(name) {
  if (name === 'games') {
    if (!pendingGames) {
      pendingGames = getDocs(collection(db, name))
        .then((snapshot) => snapshot.docs.map((d) => ({ id: d.id, ...d.data() })))
        .finally(() => {
          pendingGames = null;
        });
    }
    return pendingGames;
  }
  const snapshot = await getDocs(collection(db, name));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function uploadJpg(file, path) {
  if (!file) return '';
  if (path.startsWith('photos/') && file.size > 250000)
    throw Error('갤러리 사진은 장당 250KB 이하 JPG만 등록할 수 있습니다.');
  if (!/^image\/jpeg$/.test(file.type) || file.size > 8 * 1024 * 1024)
    throw Error('8MB 이하 JPG 파일만 등록할 수 있습니다.');
  const target = ref(storage, path + '.jpg');
  await uploadBytes(target, file, { contentType: 'image/jpeg' });
  return getDownloadURL(target);
}
