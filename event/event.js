// event.js

// 1. 데이터 베이스 (해시태그를 키값으로 사용)
// 나중에 이 부분만 수정하면 내용이 바뀝니다.
const eventData = {
    '260102': {
        title: '01.02 기장 동계훈련',
        date: '2026. 01. 02 (금)',
        place: '기장 현대차 드림볼파크',
        // 테스트용 랜덤 이미지들 (높이가 제각각이어야 Masonry 효과가 잘 보임)
        images: [
            'https://picsum.photos/400/300',
            'https://picsum.photos/400/500',
            'https://picsum.photos/400/400',
            'https://picsum.photos/400/600',
            'https://picsum.photos/400/350',
            'https://picsum.photos/400/450',
            'https://picsum.photos/400/300'
        ]
    },
    // 다른 날짜 예시
    '260505': {
        title: '05.05 어린이날 행사',
        date: '2026. 05. 05 (화)',
        place: '홍성군청',
        images: [] 
    }
};

// 2. 렌더링 함수
function renderEventDetail() {
    // URL에서 해시태그 가져오기 (# 제거)
    const hash = window.location.hash.substring(1); // 예: "260102"

    // DOM 요소 가져오기
    const titleEl = document.getElementById('event-title');
    const metaEl = document.getElementById('event-meta');
    const galleryEl = document.getElementById('photo-gallery');

    // 데이터가 존재하는지 확인
    if (eventData[hash]) {
        const data = eventData[hash];

        // 텍스트 정보 넣기
        titleEl.textContent = data.title;
        
        // 요청하신 포맷: 날짜 | 장소 | 해시태그
        metaEl.textContent = `${data.date} | ${data.place} | #${hash}`;

        // 이미지 생성 및 넣기
        let imagesHtml = '';
        data.images.forEach(imgUrl => {
            imagesHtml += `
                <div class="photo-item">
                    <img src="${imgUrl}" alt="현장 사진">
                </div>
            `;
        });
        galleryEl.innerHTML = imagesHtml;

    } else {
        // 데이터가 없을 때 표시
        titleEl.textContent = "일정을 찾을 수 없습니다.";
        metaEl.textContent = `요청하신 코드: #${hash}`;
        galleryEl.innerHTML = '';
    }
}

// 3. 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', renderEventDetail);

// (선택) 해시태그가 바뀌었을 때도 다시 렌더링 (뒤로가기 등 대응)
window.addEventListener('hashchange', renderEventDetail);