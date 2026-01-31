/* admin/admin-schedule.js */

// 1. 설정 파일에서 db와 storage 가져오기
import { db, storage } from "../../firebase.js";

// [이벤트용 변수]
let isEditMode = false;
let currentEditId = null;
let currentKeptPhotos = [];
let photosPendingDelete = [];

document.addEventListener("DOMContentLoaded", () => {
    // ---------------------------------------------
    // 1. 경기 일정 (Match) 이벤트 리스너
    // ---------------------------------------------
    const matchRegisterBtn = document.querySelector('.btn-register-match');
    if (matchRegisterBtn) {
        matchRegisterBtn.addEventListener('click', register_match);
    }
    
    // 페이지 로드 시 경기 목록 불러오기
    loadMatchList();


    // ---------------------------------------------
    // 2. 행사 일정 (Event) 이벤트 리스너
    // ---------------------------------------------
    const eventRegisterBtn = document.querySelector('.btn-register-event');
    if (eventRegisterBtn) {
        eventRegisterBtn.addEventListener('click', register_event);
    }

    const eventUpdateBtn = document.querySelector('#event-tab .btn-edit');
    if (eventUpdateBtn) {
        eventUpdateBtn.addEventListener('click', update_event);
        eventUpdateBtn.style.display = 'none';
    }

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

    // 행사 목록도 불러오기
    loadEventList();
});


// =========================================================
// [PART 1] 경기 일정 (Match) 관련 함수
// =========================================================

// 1. 경기 일정 등록 함수
async function register_match() {
    console.log("경기 등록 시작...");

    const dateVal = document.getElementById('match-date').value;
    const title = document.getElementById('match-title').value.trim();
    const opponent = document.getElementById('match-opponent').value.trim();
    const location = document.getElementById('match-location').value.trim();
    const homeAway = document.getElementById('match-home-away').value;
    const status = document.getElementById('match-status').value;

    if (!dateVal || !title || !opponent || !location) {
        alert("모든 필수 정보를 입력해주세요.");
        return;
    }

    try {
        const btn = document.querySelector('.btn-register-match');
        btn.disabled = true;
        btn.innerText = "저장 중...";

        // 문서 ID 생성: YYYYMMDD (예: 20260101)
        const docId = dateVal.replaceAll('-', '');

        const matchData = {
            date: dateVal,
            title: title,
            opponent: opponent,
            location: location,
            homeAway: homeAway,
            status: status,
            createdAt: new Date()
        };

        // DB 저장 (match 컬렉션)
        await db.collection("match").doc(docId).set(matchData);

        alert(`[${dateVal}] ${title} vs ${opponent} 경기 일정이 등록되었습니다.`);
        window.location.reload();

    } catch (error) {
        console.error("경기 등록 에러:", error);
        alert("등록 중 오류가 발생했습니다: " + error.message);
        const btn = document.querySelector('.btn-register-match');
        btn.disabled = false;
        btn.innerText = "일정 등록";
    }
}

