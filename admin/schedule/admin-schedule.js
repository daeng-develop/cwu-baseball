/* admin/admin-schedule.js */

// 1. 설정 파일에서 db와 storage 가져오기
import { db, storage } from "../../firebase.js";

let isEditMode = false;
let currentEditId = null;
let currentKeptPhotos = [];   // 현재 화면에 남겨둔(유지할) 사진 URL들
let photosPendingDelete = []; // 삭제하려고 X표 누른 사진 URL들

document.addEventListener("DOMContentLoaded", () => {
    // 1. 등록 버튼 (기존)
    const eventRegisterBtn = document.querySelector('.btn-register-event');
    if (eventRegisterBtn) {
        eventRegisterBtn.addEventListener('click', register_event);
    }

    // 2. [신규] 수정(저장) 버튼 이벤트 연결
    // HTML에 있는 <button class="btn btn-edit">를 찾아서 연결
    const eventUpdateBtn = document.querySelector('#event-tab .btn-edit');
    if (eventUpdateBtn) {
        eventUpdateBtn.addEventListener('click', update_event);
        eventUpdateBtn.style.display = 'none'; // 처음엔 숨김
    }

    // 3. [신규] 취소 버튼 이벤트 (새로고침 대신 폼 초기화)
    const eventCancelBtn = document.querySelector('#event-tab .btn-cancel');
    if (eventCancelBtn) {
        eventCancelBtn.addEventListener('click', () => {
            if (isEditMode) {
                if (confirm("수정을 취소하시겠습니까?")) location.reload();
            } else {
                location.reload();
            }
        });
    }

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
        if (registerBtn) {
            registerBtn.disabled = false;
            registerBtn.innerText = "행사 일정 등록하기";
        }
    }
}

