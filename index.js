/* index.js */
import { db, storage } from './firebase.js'; 

// 메인 배너 이미지 불러오기 함수
async function loadMainBanner() {
    try {
        const bannerRef = storage.ref().child('index/main-banner.webp');
        const url = await bannerRef.getDownloadURL();

        const bannerImg = document.querySelector('.banner-img');
        if (bannerImg) {
            // 1. 이미지 주소 주입
            bannerImg.src = url;

            // 2. ⭐ [추가] 이미지가 실제로 로딩이 끝나면 보이게 설정
            bannerImg.onload = () => {
                bannerImg.style.opacity = 1; 
            };
        }

    } catch (error) {
        console.error("배너 로드 실패:", error);
    }
}
// 페이지 로드 시 바로 실행
loadMainBanner();