// 2. 경기 목록 불러오기 함수
async function loadMatchList() {
    const tableBody = document.getElementById('match-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = `<tr><td colspan="4" style="padding:20px;">로딩 중...</td></tr>`;

    try {
        const snapshot = await db.collection("match").orderBy("date", "desc").get();

        if (snapshot.empty) {
            tableBody.innerHTML = `<tr><td colspan="4" style="padding:20px;">등록된 경기가 없습니다.</td></tr>`;
            return;
        }

        let html = "";
        let count = 1;

        snapshot.forEach(doc => {
            const data = doc.data();
            const id = doc.id;
            
            // 상태 텍스트 변환 (영어 -> 한글)
            let statusText = "";
            switch(data.status) {
                case "before": statusText = "경기전"; break;
                case "end": statusText = "종료"; break;
                case "rain_cancel": statusText = "우천취소"; break;
                default: statusText = data.status;
            }

            html += `
                <tr>
                    <td>${count}</td>
                    <td>${data.date}</td>
                    <td>
                        <span style="font-weight:bold;">${data.title}</span> 
                        <span style="color:#666; font-size:0.9em;">(vs ${data.opponent})</span>
                    </td>
                    <td>
                        <button class="btn-list delete" onclick="deleteMatch('${id}', '${data.title}')">삭제</button>
                    </td>
                </tr>
            `;
            count++;
        });

        tableBody.innerHTML = html;

    } catch (error) {
        console.error("경기 목록 로딩 실패:", error);
        tableBody.innerHTML = `<tr><td colspan="4" style="color:red;">데이터 로딩 실패</td></tr>`;
    }
}

// 3. 경기 삭제 함수 (전역)
window.deleteMatch = async function(docId, title) {
    if (!confirm(`'${title}' 경기를 삭제하시겠습니까?`)) return;

    try {
        await db.collection("match").doc(docId).delete();
        alert("삭제되었습니다.");
        loadMatchList(); // 목록 새로고침
    } catch (error) {
        console.error("삭제 실패:", error);
        alert("오류: " + error.message);
    }
};


// =========================================================
// [PART 2] 행사 일정 (Event) 관련 함수 (기존 유지)
// =========================================================

async function register_event() {
    console.log("행사 등록 시작...");

    // 1. 입력값 가져오기
    const dateInput = document.getElementById('event-date');
    const titleInput = document.getElementById('event-title');
    const locationInput = document.getElementById('event-location');
    const fileInput = document.getElementById('event-photos');

    const dateVal = dateInput.value; 
    const title = titleInput.value.trim();
    const location = locationInput.value.trim();
    const files = fileInput.files; 

    // 2. 텍스트 유효성 검사
    if (!dateVal || !title || !location) {
        alert("날짜, 행사 이름, 장소를 모두 입력해주세요.");
        return;
    }

    // 3. 파일 유효성 검사
    if (files.length === 0) {
        alert("최소 1장 이상의 사진을 등록해주세요.");
        return;
    }

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
        const registerBtn = document.querySelector('.btn-register-event');
        registerBtn.disabled = true;
        registerBtn.innerText = "등록 중...";

        // 문서 ID 생성: YYMMDD 형식 (행사 쪽은 기존 로직 유지)
        const yymmdd = dateVal.replaceAll('-', '').substring(2);

        // 스토리지 업로드
        const uploadPromises = Array.from(files).map(async (file) => {
            const storagePath = `event/${yymmdd}/${file.name}`;
            const snapshot = await storage.ref(storagePath).put(file);
            return await snapshot.ref.getDownloadURL();
        });

        const photoUrls = await Promise.all(uploadPromises);

        const eventData = {
            date: dateVal,
            title: title,
            location: location,
            photo: photoUrls,
        };

        await db.collection("event").doc(yymmdd).set(eventData);

        alert(`[${dateVal}] ${title} 행사가 등록되었습니다!`);
        window.location.reload(); 

    } catch (error) {
        console.error("에러 발생:", error);
        alert("등록 중 오류가 발생했습니다: " + error.message);

        const registerBtn = document.querySelector('.btn-register-event');
        if (registerBtn) {
            registerBtn.disabled = false;
            registerBtn.innerText = "행사 일정 등록하기";
        }
    }
}

async function loadEventList() {
    const tableBody = document.getElementById('event-table-body');
    if (!tableBody) return; 

    tableBody.innerHTML = `<tr><td colspan="4" style="padding:20px;">로딩 중...</td></tr>`;

    try {
        const snapshot = await db.collection("event").orderBy("date", "desc").get();

        if (snapshot.empty) {
            tableBody.innerHTML = `<tr><td colspan="4" style="padding:20px;">등록된 행사가 없습니다.</td></tr>`;
            return;
        }

        let html = "";
        let count = 1; 

        snapshot.forEach(doc => {
            const data = doc.data();
            const id = doc.id; 
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
            count++; 
        });

        tableBody.innerHTML = html;

    } catch (error) {
        console.error("목록 불러오기 실패:", error);
        tableBody.innerHTML = `<tr><td colspan="4" style="color:red;">데이터 로딩 실패</td></tr>`;
    }
}

