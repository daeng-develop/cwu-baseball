/** * top menu와 side bar 기본 작성 
*/
async function draw_menu_tree() {

    /* common.js */
    // [자동 경로 감지]
    const pageName = window.location.pathname.split("/").pop();
    const isRoot = pageName === "" || pageName === "index.html";
    const pathPrefix = isRoot ? "" : "../"; // 루트면 그냥 쓰고, 아니면 한 단계 위로(../)


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
                                <li>
                                    <a href="${pathPrefix}match/match.html#250808">08.08 vs 경남대</a>
                                </li>
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
                                <span>2026 동계 훈련</span>
                                <button class="toggle-btn">▼</button>
                            </div>
                            
                            <ul class="top-menu-category-level3" style="display: none;">
                                <li>
                                    <a href="${pathPrefix}event/event.html#260102">01.02 기장</a>
                                </li>
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

            <li class="sidebar-category">
                <div class="sidebar-category-level1" onclick="toggle_category(this)">
                    <span class="sidebar-label">선수 정보</span>
                    <button class="toggle-btn">▼</button>
                </div>
                <ul class="sidebar-category-level2" style="display: none;">
                    <li><a href="${pathPrefix}player/player.html#pitcher">투수 (Pitcher)</a></li>
                    <li><a href="${pathPrefix}player/player.html#catcher">포수 (Catcher)</a></li>
                    <li><a href="${pathPrefix}player/player.html#infielder">내야수 (Infielder)</a></li>
                    <li><a href="${pathPrefix}player/player.html#outfielder">외야수 (Outfielder)</a></li>
                </ul>
            </li>

            <li class="sidebar-category">
                <div class="sidebar-category-level1" onclick="toggle_category(this)">
                    <span class="sidebar-label">경기 기록</span>
                    <button class="toggle-btn">▼</button>
                </div>
                <ul class="sidebar-category-level2" style="display: none;">
                    <li>
                        <div class="sidebar-category-level2-group">
                            <span class="sidebar-sub-label">공식 경기</span>
                            <button class="toggle-btn">▼</button>
                        </div>
                    </li>
                    <li>
                        <div class="sidebar-category-level2-group">
                            <span class="sidebar-sub-label">연습 경기</span>
                            <button class="toggle-btn">▼</button>
                        </div>
                    </li>
                </ul>
            </li>

            <li class="sidebar-category">
                <a href="${pathPrefix}schedule/schedule.html" class="sidebar-category-level1">
                    <span class="sidebar-label">경기 일정</span>
                </a>
            </li>

            <li class="sidebar-category">
                <div class="sidebar-category-level1">
                    <span class="sidebar-label">경기 외</span>
                    <button class="toggle-btn">▼</button>
                </div>
            </li>

        </ul>
    </div>
    `;

    // HTML을 body 맨 앞에 삽입
    document.body.insertAdjacentHTML('afterbegin', menu_tree_html);

    // ⭐ [핵심 수정] HTML이 그려진 직후에 사이드바 이벤트를 연결합니다.
    attachSidebarEvents();
}

async function draw_footer() {
    // [경로 계산 로직 추가]
    const pageName = window.location.pathname.split("/").pop();
    const isRoot = pageName === "" || pageName === "index.html";
    const pathPrefix = isRoot ? "" : "../"; 

    const footer_html =`
      <footer class="main-footer">
        <div class="footer-content">
            <p class="copyright">Copyright © 2026 daeng. All rights reserved.</p>
            <button class="admin-link-btn" onclick="location.href='${pathPrefix}admin/login.html'">⚙️</button>
        </div>
      </footer>
    `;

    document.body.insertAdjacentHTML('beforeend', footer_html);
}

// ⭐ 사이드바 이벤트 연결 함수 (draw_menu_tree 안에서 호출됨)
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

    // ⭐ [B] 추가된 기능: 사이드바 안의 링크(a 태그)를 누르면 사이드바 닫기
    if (sidebar) {
        // .sidebar-links 안에 있는 모든 a 태그(링크)를 찾음
        const links = sidebar.querySelectorAll('.sidebar-links a');
        
        links.forEach(link => {
            link.addEventListener('click', () => {
                // 링크를 클릭하면 'active' 클래스를 제거해서 사이드바를 숨김
                sidebar.classList.remove('active');
            });
        });
    }
}

/** 카테고리 클릭시 UI 동적 구성 */
/* 통합된 메뉴 토글 함수 */
function toggle_category(element) {
    // 1. 클릭한 요소 안에서 'toggle-btn' 이름을 가진 버튼을 찾음
    const btn = element.querySelector('.toggle-btn'); 
    
    // 2. 바로 다음 형제 요소(하위 메뉴 ul)를 찾음
    const submenu = element.nextElementSibling; 

    // 하위 메뉴가 없으면 아무것도 안 함
    if (!submenu) return;

    // 3. 열고 닫기 로직 (상단메뉴, 사이드바 모두 작동)
    const isClosed = submenu.style.display === "none" || submenu.style.display === "";

    if (isClosed) {
        submenu.style.display = "block"; // 혹은 flex
        if (btn) btn.innerText = "▲";   // 버튼이 있으면 화살표 변경
    } else {
        submenu.style.display = "none";
        if (btn) btn.innerText = "▼";
    }
}

// 페이지 로드 시 실행
document.addEventListener("DOMContentLoaded", () => {
   draw_menu_tree();
   draw_footer();
});