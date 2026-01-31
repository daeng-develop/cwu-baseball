/** * top menu와 side bar 기본 작성 */
async function draw_menu_tree() {

    /* common.js */
    const pageName = window.location.pathname.split("/").pop();
    const isRoot = pageName === "" || pageName === "index.html";

    const pathPrefix = isRoot ? "./" : "../"; 

    // 1. 메뉴 HTML을 먼저 정의합니다. (데이터가 들어갈 곳에 id 부여)
    const menu_tree_html =`
    <header class="top-menu"> 
        <button class="sidebar-btn" id="sidebar-open">☰</button>

        <a href="${pathPrefix}index.html" class="home-btn-link" style="text-decoration: none;">
            <div class="home-btn">청운대학교</div>
        </a>

        <ul class="top-menu-tree">
            <li class="top-menu-category">
                <div class="top-menu-category-level1" onclick="toggle_category(this)">
                    <span class="top-menu-category-lv1-label">선수 정보</span>
                    <button class="toggle-btn">▼</button>
                </div>
                <ul class="top-menu-category-level3" style="display: none;">
                    <li><a href="${pathPrefix}player/player.html#pitcher">투수 (Pitcher)</a></li>
                    <li><a href="${pathPrefix}player/player.html#catcher">포수 (Catcher)</a></li>
                    <li><a href="${pathPrefix}player/player.html#infielder">내야수 (Infielder)</a></li>
                    <li><a href="${pathPrefix}player/player.html#outfielder">외야수 (Outfielder)</a></li>
                </ul>
            </li>

            <li class="top-menu-category">
                    <div class="top-menu-category-level1" onclick="toggle_category(this)">
                        <span class="top-menu-category-lv1-label">경기 기록</span>
                        <button class="toggle-btn">▼</button>
                    </div>
                    <ul class="top-menu-category-level2" style="display: none;">
                        <li>
                            <div class="top-menu-category-level2-label" onclick="toggle_category(this)">
                                <span>제59회 대통령기 전국대학야구 대회</span>
                                <button class="toggle-btn">▼</button>
                            </div>
                            <ul class="top-menu-category-level3" style="display: none;">
                                <li><a href="${pathPrefix}match/match.html#250808">08.08 vs 경남대</a></li>
                            </ul>
                        </li>
                    </ul>
                </li>

            <li class="top-menu-category">
                <a href="${pathPrefix}schedule/schedule.html" class="top-menu-category-level1">
                    <span class="top-menu-category-lv1-label">경기 일정</span>
                </a>
            </li>

            <li class="top-menu-category">
                <div class="top-menu-category-level1" onclick="toggle_category(this)">
                    <span class="top-menu-category-lv1-label">경기 외</span>
                    <button class="toggle-btn">▼</button>
                </div>
            
                <ul class="top-menu-category-level2" style="display: none;">
                    
                    <li>
                        <div class="top-menu-category-level2-label" onclick="toggle_category(this)">
                            <span>2026년</span>
                            <button class="toggle-btn">▼</button>
                        </div>
                        
                        <ul class="top-menu-category-level3" id="event-list-2026" style="display: none;">
                            <li><span style="padding:10px; color:#999;">로딩 중...</span></li>
                        </ul>
                    </li>

                </ul>
            </li>
        </ul>
    </header>

    <div class="sidebar" id="sidebar">
        <div class="sidebar-header">
            <h2 class="sidebar-title">MENU</h2>
            <button class="sidebar-close-btn" id="sidebar-close">✕</button>
        </div>
        <ul class="sidebar-links">
             <li class="sidebar-category">
                <a href="${pathPrefix}index.html" class="sidebar-category-level1 single-link">
                    <span class="sidebar-label">홈</span>
                </a>
            </li>
            </ul>
    </div>
    `;

    // 2. HTML을 먼저 그립니다! (사용자는 메뉴를 바로 볼 수 있음)
    document.body.insertAdjacentHTML('afterbegin', menu_tree_html);
    attachSidebarEvents();

    // 3. 화면을 그린 '후'에 데이터를 가져옵니다.
    fillEventMenu(pathPrefix, "2026", "event-list-2026");
}

