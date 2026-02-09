/* event.js */

// 1. Firebase 설정 가져오기
import { db } from "../firebase.js";

document.addEventListener('DOMContentLoaded', () => {
    loadEventDetail();
    
    // 해시태그가 바뀌면(뒤로가기 등) 다시 로드
    window.addEventListener('hashchange', loadEventDetail);
});

async function loadEventDetail() {
    // 1. URL에서 문서 ID(해시태그) 가져오기
    const docId = window.location.hash.substring(1); // 예: "260102"

    // DOM 요소
    const titleEl = document.getElementById('event-title');
    const metaEl = document.getElementById('event-meta');
    const galleryEl = document.getElementById('photo-gallery');

    // 2. [UX 개선] 로딩 중 표시 (데이터 가져오는 동안 보여줄 화면)
    titleEl.textContent = ""; 
    metaEl.textContent = "데이터를 불러오는 중입니다...";
    galleryEl.innerHTML = '<div class="loader">잠시만 기다려주세요...</div>'; // CSS로 꾸미면 더 좋음

    if (!docId) {
        titleEl.textContent = "잘못된 접근입니다.";
        metaEl.textContent = "이벤트 ID가 없습니다.";
        galleryEl.innerHTML = "";
        return;
    }

    try {
        // 3. Firestore에서 데이터 가져오기
        const doc = await db.collection("event").doc(docId).get();

        if (!doc.exists) {
            titleEl.textContent = "삭제되었거나 존재하지 않는 행사입니다.";
            metaEl.textContent = "";
            galleryEl.innerHTML = "";
            return;
        }

        const data = doc.data();

        // 4. 데이터 바인딩 (화면에 표시)
        
        // 4-1. 제목
        titleEl.textContent = data.title;

        // 4-2. 날짜 및 장소 포맷팅
        // data.date (예: "2026-01-31") -> "2026년 01월 31일 토요일"
        const formattedDate = getFormattedDate(data.date);
        
        // 요청하신 포맷: 날짜 | 장소 (해시태그 제거됨)
        metaEl.textContent = `${formattedDate} | ${data.location}`;

        // 4-3. 사진 갤러리 생성 (배열: data.photo)
        // [성능 개선] 이미지가 없으면 메시지 표시
        if (!data.photo || data.photo.length === 0) {
            galleryEl.innerHTML = '<p class="no-photo">등록된 사진이 없습니다.</p>';
        } else {
            let imagesHtml = '';
            data.photo.forEach(imgUrl => {
                // [성능 개선] loading="lazy" 추가 -> 스크롤 할 때 로딩하여 초기 속도 향상
                imagesHtml += `
                    <div class="photo-item">
                        <img src="${imgUrl}" alt="현장 사진" loading="lazy">
                    </div>
                `;
            });
            galleryEl.innerHTML = imagesHtml;
        }

    } catch (error) {
        console.error("행사 상세 로딩 실패:", error);
        titleEl.textContent = "오류가 발생했습니다.";
        metaEl.textContent = "관리자에게 문의해주세요.";
        galleryEl.innerHTML = "";
    }
}

// [헬퍼 함수] 날짜 문자열을 "YYYY년 MM월 DD일 O요일" 로 변환
function getFormattedDate(dateString) {
    if (!dateString) return "";

    // 브라우저마다 날짜 파싱 이슈가 있을 수 있어 안전하게 분리
    const [year, month, day] = dateString.split('-');
    
    // Date 객체 생성 (월은 0부터 시작하므로 -1)
    const date = new Date(year, month - 1, day);
    
    // 요일 배열
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const dayName = days[date.getDay()];

    return `${year}년 ${month}월 ${day}일 ${dayName}요일`;
}