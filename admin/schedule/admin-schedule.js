/* admin/admin-schedule.js */

// 1. 설정 파일에서 db와 storage 가져오기
import { db, storage } from "../../firebase.js";

document.addEventListener("DOMContentLoaded", () => {
    // 1. 행사 등록 버튼 이벤트 연결
    const eventRegisterBtn = document.querySelector('.btn-register-event');
    if (eventRegisterBtn) {
        eventRegisterBtn.addEventListener('click', register_event);
    }

    // (참고) 경기 일정 등록 버튼 이벤트도 필요하다면 여기서 연결
    // const matchRegisterBtn = ...
});

// ==========================================
// 행사(Event) 등록 함수
// ==========================================
async function register_event() {
    console.log("행사 등록 시작...");

    // 1. 입력값 가져오기
    const dateInput = document.getElementById('event-date');
    const titleInput = document.getElementById('event-title');
    const locationInput = document.getElementById('event-location');
    const fileInput = document.getElementById('event-photos');

    const dateVal = dateInput.value; // "2026-01-31"
    const title = titleInput.value.trim();
    const location = locationInput.value.trim();
    const files = fileInput.files; // 파일 배열 (여러 장)

    // 2. 텍스트 유효성 검사
    if (!dateVal || !title || !location) {
        alert("날짜, 행사 이름, 장소를 모두 입력해주세요.");
        return;
    }

    // 3. 파일 유효성 검사 (여러 장을 반복문으로 확인)
    if (files.length === 0) {
        alert("최소 1장 이상의 사진을 등록해주세요.");
        return;
    }

    // 모든 파일이 조건을 만족하는지 미리 검사
    for (const file of files) {
        const fileName = file.name.toLowerCase();
        if (!fileName.endsWith('.jpg') && !fileName.endsWith('.jpeg')) {
            alert(`"${file.name}"은(는) 허용되지 않는 파일입니다.\n.jpg 또는 .jpeg 파일만 가능합니다.`);
            return;
        }
        const maxSize = 200 * 1024; // 200KB
        if (file.size > maxSize) {
            alert(`"${file.name}" 파일 크기가 200KB를 초과합니다.`);
            return;
        }
    }

    try {
        // 버튼 비활성화 (중복 클릭 방지)
        const registerBtn = document.querySelector('.btn-register-event');
        registerBtn.disabled = true;
        registerBtn.innerText = "등록 중...";

        // 4. 문서 ID 생성 (YYMMDD 형식)
        // 예: "2026-01-31" -> "260131"
        const yymmdd = dateVal.replaceAll('-', '').substring(2);
        
        console.log(`문서 ID 생성: ${yymmdd}`);

        // --- [1] 스토리지에 사진들 업로드 ---
        // 여러 장을 동시에 업로드하기 위해 Promise.all 사용
        const uploadPromises = Array.from(files).map(async (file) => {
            // 경로: event/260131/파일명.jpg
            const storagePath = `event/${yymmdd}/${file.name}`;
            
            // 업로드 (admin-player.js 스타일)
            const snapshot = await storage.ref(storagePath).put(file);
            // 다운로드 URL 가져오기
            return await snapshot.ref.getDownloadURL();
        });

        // 모든 업로드가 끝날 때까지 기다림
        const photoUrls = await Promise.all(uploadPromises);
        console.log("사진 업로드 완료:", photoUrls);


        // --- [2] 데이터베이스 저장 ---
        const eventData = {
            date: dateVal,       // "2026-01-31"
            title: title,        // "동계 훈련"
            location: location,  // "기장"
            photo: photoUrls,   // ["url1", "url2", ...]
        };

        // 컬렉션: event, 문서ID: yymmdd
        await db.collection("event").doc(yymmdd).set(eventData);

        alert(`[${dateVal}] ${title} 행사가 등록되었습니다!`);
        window.location.reload(); // 새로고침

    } catch (error) {
        console.error("에러 발생:", error);
        alert("등록 중 오류가 발생했습니다: " + error.message);
        
        // 버튼 원상복구
        const registerBtn = document.querySelector('.btn-register-event');
        if(registerBtn) {
            registerBtn.disabled = false;
            registerBtn.innerText = "행사 일정 등록하기";
        }
    }
}