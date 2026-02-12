/* index.js */
import { db, storage } from './firebase/firebase.js'; 

document.addEventListener("DOMContentLoaded", () => {
    loadMainBanner();
    loadRecentPhotos();
    loadSchedule();
    loadLatestMatch();
});

// 1. 메인 배너 이미지 로드 (페이드인 효과 포함)
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

// 2. 최근 경기 사진 5개 로드
async function loadRecentPhotos() {
    const container = document.getElementById('recent-photos-grid');
    
    try {
        // 날짜 내림차순으로 경기 조회, 사진 있는 것만 추림
        const snapshot = await db.collection("match")
            .orderBy("date", "desc")
            .limit(10) // 넉넉히 가져옴 (어떤 경기는 사진이 없을 수 있으므로)
            .get();

        let photos = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.photo && Array.isArray(data.photo) && data.photo.length > 0) {
                // 각 경기의 첫 번째 사진(썸네일)만 가져옴
                photos.push(data.photo[0]);
            }
        });

        // 5개로 자르기
        const displayPhotos = photos.slice(0, 5);

        if (displayPhotos.length === 0) {
            container.innerHTML = `<div class="no-data" style="grid-column:1/-1;">등록된 사진이 없습니다.</div>`;
            return;
        }

        container.innerHTML = displayPhotos.map(url => `
            <img src="${url}" class="photo-item" alt="경기 사진" loading="lazy" onclick="window.open(this.src)">
        `).join('');

    } catch (error) {
        console.error("사진 로딩 오류:", error);
        container.innerHTML = `<div class="no-data" style="grid-column:1/-1;">사진을 불러오지 못했습니다.</div>`;
    }
}

// 3. 어제/오늘/내일 일정 로드
async function loadSchedule() {
    const container = document.getElementById('schedule-list');
    
    // 날짜 구하기 함수 (YYYY-MM-DD)
    const getDateStr = (addDay) => {
        const d = new Date();
        d.setDate(d.getDate() + addDay);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    const days = [
        { label: "어제", date: getDateStr(-1) },
        { label: "오늘", date: getDateStr(0), isToday: true },
        { label: "내일", date: getDateStr(1) }
    ];

    try {
        // 3일치 데이터 조회
        const snapshot = await db.collection("schedule")
            .where("date", ">=", days[0].date)
            .where("date", "<=", days[2].date)
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

            let contentHtml = `<span style="color:#ccc;">일정 없음</span>`;
            
            if (hasEvent) {
                contentHtml = events.map(e => {
                    let title = (e.status === 'event') ? `[행사] ${e.opponent}` : `vs ${e.opponent}`;
                    let loc = e.location ? `<span class="sch-sub">(${e.location})</span>` : "";
                    return `<div>${title} ${loc}</div>`;
                }).join('');
            }

            html += `
                <div class="${rowClass}">
                    <div class="sch-date-box">
                        <span class="sch-label">${dayInfo.label}</span>
                        ${dayInfo.isToday ? '<span class="sch-badge">TODAY</span>' : ''}
                        ${(!dayInfo.isToday && hasEvent) ? '<span style="font-size:20px; line-height:0.5; color:var(--brand-green);">.</span>' : ''}
                    </div>
                    <div class="sch-info">${contentHtml}</div>
                </div>
            `;
        });

        container.innerHTML = html;

    } catch (error) {
        console.error("일정 로딩 오류:", error);
        container.innerHTML = `<div class="no-data">일정 정보를 불러올 수 없습니다.</div>`;
    }
}

// 4. 최근 경기 기록 로드 (종료된 경기 1개)
async function loadLatestMatch() {
    const container = document.getElementById('latest-match-card');

    try {
        // 종료된 경기(win, loss, draw) 중 최신순
        const snapshot = await db.collection("match")
            .where("status", "in", ["win", "loss", "draw"])
            .orderBy("date", "desc")
            .limit(1)
            .get();

        if (snapshot.empty) {
            container.innerHTML = `<div class="no-data">최근 경기 기록이 없습니다.</div>`;
            return;
        }

        const doc = snapshot.docs[0];
        const data = doc.data();
        
        // 홈/어웨이 점수 판별
        let myScore = 0, oppScore = 0;
        let myTeam = "청운대", oppTeam = data.opponent;

        if (data.homeAway === 'home') { // 우리가 홈(말공격)
            myScore = data['home-run'] || 0;
            oppScore = data['away-run'] || 0;
        } else { // 우리가 원정(초공격)
            myScore = data['away-run'] || 0;
            oppScore = data['home-run'] || 0;
        }

        // 결과 태그
        let tagClass = "tag-draw";
        let tagText = "DRAW";
        if (data.status === 'win') { tagClass = "tag-win"; tagText = "WIN"; }
        else if (data.status === 'loss') { tagClass = "tag-loss"; tagText = "LOSE"; }

        // 날짜 포맷
        const dateShort = data.date.slice(5).replace('-', '.');

        container.innerHTML = `
            <div class="result-tag ${tagClass}">${tagText}</div>
            
            <div class="scoreboard-mini">
                <div class="sb-team">
                    <div class="sb-logo">LOGO</div>
                    <span class="sb-name">${myTeam}</span>
                </div>
                <div class="sb-score">${myScore} : ${oppScore}</div>
                <div class="sb-team">
                    <div class="sb-logo">VS</div>
                    <span class="sb-name">${oppTeam}</span>
                </div>
            </div>

            <div class="match-meta-info">
                ${dateShort} | ${data.title}<br>
                ${data.location}
            </div>
        `;

        // 카드 전체 클릭 시 이동 (선택사항)
        container.onclick = () => location.href = `match/match.html#${doc.id}`;
        container.style.cursor = "pointer";

    } catch (error) {
        console.error("경기 기록 로딩 오류:", error);
        container.innerHTML = `<div class="no-data">데이터 로딩 중 오류가 발생했습니다.<br>(콘솔 확인 필요)</div>`;
    }
}