async function draw_footer() {
    // [경로 계산 로직 추가]
    const pageName = window.location.pathname.split("/").pop();
    const isRoot = pageName === "" || pageName === "index.html";
    const pathPrefix = isRoot ? "./" : "../";

    const footer_html = `
      <footer class="main-footer">
        <div class="footer-content">
            <p class="copyright">Copyright © 2026 daeng. All rights reserved.</p>
            <button class="admin-link-btn" onclick="location.href='${pathPrefix}admin/login.html'">⚙️</button>
        </div>
      </footer>
    `;

    document.body.insertAdjacentHTML('beforeend', footer_html);
}

// 사이드바 이벤트 연결 함수 (draw_menu_tree 안에서 호출됨)
function attachSidebarEvents() {
    const openBtn = document.getElementById('sidebar-open');
    const closeBtn = document.getElementById('sidebar-close');
    const sidebar = document.getElementById('sidebar');

    if (openBtn && sidebar) {
        openBtn.addEventListener('click', () => {
            sidebar.classList.add('active');
        });
    }

    if (closeBtn && sidebar) {
        closeBtn.addEventListener('click', () => {
            sidebar.classList.remove('active');
        });
    }

    if (sidebar) {
        // .sidebar-links 안에 있는 모든 a 태그(링크)를 찾음
        const links = sidebar.querySelectorAll('.sidebar-links a');

        links.forEach(link => {
            link.addEventListener('click', () => {
                sidebar.classList.remove('active');
            });
        });
    }
}

/** 카테고리 클릭시 UI 동적 구성 */
/* 통합된 메뉴 토글 함수 */
function toggle_category(element) {
    const btn = element.querySelector('.toggle-btn');
    const submenu = element.nextElementSibling;

    if (!submenu) return;

    const isClosed = submenu.style.display === "none" || submenu.style.display === "";

    if (isClosed) {
        submenu.style.display = "block";
        if (btn) btn.innerText = "▲";
    } else {
        submenu.style.display = "none";
        if (btn) btn.innerText = "▼";
    }
}

// ===============================================
// 특정 연도의 이벤트를 가져와서 UL 채우기
// ===============================================
async function fillEventMenu(pathPrefix, year, elementId) {
    const listElement = document.getElementById(elementId);
    if (!listElement) return;

    // 1. Firebase 로드
    let db;
    try {
        const module = await import(`${pathPrefix}firebase.js`);
        console.log("현재 firebase.js path :",module)
        db = module.db;
    } catch (error) {
        console.error("Firebase 로드 실패:", error);
        listElement.innerHTML = `<li><a href="#">연결 실패</a></li>`;
        return;
    }

    // 2. 데이터 조회
    try {
        const snapshot = await db.collection("event")
            .where("date", ">=", `${year}-01-01`)
            .where("date", "<=", `${year}-12-31`)
            .orderBy("date", "asc")
            .get();

        // 3. HTML 업데이트
        if (snapshot.empty) {
            listElement.innerHTML = `<li><span style="padding: 10px 15px; color: #999; font-size: 0.9em;">일정 없음</span></li>`;
            return;
        }

        let html = "";
        snapshot.forEach(doc => {
            const data = doc.data();
            const dateStr = data.date.slice(5).replace('-', '월 ') + '일'; // mm월 dd일
            html += `<li><a href="${pathPrefix}event/event.html#${doc.id}">${dateStr} ${data.title}</a></li>`;
        });

        listElement.innerHTML = html;

    } catch (error) {
        console.error("행사 목록 로딩 에러:", error);
        // 에러가 나면 조용히 실패하거나, 기존 '로딩 중'을 '에러'로 바꿈
        //listElement.innerHTML = `<li><a href="#">불러오기 오류 발생</a></li>`;
    }
}

// 페이지 로드 시 실행
document.addEventListener("DOMContentLoaded", () => {
    draw_menu_tree();
    draw_footer();
});