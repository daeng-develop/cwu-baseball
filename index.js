/* index.js */
import { db, storage } from './firebase/firebase.js'; 

document.addEventListener("DOMContentLoaded", () => {
    loadRecentActivityPhotos();
    loadSchedule5Days(); // 5일치 일정
    loadRecentMatchList(); // 최근 경기 리스트
});

// 현재 적용된 배너 모드 저장 (중복 로드 방지용)
let currentBannerMode = ""; 

async function loadMainBanner() {
    try {
        const isMobile = window.innerWidth <= 768;
        const newMode = isMobile ? "mob" : "web";

        // ⭐ 이미 현재 모드에 맞는 이미지가 로드되어 있다면 중단 (무한 로딩 방지)
        if (currentBannerMode === newMode) return;
        
        currentBannerMode = newMode;
        const fileName = isMobile ? 'main-banner-mob.jpg' : 'main-banner-web.jpg';
        
        const bannerRef = storage.ref().child(`index/${fileName}`);
        const url = await bannerRef.getDownloadURL();

        const bannerImg = document.querySelector('.banner-img');
        if (bannerImg) {
            // 이미지 교체 시 자연스럽게 보이도록 투명도 조절
            bannerImg.style.opacity = 0; 
            
            bannerImg.src = url;
            bannerImg.onload = () => {
                bannerImg.style.opacity = 1; 
            };
        }
    } catch (error) {
        console.error("배너 로드 실패:", error);
    }
}

// ⭐ 화면 크기가 변할 때마다 배너 체크 (디바운싱 적용으로 성능 최적화)
let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        loadMainBanner();
    }, 200); // 0.2초 동안 크기 변화가 멈추면 실행
});

// 초기 로드 실행
loadMainBanner();


