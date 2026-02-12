/* index.js */
import { db, storage } from './firebase/firebase.js'; 

document.addEventListener("DOMContentLoaded", () => {
    loadMainBanner();
    loadRecentActivityPhotos();
    loadSchedule5Days(); // 5일치 일정
    loadRecentMatchList(); // 최근 경기 리스트
});

// 1. 메인 배너 이미지 로드
async function loadMainBanner() {
    try {
        const bannerRef = storage.ref().child('index/main-banner.webp');
        const url = await bannerRef.getDownloadURL();

        const bannerImg = document.querySelector('.banner-img');
        if (bannerImg) {
            bannerImg.src = url;
            bannerImg.onload = () => {
                bannerImg.style.opacity = 1; 
            };
        }
    } catch (error) {
        console.error("배너 로드 실패:", error);
    }
}

// 2. 최근 활동(경기 + 행사) 사진 5개 로드
async function loadRecentActivityPhotos() {
    const container = document.getElementById('recent-photos-grid');
    
    try {
        const matchPromise = db.collection("match").orderBy("date", "desc").limit(10).get();
        const eventPromise = db.collection("event").orderBy("date", "desc").limit(10).get();

        const [matchSnap, eventSnap] = await Promise.all([matchPromise, eventPromise]);

        let allItems = [];
        
        // 데이터 처리 로직 (이전과 동일)
        const processData = (doc, type) => {
            const data = doc.data();
            if (data.photo && Array.isArray(data.photo) && data.photo.length > 0) {
                allItems.push({
                    type: type,
                    id: doc.id,
                    date: data.date,
                    title: type === 'match' ? `vs ${data.opponent}` : data.title,
                    location: data.location || '',
                    photos: data.photo.slice(0, 4)
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
            const typeLabel = item.type === 'match' ? '경기' : '행사';
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


// 3. ⭐ [수정] 일정 로드 (오늘 기준 -2일 ~ +2일)
async function loadSchedule5Days() {
    const container = document.getElementById('schedule-list');
    
    // 날짜 계산 함수
    const getDateStr = (addDay) => {
        const d = new Date();
        d.setDate(d.getDate() + addDay);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    // -2일 ~ +2일 날짜 배열 생성
    const days = [
        { label: getDateStr(-2).slice(5), date: getDateStr(-2), offset: -2 },
        { label: "어제", date: getDateStr(-1), offset: -1 },
        { label: "오늘", date: getDateStr(0), offset: 0, isToday: true },
        { label: "내일", date: getDateStr(1), offset: 1 },
        { label: getDateStr(2).slice(5), date: getDateStr(2), offset: 2 }
    ];

    try {
        // 날짜 범위 쿼리 (단일 필드 쿼리라 색인 오류 안 남)
        const snapshot = await db.collection("schedule")
            .where("date", ">=", days[0].date)
            .where("date", "<=", days[4].date)
            .get();

        let scheduleMap = {};
        snapshot.forEach(doc => {
            const data = doc.data();
            if (!scheduleMap[data.date]) scheduleMap[data.date] = [];
            scheduleMap[data.date].push(data);
        });

        let html = "";
        days.forEach(dayInfo => {
            const events = scheduleMap[dayInfo.date];
            const hasEvent = events && events.length > 0;
            const rowClass = dayInfo.isToday ? "sch-row today" : "sch-row";
            
            // 날짜 라벨 (오늘/내일/어제 아니면 MM-DD 표시)
            let dateLabel = dayInfo.label;
            if(dayInfo.offset === -2 || dayInfo.offset === 2) {
                dateLabel = dayInfo.date.slice(5).replace('-', '/');
            }

            let contentHtml = `<span style="color:#ccc; font-size:0.9em;">일정 없음</span>`;
            
            if (hasEvent) {
                contentHtml = events.map(e => {
                    const isEvent = (e.status === 'event');
                    let title = isEvent ? `[행사] ${e.opponent}` : `vs ${e.opponent}`;
                    let loc = e.location ? `<span class="sch-sub">(${e.location})</span>` : "";
                    return `<div>${title} ${loc}</div>`;
                }).join('');
            }

            html += `
                <div class="${rowClass}">
                    <div class="sch-date-box">
                        <span class="sch-label">${dateLabel}</span>
                        ${dayInfo.isToday ? '<span class="sch-badge">TODAY</span>' : ''}
                    </div>
                    <div class="sch-info">${contentHtml}</div>
                </div>
            `;
        });

        container.innerHTML = html;

    } catch (error) {
        console.error("일정 로딩 오류:", error);
        container.innerHTML = `<div class="no-data">일정 로딩 실패</div>`;
    }
}


// 4. ⭐ [수정] 최근 경기 기록 리스트 (5개) - 색인 오류 방지
async function loadRecentMatchList() {
    const container = document.getElementById('recent-match-list');

    try {
        // [핵심] where 조건 없이 날짜순으로만 10개 가져옴 (색인 오류 회피)
        // -> 가져온 다음 JS에서 필요한 만큼 자름
        const snapshot = await db.collection("match")
            .orderBy("date", "desc") // 최신순 정렬
            .limit(10) // 넉넉히 가져옴
            .get();

        if (snapshot.empty) {
            container.innerHTML = `<div class="no-data">경기 기록이 없습니다.</div>`;
            return;
        }

        let matchList = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            matchList.push({ id: doc.id, ...data });
        });

        // 5개만 자르기
        const displayList = matchList.slice(0, 5);

        // HTML 생성
        container.innerHTML = displayList.map(match => {
            // 상태별 텍스트 및 클래스 결정
            let statusText = "경기전";
            let statusClass = "status-before";

            switch(match.status) {
                case 'win': statusText = "승"; statusClass = "status-win"; break;
                case 'loss': statusText = "패"; statusClass = "status-loss"; break;
                case 'draw': statusText = "무"; statusClass = "status-draw"; break;
                case 'rain_cancel': 
                case 'etc_cancel': statusText = "취소"; statusClass = "status-cancel"; break;
                case 'before': statusText = "예정"; statusClass = "status-before"; break;
                default: statusText = match.status;
            }

            // 날짜 포맷 (MM.DD)
            const dateShort = match.date.slice(5).replace('-', '.');

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
        container.innerHTML = `<div class="no-data">데이터를 불러올 수 없습니다.</div>`;
    }
}