window.deleteEvent = async function (docId, title) {
    if (!confirm(`'${title}' 행사를 정말 삭제하시겠습니까?\n포함된 사진들도 모두 삭제됩니다.`)) {
        return;
    }

    try {
        const folderRef = storage.ref(`event/${docId}`);
        const listResult = await folderRef.listAll();
        const deletePromises = listResult.items.map(itemRef => itemRef.delete());
        await Promise.all(deletePromises);
        
        await db.collection("event").doc(docId).delete();

        alert("삭제되었습니다.");
        loadEventList(); 

    } catch (error) {
        console.error("삭제 실패:", error);
        alert("삭제 중 오류가 발생했습니다: " + error.message);
    }
};

window.prepareEditEvent = async function(docId) {
    try {
        const doc = await db.collection("event").doc(docId).get();
        if (!doc.exists) {
            alert("해당 데이터를 찾을 수 없습니다.");
            return;
        }
        const data = doc.data();

        document.getElementById('event-date').value = data.date;
        document.getElementById('event-title').value = data.title;
        document.getElementById('event-location').value = data.location;
        
        isEditMode = true;
        currentEditId = docId;
        currentKeptPhotos = data.photo || []; 
        photosPendingDelete = [];
        
        renderPhotoPreviews();

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
        if (photosPendingDelete.length > 0) {
            const deletePromises = photosPendingDelete.map(url => {
                try {
                    return storage.refFromURL(url).delete();
                } catch(e) {
                    return Promise.resolve(); 
                }
            });
            await Promise.all(deletePromises);
        }

        let finalPhotoUrls = [...currentKeptPhotos]; 

        if (isDateChanged && currentKeptPhotos.length > 0) {
            const movedUrls = [];
            for (const url of currentKeptPhotos) {
                try {
                    const oldRef = storage.refFromURL(url);
                    const fileName = oldRef.name;
                    const newPath = `event/${newDocId}/${fileName}`;

                    const response = await fetch(url);
                    const blob = await response.blob();
                    
                    const snapshot = await storage.ref(newPath).put(blob);
                    const newUrl = await snapshot.ref.getDownloadURL();
                    movedUrls.push(newUrl);
                    
                    await oldRef.delete(); 
                } catch (err) {
                    console.error("사진 이동 실패 (일부 누락 가능):", err);
                }
            }
            finalPhotoUrls = movedUrls; 
        }

        if (newFiles.length > 0) {
            const targetId = isDateChanged ? newDocId : currentEditId;
            const uploadPromises = Array.from(newFiles).map(async (file) => {
                const storagePath = `event/${targetId}/${file.name}`;
                const snapshot = await storage.ref(storagePath).put(file);
                return await snapshot.ref.getDownloadURL();
            });
            
            const newUploadedUrls = await Promise.all(uploadPromises);
            finalPhotoUrls = [...finalPhotoUrls, ...newUploadedUrls]; 
        }

        const eventData = {
            date: newDate,
            title: newTitle,
            location: newLocation,
            photo: finalPhotoUrls,
        };

        if (isDateChanged) {
            await db.collection("event").doc(newDocId).set(eventData);
            await db.collection("event").doc(currentEditId).delete();
            alert("날짜 변경 및 사진 정리가 완료되었습니다.");
        } else {
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

function renderPhotoPreviews() {
    const previewBox = document.getElementById('photo-preview-box');
    previewBox.innerHTML = ""; 

    if (currentKeptPhotos.length > 0) {
        previewBox.style.display = 'flex'; 
        
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
        previewBox.style.display = 'none'; 
    }
}

window.removePhotoFromArray = function(index) {
    const removedUrl = currentKeptPhotos[index];
    photosPendingDelete.push(removedUrl);
    
    currentKeptPhotos.splice(index, 1);
    renderPhotoPreviews();
};