// 2. 최근 활동(경기 + 행사) 사진 5개 로드
async function loadRecentActivityPhotos() {
    const container = document.getElementById('recent-photos-grid');
    
    try {
        const matchPromise = db.collection("match").orderBy("date", "desc").limit(20).get();
        const eventPromise = db.collection("event").orderBy("date", "desc").limit(20).get();

        const [matchSnap, eventSnap] = await Promise.all([matchPromise, eventPromise]);

        let allItems = [];
        
        // 데이터 처리 로직 (이전과 동일)
        const processData = (doc, type) => {
            const data = doc.data();
            
            // 사진 데이터 존재 여부를 더 확실하게 체크
            const hasValidPhoto = data.photo && 
                                Array.isArray(data.photo) && 
                                data.photo.length > 0 && 
                                data.photo[0] !== ""; // 첫 번째 요소가 빈 값이 아니어야 함

            if (hasValidPhoto) {
                allItems.push({
                    type: type,
                    id: doc.id,
                    date: data.date,
                    title: type === 'match' ? `vs ${data.opponent}` : data.title,
                    location: data.location || '',
                    // 실제 값이 있는 사진만 골라내기 (빈 문자열 제거)
                    photos: data.photo.filter(p => p !== "").slice(0, 4)
                });
            }
        };

        matchSnap.forEach(doc => processData(doc, 'match'));
        eventSnap.forEach(doc => processData(doc, 'event'));

        allItems.sort((a, b) => (a.date < b.date ? 1 : -1));
        const displayItems = allItems.slice(0, 5);

        if (displayItems.length === 0) {
            container.innerHTML = `<div class="no-data" style="grid-column:1/-1;">최근 활동 사진이 없습니다.</div>`;
            return;
        }

        container.innerHTML = displayItems.map(item => {
            const linkUrl = (item.type === 'match') ? `match/match.html#${item.id}` : `event/event.html#${item.id}`;
            // 날짜 포맷 (안전 처리)
            const dateShort = (item.date && item.date.length >= 5) ? item.date.slice(5).replace('-', '.') : '';
            const displayTitle = item.title || '제목 없음';
            const displayLoc = item.location || '';
            const typeLabel = item.type === 'match' ? '경기' : '일정';
            const typeClass = item.type;

            let photoGridHtml = '';
            for (let i = 0; i < 4; i++) {
                if (item.photos[i]) {
                    photoGridHtml += `<img src="${item.photos[i]}" loading="lazy">`;
                } else {
                    photoGridHtml += `<div class="empty-photo"></div>`;
                }
            }

            return `
                <div class="photo-card" onclick="location.href='${linkUrl}'">
                    
                    <div class="img-wrapper">
                        ${photoGridHtml}
                        <span class="type-badge ${typeClass}">${typeLabel}</span>
                    </div>

                    <div class="card-info">
                        <div class="info-date">${dateShort}</div>
                        <div class="info-title">${displayTitle}</div>
                        <div class="info-loc">${displayLoc}</div>
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error("사진 로딩 오류:", error);
        container.innerHTML = `<div class="no-data">사진을 불러오지 못했습니다.</div>`;
    }
}


// 3. ⭐ [수정] 일정 로드 (오늘 기준 이전 일정 2개 ~ 이후 일정 2개)
async function loadSchedule5Days() {
    const container = document.getElementById('schedule-list');
    if (!container) return;

    // 오늘 날짜 구하기 (YYYY-MM-DD)
    const todayStr = new Date().toISOString().split('T')[0];

    try {
        // 1. 과거 일정 2개 (오늘 미만 날짜 중 최신순 2개)
        const pastSnapshot = await db.collection("schedule")
            .where("date", "<", todayStr)
            .orderBy("date", "desc")
            .limit(2)
            .get();

        // 2. 오늘 일정
        const todaySnapshot = await db.collection("schedule")
            .where("date", "==", todayStr)
            .get();

        // 3. 미래 일정 2개 (오늘 초과 날짜 중 가까운순 2개)
        const futureSnapshot = await db.collection("schedule")
            .where("date", ">", todayStr)
            .orderBy("date", "asc")
            .get(); // limit(2)를 바로 쓰면 색인 복합도가 높아질 수 있어 가져온 후 자릅니다.

        let allData = [];

        // 데이터 담기
        pastSnapshot.forEach(doc => allData.push(doc.data()));
        // 과거 데이터는 최신순(desc)으로 가져왔으므로 다시 날짜순 정렬을 위해 뒤집기 필요 없음 (나중에 전체 정렬)
        
        todaySnapshot.forEach(doc => allData.push(doc.data()));
        
        let futureCount = 0;
        futureSnapshot.forEach(doc => {
            if (futureCount < 2) {
                allData.push(doc.data());
                futureCount++;
            }
        });

        // 4. 수집된 데이터를 날짜순으로 정렬
        allData.sort((a, b) => a.date.localeCompare(b.date));

        if (allData.length === 0) {
            container.innerHTML = `<div class="no-data">표시할 일정이 없습니다.</div>`;
            return;
        }

        // 5. HTML 생성
        container.innerHTML = allData.map(e => {
            const isToday = e.date === todayStr;
            const rowClass = isToday ? "sch-row today" : "sch-row";
            
            // 날짜 표시 포맷 (MM/DD)
            const dateLabel = e.date.slice(5).replace('-', '/');
            
            const isEvent = (e.status === 'event');
            const title = isEvent ? `[행사] ${e.opponent}` : `vs ${e.opponent}`;
            
            // ⭐ [수정] 괄호()를 제거하고 장소 텍스트만 남김
            const location = e.location ? e.location : "";

            return `
                <div class="${rowClass}">
                    <div class="sch-date-box">
                        <span class="sch-label">${dateLabel}</span>
                        ${isToday ? '<span class="sch-badge">TODAY</span>' : ''}
                    </div>
                    
                    <div class="sch-info">
                        <div class="sch-title">${title}</div>
                        ${location ? `<div class="sch-location">${location}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error("일정 로딩 오류:", error);
        container.innerHTML = `<div class="no-data">일정을 불러올 수 없습니다.</div>`;
    }
}


// 4. ⭐ [수정] 최근 경기 기록 리스트 (5개) - 색인 오류 방지
async function loadRecentMatchList() {
    const container = document.getElementById('recent-match-list');
    if (!container) return;

    try {
        // 1. 경기 데이터를 가져옵니다.
        const snapshot = await db.collection("match")
            .orderBy("date", "desc")
            .limit(15) // 'before'를 제외하고 5개를 남기기 위해 여유 있게 가져옴
            .get();

        let matches = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            // 2. ⭐ 'before'(경기전) 상태가 아닌, 이미 진행된 경기만 필터링
            if (data.status !== 'before') {
                matches.push({ id: doc.id, ...data });
            }
        });

        // 3. 필터링된 데이터 중 최신 5개만 선택
        const displayMatches = matches.slice(0, 5).reverse();

        if (displayMatches.length === 0) {
            container.innerHTML = `<div class="no-data">최근 경기 기록이 없습니다.</div>`;
            container.style.overflowY = 'hidden';
            return;
        }

        container.innerHTML = displayMatches.map(match => {
            const dateShort = match.date.slice(5).replace('-', '.');
            let statusText = "";
            let statusClass = "";

            switch(match.status) {
                case 'win': statusText = "승"; statusClass = "status-win"; break;
                case 'loss': statusText = "패"; statusClass = "status-loss"; break;
                case 'draw': statusText = "무"; statusClass = "status-draw"; break;
                case 'no_record': statusText = "기록"; statusClass = "status-draw"; break; // 기록없음 대응
                case 'rain_cancel': 
                case 'etc_cancel': statusText = "취소"; statusClass = "status-cancel"; break;
                default: statusText = "종료"; statusClass = "status-cancel";
            }

            return `
                <div class="match-list-item" onclick="location.href='match/match.html#${match.id}'">
                    <div class="match-date-loc">
                        <span class="m-date">${dateShort}</span>
                        <span class="m-loc">${match.location || '-'}</span>
                    </div>
                    <div class="match-info-center">
                        <span class="m-title">${match.title}</span>
                        <span class="m-vs">vs ${match.opponent}</span>
                    </div>
                    <div class="match-result-badge ${statusClass}">
                        ${statusText}
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error("경기 리스트 로딩 오류:", error);
        container.innerHTML = `<div class="no-data">데이터 로딩 실패</div>`;
    }
}