// ==========================================
// 2. 행사 목록 불러오기 함수
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
                    <td>${data.title}</td>
                    <td>
                        <button class="btn-list edit" onclick="prepareEditEvent('${id}')">수정</button>
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
// 3. 행사 삭제 함수 (전역 등록)
// ==========================================
window.deleteEvent = async function (docId, title) {
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

// ==========================================
// 4. 행사 수정 함수 (전역 등록)
// ==========================================
window.prepareEditEvent = async function(docId) {
    try {
        const doc = await db.collection("event").doc(docId).get();
        if (!doc.exists) {
            alert("해당 데이터를 찾을 수 없습니다.");
            return;
        }
        const data = doc.data();

        // 입력창 채우기
        document.getElementById('event-date').value = data.date;
        document.getElementById('event-title').value = data.title;
        document.getElementById('event-location').value = data.location;
        
        // --- [사진 처리 로직] ---
        isEditMode = true;
        currentEditId = docId;
        
        // 1. 초기화: 유지할 사진은 DB값 그대로, 삭제할 사진은 없음
        currentKeptPhotos = data.photo || []; 
        photosPendingDelete = [];
        
        // 2. 미리보기 영역 그리기
        renderPhotoPreviews();

        // 3. UI 변경 (등록버튼 숨김, 수정버튼 보임)
        document.querySelector('.btn-register-event').style.display = 'none';
        
        const updateBtn = document.querySelector('#event-tab .btn-edit');
        updateBtn.style.display = 'inline-block';
        updateBtn.innerText = "수정 내용 저장";

        document.querySelector('.form-container').scrollIntoView({ behavior: 'smooth' });
        alert(`${data.date} 수정 모드입니다.\n사진의 'X' 버튼을 누르면 저장 시 삭제됩니다.`);

    } catch (error) {
        console.error("수정 준비 실패:", error);
        alert("데이터 로딩 중 오류 발생");
    }
};

async function update_event() {
    if (!isEditMode || !currentEditId) return;

    // 입력값 확인
    const newDate = document.getElementById('event-date').value;
    const newTitle = document.getElementById('event-title').value.trim();
    const newLocation = document.getElementById('event-location').value.trim();
    const newFiles = document.getElementById('event-photos').files;

    if (!newDate || !newTitle || !newLocation) {
        alert("필수 정보를 모두 입력해주세요.");
        return;
    }

    const newDocId = newDate.replaceAll('-', '').substring(2);
    const isDateChanged = (newDocId !== currentEditId);

    const updateBtn = document.querySelector('#event-tab .btn-edit');
    updateBtn.disabled = true;
    updateBtn.innerText = "저장 중... (삭제 및 이동 처리 중)";

    try {
        // ---------------------------------------------------
        // 1. 삭제 대기중인 사진들 -> 진짜 스토리지 삭제
        // ---------------------------------------------------
        if (photosPendingDelete.length > 0) {
            console.log("사진 삭제 시작:", photosPendingDelete.length + "장");
            const deletePromises = photosPendingDelete.map(url => {
                try {
                    return storage.refFromURL(url).delete();
                } catch(e) {
                    console.warn("이미 삭제되었거나 없는 파일:", e);
                    return Promise.resolve(); // 에러 나도 무시하고 진행
                }
            });
            await Promise.all(deletePromises);
        }

        // ---------------------------------------------------
        // 2. 남은 사진들(currentKeptPhotos) 처리
        //    (날짜가 바뀌었으면 이사 가야 함)
        // ---------------------------------------------------
        let finalPhotoUrls = [...currentKeptPhotos]; // 일단 남은 것들로 시작

        if (isDateChanged && currentKeptPhotos.length > 0) {
            console.log("날짜 변경! 사진 이사 시작...");
            const movedUrls = [];
            
            for (const url of currentKeptPhotos) {
                try {
                    // 다운로드 -> 새 위치 업로드 -> 기존 삭제
                    const oldRef = storage.refFromURL(url);
                    const fileName = oldRef.name;
                    const newPath = `event/${newDocId}/${fileName}`;

                    const response = await fetch(url);
                    const blob = await response.blob();
                    
                    const snapshot = await storage.ref(newPath).put(blob);
                    const newUrl = await snapshot.ref.getDownloadURL();
                    movedUrls.push(newUrl);
                    
                    await oldRef.delete(); // 구버전 삭제
                } catch (err) {
                    console.error("사진 이동 실패 (일부 누락 가능):", err);
                }
            }
            finalPhotoUrls = movedUrls; // 이사 완료된 URL들로 교체
        }

        // ---------------------------------------------------
        // 3. 새로 추가된 파일들 업로드
        // ---------------------------------------------------
        if (newFiles.length > 0) {
            console.log("새 사진 업로드 중...");
            // 날짜가 바뀌었으면 새 폴더(newDocId)로, 아니면 기존(currentEditId)로
            const targetId = isDateChanged ? newDocId : currentEditId;
            
            const uploadPromises = Array.from(newFiles).map(async (file) => {
                const storagePath = `event/${targetId}/${file.name}`;
                const snapshot = await storage.ref(storagePath).put(file);
                return await snapshot.ref.getDownloadURL();
            });
            
            const newUploadedUrls = await Promise.all(uploadPromises);
            finalPhotoUrls = [...finalPhotoUrls, ...newUploadedUrls]; // 뒤에 붙이기
        }

        // ---------------------------------------------------
        // 4. DB 저장
        // ---------------------------------------------------
        const eventData = {
            date: newDate,
            title: newTitle,
            location: newLocation,
            photo: finalPhotoUrls,
        };

        if (isDateChanged) {
            // 문서 ID 변경: 새 문서 생성 -> 기존 삭제
            await db.collection("event").doc(newDocId).set(eventData);
            await db.collection("event").doc(currentEditId).delete();
            alert("날짜 변경 및 사진 정리가 완료되었습니다.");
        } else {
            // 단순 업데이트
            await db.collection("event").doc(currentEditId).update(eventData);
            alert("수정되었습니다.");
        }

        location.reload();

    } catch (error) {
        console.error("수정 실패:", error);
        alert("오류 발생: " + error.message);
        updateBtn.disabled = false;
        updateBtn.innerText = "수정 내용 저장";
    }
}

// 사진 미리보기 그리기
function renderPhotoPreviews() {
    const previewBox = document.getElementById('photo-preview-box');
    previewBox.innerHTML = ""; // 초기화

    if (currentKeptPhotos.length > 0) {
        previewBox.style.display = 'flex'; // 사진이 있으면 보이기
        
        currentKeptPhotos.forEach((url, index) => {
            const div = document.createElement('div');
            div.className = 'photo-item';
            div.innerHTML = `
                <img src="${url}" alt="사진">
                <button type="button" class="btn-remove-photo" onclick="removePhotoFromArray(${index})">✕</button>
            `;
            previewBox.appendChild(div);
        });
    } else {
        previewBox.style.display = 'none'; // 사진 없으면 숨기기
    }
}

// 사진 X 버튼 누르면 호출됨 (전역 등록)
window.removePhotoFromArray = function(index) {
    // 1. 삭제 대기 목록에 추가
    const removedUrl = currentKeptPhotos[index];
    photosPendingDelete.push(removedUrl);
    
    // 2. 유지 목록에서 제거
    currentKeptPhotos.splice(index, 1);
    
    // 3. 화면 다시 그리기
    renderPhotoPreviews();
};