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

    // 페이지 열리면 행사 목록 바로 불러오기
    loadEventList();
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

// ==========================================
// 2. [신규] 행사 목록 불러오기 함수
// ==========================================
async function loadEventList() {
    const tableBody = document.getElementById('event-table-body');
    if (!tableBody) return; // 테이블이 없으면 중단 (경기 일정 탭 등)

    tableBody.innerHTML = `<tr><td colspan="4" style="padding:20px;">로딩 중...</td></tr>`;

    try {
        // 날짜 기준 내림차순 정렬 (최신 행사가 위로)
        const snapshot = await db.collection("event").orderBy("date", "desc").get();

        if (snapshot.empty) {
            tableBody.innerHTML = `<tr><td colspan="4" style="padding:20px;">등록된 행사가 없습니다.</td></tr>`;
            return;
        }

        let html = "";
        let count = 1; // 순서 번호 (1부터 시작)

        snapshot.forEach(doc => {
            const data = doc.data();
            const id = doc.id; // 문서 ID (예: 260131)

            html += `
                <tr>
                    <td>${count}</td>
                    <td>${data.date}</td>
                    <td class="text-left">${data.title}</td>
                    <td>
                        <button class="btn-list edit" onclick="alert('수정 기능 준비중')">수정</button>
                        <button class="btn-list delete" onclick="deleteEvent('${id}', '${data.title}')">삭제</button>
                    </td>
                </tr>
            `;
            count++; // 번호 증가
        });

        tableBody.innerHTML = html;

    } catch (error) {
        console.error("목록 불러오기 실패:", error);
        tableBody.innerHTML = `<tr><td colspan="4" style="color:red;">데이터 로딩 실패</td></tr>`;
    }
}

// ==========================================
// 3. [신규] 행사 삭제 함수 (전역 등록)
// ==========================================
window.deleteEvent = async function(docId, title) {
    if (!confirm(`'${title}' 행사를 정말 삭제하시겠습니까?\n포함된 사진들도 모두 삭제됩니다.`)) {
        return;
    }

    try {
        // 1. 스토리지 폴더 내 사진들 모두 삭제
        // (폴더 자체 삭제 기능이 없어서 파일 목록을 가져와서 하나씩 지워야 함)
        const folderRef = storage.ref(`event/${docId}`);
        const listResult = await folderRef.listAll();
        
        const deletePromises = listResult.items.map(itemRef => itemRef.delete());
        await Promise.all(deletePromises);
        console.log("관련 사진 삭제 완료");

        // 2. DB 문서 삭제
        await db.collection("event").doc(docId).delete();

        alert("삭제되었습니다.");
        loadEventList(); // 목록 새로고침

    } catch (error) {
        console.error("삭제 실패:", error);
        alert("삭제 중 오류가 발생했습니다: " + error.message);
    }
};