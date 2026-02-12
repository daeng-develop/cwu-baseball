/* menu.js */

// 현재 페이지 파일명을 가져옴
const pageName = window.location.pathname.split("/").pop();

// 메인 페이지(index.html 이거나 빈 값)면 "./", 아니면 "../" 설정
// 주의: 만약 github repository 이름이 경로에 포함된다면 로직 확인 필요
const isRoot = pageName === "" || pageName === "index.html";
const pathPrefix = isRoot ? "./" : "../"; 

console.log("Current Page:", pageName, "Prefix:", pathPrefix); // 디버깅용 로그

/** * top menu와 side bar 기본 작성 */
async function draw_menu_tree() {

    // [설정] 경기 외 년도별 메뉴
    const targetYears = ["2026"]; 


    // 1. [Top Menu용] 년도별 HTML 자동 생성
    const topMenuEventHtml = targetYears.map(year => `
        <li>
            <div class="top-menu-category-level2-label" onclick="toggle_category(this)">
                <span>${year}년</span>
                <button class="toggle-btn">▼</button>
            </div>
            <ul class="top-menu-category-level3" id="top-event-${year}" style="display: none;">
                <li><span style="padding:10px; color:#999;">로딩 중...</span></li>
            </ul>
        </li>
    `).join('');

    // 2. [Sidebar용] 년도별 HTML 자동 생성
    const sidebarEventHtml = targetYears.map(year => `
        <li>
            <div class="sidebar-category-level2-group" onclick="toggle_category(this)">
                <span class="sidebar-sub-label">${year}년</span>
                <button class="toggle-btn">▼</button>
            </div>
            <ul class="sidebar-category-level3" id="sidebar-event-${year}" style="display: none;">
                <li><span style="padding:10px; color:#999;">로딩 중...</span></li>
            </ul>
        </li>
    `).join('');


    // 3. 전체 메뉴 HTML 조립
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
                <ul class="top-menu-category-level2" id="top-match-menu" style="display: none;">
                    <li><span style="padding:10px; color:#999;">로딩 중...</span></li>
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
                    ${topMenuEventHtml} 
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
                <ul class="sidebar-category-level2" id="sidebar-match-menu" style="display: none;">
                    <li><span style="padding:10px; color:#999;">로딩 중...</span></li>
                </ul>
            </li>

            <li class="sidebar-category">
                <a href="${pathPrefix}schedule/schedule.html" class="sidebar-category-level1">
                    <span class="sidebar-label">경기 일정</span>
                </a>
            </li>

            <li class="sidebar-category">
                <div class="sidebar-category-level1" onclick="toggle_category(this)">
                    <span class="sidebar-label">경기 외</span>
                    <button class="toggle-btn">▼</button>
                </div>
                <ul class="sidebar-category-level2" style="display: none;">
                     ${sidebarEventHtml} 
                </ul>
            </li>
        </ul>
    </div>
    `;

    // 4. HTML 그리기
    document.body.insertAdjacentHTML('afterbegin', menu_tree_html);
    attachSidebarEvents();

    // 5. [데이터 채우기 실행]
    // (A) 경기 외 (이벤트)
    targetYears.forEach(year => {
        fillEventMenu(pathPrefix, year, `top-event-${year}`);
        fillEventMenu(pathPrefix, year, `sidebar-event-${year}`);
    });

    // (B) ⭐ 경기 기록 (Match List)
    fillMatchMenu(pathPrefix, "top-match-menu", false);      // Top Menu용
    fillMatchMenu(pathPrefix, "sidebar-match-menu", true);   // Sidebar용
}

async function draw_footer() {
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

function attachSidebarEvents() {
    const openBtn = document.getElementById('sidebar-open');
    const closeBtn = document.getElementById('sidebar-close');
    const sidebar = document.getElementById('sidebar');

    if (openBtn && sidebar) {
        openBtn.addEventListener('click', () => sidebar.classList.add('active'));
    }
    if (closeBtn && sidebar) {
        closeBtn.addEventListener('click', () => sidebar.classList.remove('active'));
    }
    if (sidebar) {
        const links = sidebar.querySelectorAll('.sidebar-links a');
        links.forEach(link => {
            link.addEventListener('click', () => sidebar.classList.remove('active'));
        });
    }
}

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
// [이벤트] 특정 연도의 행사 불러오기
// ===============================================
async function fillEventMenu(pathPrefix, year, elementId) {
    const listElement = document.getElementById(elementId);
    if (!listElement) return;

    let db;
    try {
        const module = await import("../firebase/firebase.js");
        db = module.db;
    } catch (error) {
        console.error("Firebase 로드 실패:", error);
        listElement.innerHTML = `<li><a href="#">연결 실패</a></li>`;
        return;
    }

    try {
        const snapshot = await db.collection("event")
            .where("date", ">=", `${year}-01-01`)
            .where("date", "<=", `${year}-12-31`)
            .orderBy("date", "asc")
            .get();

       // 1. 가져온 데이터 중 사진(photo)이 있는 것만 필터링
        const validEvents = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.photo && Array.isArray(data.photo) && data.photo.length > 0) {
                validEvents.push({ id: doc.id, ...data });
            }
        });

        // 2. 필터링된 결과가 없으면 '일정 없음' 표시
        if (validEvents.length === 0) {
            listElement.innerHTML = `<li><span style="padding: 10px 15px; color: #999; font-size: 0.9em;">일정 없음</span></li>`;
            return;
        }

        // 3. 사진이 있는 일정만 HTML로 생성
        let html = "";
        validEvents.forEach(data => {
            const dateStr = data.date.slice(5).replace('-', '월 ') + '일'; 
            html += `<li><a href="${pathPrefix}event/event.html#${data.id}">${dateStr} ${data.title}</a></li>`;
        });
        listElement.innerHTML = html;

    } catch (error) {
        console.error("행사 목록 로딩 에러:", error);
    }
}

// ===============================================
// ⭐ [경기 기록] 대회명(Level 2) -> 경기 목록(Level 3) 동적 생성
// ===============================================
async function fillMatchMenu(pathPrefix, elementId, isSidebar) {
    const container = document.getElementById(elementId);
    if (!container) return;

    let db;
    try {
        const module = await import("../firebase/firebase.js");
        db = module.db;
    } catch (error) {
        container.innerHTML = `<li><span style="padding:10px;">연결 실패</span></li>`;
        return;
    }

    try {
        const listDoc = await db.collection("match").doc("match-list").get();
        
        if (!listDoc.exists) {
            container.innerHTML = `<li><span style="padding:10px; color:#999;">대회 정보 없음</span></li>`;
            return;
        }

        const data = listDoc.data();
        const tournamentNames = data['match-name']; 

        if (!tournamentNames || tournamentNames.length === 0) {
            container.innerHTML = `<li><span style="padding:10px; color:#999;">등록된 대회가 없습니다.</span></li>`;
            return;
        }

        const htmlPromises = tournamentNames.map(async (tournament) => {
            const q = db.collection("match").where("title", "==", tournament);
            const snapshot = await q.get();

            let matches = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                
                // 1. 경기전(before) 상태는 기본적으로 제외
                if (data.status !== 'before') {
                    
                    // 2. 데이터 존재 여부 체크
                    const hasPhotos = data.photo && 
                          Array.isArray(data.photo) && 
                          data.photo.length > 0 && 
                          data.photo[0] !== "" && // 빈 문자열 체크
                          data.photo[0] !== null;  // null 체크
                    const hasScore = (data['home-score'] && data['home-score'].length > 0) || 
                                    (data['away-score'] && data['away-score'].length > 0);

                    // 3. ⭐ [조건 수정] 
                    // status가 'no_record'인 경우 -> 무조건 사진이 있어야 함
                    // 그 외(win, loss, draw 등) -> 사진이 있거나 스코어가 있어야 함
                    if (data.status === 'no_record') {

                        console.log("No Record Match Check:", doc.id, "Has Photos:", hasPhotos);
                        if (hasPhotos) {
                            matches.push({ id: doc.id, ...data });
                        }
                    } else {
                        if (hasPhotos || hasScore) {
                            matches.push({ id: doc.id, ...data });
                        }
                    }
                }
            });

            matches.sort((a, b) => b.date.localeCompare(a.date));

            let subItemsHtml = "";
            if (matches.length === 0) {
                subItemsHtml = `<li><span style="padding:10px; color:#999;">기록 없음</span></li>`;
            } else {
                matches.forEach(m => {
                    const dateShort = m.date ? m.date.slice(5).replace('-', '.') : '00.00'; 
                    subItemsHtml += `<li><a href="${pathPrefix}match/match.html#${m.id}">${dateShort} vs ${m.opponent}</a></li>`;
                });
            }

            if (isSidebar) {
                return `
                    <li>
                        <div class="sidebar-category-level2-group" onclick="toggle_category(this)">
                            <span class="sidebar-sub-label">${tournament}</span>
                            <button class="toggle-btn">▼</button>
                        </div>
                        <ul class="sidebar-category-level3" style="display: none;">
                            ${subItemsHtml}
                        </ul>
                    </li>
                `;
            } else {
                return `
                    <li>
                        <div class="top-menu-category-level2-label" onclick="toggle_category(this)">
                            <span>${tournament}</span>
                            <button class="toggle-btn">▼</button>
                        </div>
                        <ul class="top-menu-category-level3" style="display: none;">
                            ${subItemsHtml}
                        </ul>
                    </li>
                `;
            }
        });

        const htmlArray = await Promise.all(htmlPromises);
        container.innerHTML = htmlArray.join('');

    } catch (error) {
        console.error("경기 메뉴 로딩 에러:", error);
        container.innerHTML = `<li><span style="padding:10px;">불러오기 오류</span></li>`;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    draw_menu_tree();
    draw_footer();
});