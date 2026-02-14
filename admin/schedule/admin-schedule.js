/* admin/admin-schedule.js */

// 1. 설정 파일에서 db와 storage 가져오기
import { db, storage } from "../../firebase/firebase.js";

// [이벤트(행사)용 변수]
let isEditMode = false;
let currentEditId = null;
let currentKeptPhotos = [];
let photosPendingDelete = [];

// [경기(Match)용 변수]
let isMatchEditMode = false;
let currentMatchEditId = null;
let currentMatchOriginalStatus = null; // ⭐ 수정 전 원래 상태 저장용 변수

document.addEventListener("DOMContentLoaded", () => {
    // ---------------------------------------------
    // 1. 경기 일정 (Match) 이벤트 리스너
    // ---------------------------------------------
    const matchRegisterBtn = document.querySelector('.btn-register-match');
    if (matchRegisterBtn) {
        matchRegisterBtn.addEventListener('click', register_match);
    }
    
    const matchUpdateBtn = document.querySelector('#match-tab .btn-edit');
    if (matchUpdateBtn) {
        matchUpdateBtn.addEventListener('click', update_match);
        matchUpdateBtn.style.display = 'none'; 
    }

    const matchCancelBtn = document.querySelector('#match-tab .btn-cancel');
    if (matchCancelBtn) {
        matchCancelBtn.addEventListener('click', () => {
            if (isMatchEditMode) {
                if (confirm("경기 수정을 취소하시겠습니까?")) window.location.reload();
            } else {
                window.location.reload();
            }
        });
    }
    
    loadMatchList();
    loadTournamentTitles(); // 대회 목록 불러오기

    // ⭐ [추가] 선택 박스 변경 시 입력창에 값 복사하는 이벤트
    const titleSelect = document.getElementById('match-title-select');
    const titleInput = document.getElementById('match-title');

    if (titleSelect && titleInput) {
        titleSelect.addEventListener('change', (e) => {
            const selectedVal = e.target.value;

            if (selectedVal === 'direct') {
                // '직접 입력' 선택 시: 입력창 비우고 포커스
                titleInput.value = '';
                titleInput.focus();
                titleInput.readOnly = false; // 수정 가능
            } else {
                // 기존 대회 선택 시: 입력창에 값 넣기
                titleInput.value = selectedVal;
                // (선택 사항) 선택 후 수정 못하게 막으려면 아래 주석 해제
                // titleInput.readOnly = true; 
            }
        });
    }


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
                if (confirm("행사 수정을 취소하시겠습니까?")) window.location.reload();
            } else {
                window.location.reload();
            }
        });
    }

    loadEventList();
});


// =========================================================
// [PART 1] 경기 일정 (Match) 관련 함수
// =========================================================

// 1. 경기 일정 등록
async function register_match() {
    console.log("경기 등록 시작...");

    const dateVal = document.getElementById('match-date').value;
    const timeVal = document.getElementById('match-time').value;
    const title = document.getElementById('match-title').value.trim();
    const opponent = document.getElementById('match-opponent').value.trim();
    const location = document.getElementById('match-location').value.trim();
    const homeAway = document.getElementById('match-home-away').value;
    const status = document.getElementById('match-status').value;

   if (!dateVal || !timeVal || !title || !opponent || !location) {
        alert("모든 필수 정보(시간 포함)를 입력해주세요.");
        return;
    }

    try {
        const btn = document.querySelector('.btn-register-match');
        btn.disabled = true;
        btn.innerText = "저장 중...";

        // [수정 완료] YYYYMMDD 형식 (예: 20260101)
        const docId = dateVal.replaceAll('-', ''); 

        // ---------------------------------------------------------
        // ⭐ [추가 로직] 대회 이름 목록(match-list) 업데이트
        // ---------------------------------------------------------
        const listRef = db.collection("match").doc("match-list");
        
        try {
            const listDoc = await listRef.get();
            
            if (listDoc.exists) {
                const listData = listDoc.data();
                // 기존 배열 가져오기 (없으면 빈 배열)
                const currentList = listData['match-name'] || [];
                
                // 중복 확인: 리스트에 없는 이름이면 추가
                if (!currentList.includes(title)) {
                    currentList.push(title);
                    await listRef.update({
                        'match-name': currentList
                    });
                    console.log(`새로운 대회 이름 추가됨: ${title}`);
                }
            } else {
                // 문서가 아예 없으면 새로 생성
                await listRef.set({
                    'match-name': [title]
                });
                console.log(`match-list 문서 생성 및 대회 이름 추가: ${title}`);
            }
        } catch (listError) {
            console.error("대회 목록 업데이트 중 오류 (무시하고 진행):", listError);
        }
        // ---------------------------------------------------------

        // (1) Match 데이터
        const matchData = {
            date: dateVal,
            time: timeVal, // ⭐ [추가] DB에 시간 저장
            title: title,
            opponent: opponent,
            location: location,
            homeAway: homeAway,
            status: status,
        };

        // (2) Schedule 데이터
        const scheduleData = {
            date: dateVal,
            time: timeVal, // ⭐ [추가] 캘린더용 데이터에도 시간 저장
            location: location,
            opponent: opponent,
            status: status
        };

        await db.collection("match").doc(docId).set(matchData);
        await db.collection("schedule").doc(docId).set(scheduleData); 

        alert(`[${dateVal} ${timeVal}] ${title} vs ${opponent} 경기 일정이 등록되었습니다.`);
        window.location.reload();

    } catch (error) {
        console.error("경기 등록 에러:", error);
        alert("등록 중 오류가 발생했습니다: " + error.message);
        const btn = document.querySelector('.btn-register-match');
        btn.disabled = false;
        btn.innerText = "일정 등록";
    }
}

// 2. 경기 목록 불러오기
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

            const timeDisplay = data.time ? `<span style="color:var(--main-clr) ; font-size:0.9em; margin-left:5px;">(${data.time})</span>` : '';
            
            html += `
            <tr>
                <td>${count}</td>
                <td>${data.date} ${timeDisplay}</td> <td>
                    <span style="font-weight:bold;">${data.title}</span> 
                    <span style="color:var(--text-gray); font-size:0.9em;">(vs ${data.opponent})</span>
                </td>
                <td>
                    <button class="btn-list edit" onclick="prepareEditMatch('${id}')">수정</button>
                    <button class="btn-list delete" onclick="deleteMatch('${id}', '${data.title}')">삭제</button>
                </td>
            </tr>
        `;
        count++;
        });

        tableBody.innerHTML = html;

    } catch (error) {
        console.error("경기 목록 로딩 실패:", error);
        tableBody.innerHTML = `<tr><td colspan="4" style="color: var(--text-red);">데이터 로딩 실패</td></tr>`;
    }
}

// 3. 경기 수정 준비
window.prepareEditMatch = async function(docId) {
    try {
        const doc = await db.collection("match").doc(docId).get();
        if (!doc.exists) {
            alert("해당 경기를 찾을 수 없습니다.");
            return;
        }
        const data = doc.data();

        document.getElementById('match-date').value = data.date;
        document.getElementById('match-time').value = data.time || '';
        document.getElementById('match-title').value = data.title;
        document.getElementById('match-opponent').value = data.opponent;
        document.getElementById('match-location').value = data.location;
        document.getElementById('match-home-away').value = data.homeAway;

        currentMatchOriginalStatus = data.status; // 원래 상태 저장해두기
        const finishedList = ['win', 'loss', 'draw', 'no_record'];
        const statusSelect = document.getElementById('match-status');

        if (finishedList.includes(data.status)) {
            // 이미 결과가 나온 경기라면 화면에는 '경기 종료(end)'로 표시
            statusSelect.value = 'end';
        } else {
            // 그 외(before, rain_cancel 등)는 있는 그대로 표시
            statusSelect.value = data.status;
        }
        

        isMatchEditMode = true;
        currentMatchEditId = docId;

        document.querySelector('.btn-register-match').style.display = 'none';
        
        const updateBtn = document.querySelector('#match-tab .btn-edit');
        updateBtn.style.display = 'inline-block'; 
        updateBtn.innerText = "수정 내용 저장";

        document.querySelector('#match-tab .form-container').scrollIntoView({ behavior: 'smooth' });
        alert(`${data.date} 경기 수정 모드입니다.`);

    } catch (error) {
        console.error("경기 수정 준비 실패:", error);
        alert("데이터를 불러오는 중 오류가 발생했습니다.");
    }
};

// 4. 경기 수정 저장
async function update_match() {
    if (!isMatchEditMode || !currentMatchEditId) return;

    const dateVal = document.getElementById('match-date').value;
    const timeVal = document.getElementById('match-time').value;
    const title = document.getElementById('match-title').value.trim();
    const opponent = document.getElementById('match-opponent').value.trim();
    const location = document.getElementById('match-location').value.trim();
    const homeAway = document.getElementById('match-home-away').value;

    let selectedStatus = document.getElementById('match-status').value;

    if (!dateVal || !title || !opponent || !location) {
        alert("필수 정보를 모두 입력해주세요.");
        return;
    }

    const finishedList = ['win', 'loss', 'draw', 'no_record'];
    
    if (selectedStatus === 'end' && finishedList.includes(currentMatchOriginalStatus)) {
        selectedStatus = currentMatchOriginalStatus;
    }

    // [수정 완료] YYYYMMDD 형식으로 변경
    const newDocId = dateVal.replaceAll('-', ''); 
    const isDateChanged = (newDocId !== currentMatchEditId);

    const updateBtn = document.querySelector('#match-tab .btn-edit');
    updateBtn.disabled = true;
    updateBtn.innerText = "저장 중...";

    try {
        const matchData = {
            date: dateVal,
            time: timeVal, // ⭐ [추가]
            title: title,
            opponent: opponent,
            location: location,
            homeAway: homeAway,
            status: selectedStatus,
        };

        const scheduleData = {
            date: dateVal,
            time: timeVal, // ⭐ [추가]
            location: location,
            opponent: opponent,
            status: selectedStatus
        };

        if (isDateChanged) {
            // [Match 이동]
            await db.collection("match").doc(newDocId).set(matchData);
            await db.collection("match").doc(currentMatchEditId).delete();
            
            // [Schedule 이동]
            await db.collection("schedule").doc(newDocId).set(scheduleData);
            await db.collection("schedule").doc(currentMatchEditId).delete();

            alert(`날짜가 변경되어 일정이 이동되었습니다.\n(${currentMatchEditId} -> ${newDocId})`);
        } else {
            // [Match 업데이트]
            await db.collection("match").doc(currentMatchEditId).update(matchData);
            
            // [Schedule 업데이트]
            await db.collection("schedule").doc(currentMatchEditId).update(scheduleData);

            alert("경기 일정이 수정되었습니다.");
        }

        window.location.reload();

    } catch (error) {
        console.error("경기 수정 실패:", error);
        alert("수정 중 오류 발생: " + error.message);
        updateBtn.disabled = false;
        updateBtn.innerText = "수정 내용 저장";
    }
}

// 5. 경기 삭제
window.deleteMatch = async function(docId, title) {
    if (!confirm(`'${title}' 경기를 삭제하시겠습니까?`)) return;

    try {
            
        // -----------------------------------------------------------
        // ⭐ [추가] Storage의 match/{docId} 폴더 내 모든 파일 삭제
        // -----------------------------------------------------------
        const folderRef = storage.ref(`match/${docId}`);
        
        try {
            const listResult = await folderRef.listAll(); // 폴더 내 파일 목록 가져오기
            
            // 모든 파일 삭제 Promise 생성
            const deletePromises = listResult.items.map(itemRef => itemRef.delete());
            
            // 병렬로 삭제 실행
            await Promise.all(deletePromises);
            console.log("관련 사진 파일 삭제 완료");
            
        } catch (storageError) {
            // 사진이 없거나 폴더가 없는 경우 에러가 발생할 수 있으므로
            // 로그만 찍고 DB 삭제는 계속 진행하도록 함
            console.warn("스토리지 파일 삭제 중 오류 (또는 파일 없음):", storageError);
        }
        // -----------------------------------------------------------


        await db.collection("match").doc(docId).delete();
        await db.collection("schedule").doc(docId).delete(); 

        alert("삭제되었습니다.");
        loadMatchList();
    } catch (error) {
        console.error("삭제 실패:", error);
        alert("오류: " + error.message);
    }
};

// 6. 기존 대회 이름 불러오기
async function loadTournamentTitles() {
    try {
        // 1. 특정 문서 가져오기 (match 컬렉션의 match-list 문서)
        const doc = await db.collection("match").doc("match-list").get();
        
        let titles = [];
        if (doc.exists) {
            const data = doc.data();
            // 2. match-name 필드(배열) 가져오기
            if (data && Array.isArray(data['match-name'])) {
                titles = data['match-name'];
            }
        }

        // 3. Select Box에 옵션 추가
        const selectBox = document.getElementById('match-title-select');
        if (selectBox) {
            let html = '<option value="direct">직접 입력</option>';
            
            titles.forEach(title => {
                html += `<option value="${title}">${title}</option>`;
            });
            
            selectBox.innerHTML = html;
        }
    } catch (error) {
        console.error("대회 목록 로딩 실패:", error);
    }
}
// =========================================================
// [PART 2] 행사 일정 (Event) 관련 함수
// =========================================================

// 1. 행사 등록
async function register_event() {
    console.log("행사 등록 시작...");

    const dateInput = document.getElementById('event-date');
    const titleInput = document.getElementById('event-title');
    const locationInput = document.getElementById('event-location');
    const fileInput = document.getElementById('event-photos');

    const dateVal = dateInput.value; 
    const title = titleInput.value.trim();
    const location = locationInput.value.trim();
    const files = fileInput.files; 

    if (!dateVal || !title || !location) {
        alert("날짜, 행사 이름, 장소를 모두 입력해주세요.");
        return;
    }

    // [수정] 사진 유무 체크 제거 (files.length === 0 체크 삭제)

    // 파일이 있는 경우에만 유효성 검사 실시
    if (files.length > 0) {
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
    }

    try {
        const registerBtn = document.querySelector('.btn-register-event');
        registerBtn.disabled = true;
        registerBtn.innerText = "등록 중...";

        const docId = dateVal.replaceAll('-', '');
        let photoUrls = []; // 기본값 빈 배열

        // [수정] 파일이 존재하는 경우에만 스토리지 업로드 실행
        if (files.length > 0) {
            const uploadPromises = Array.from(files).map(async (file) => {
                const storagePath = `event/${docId}/${file.name}`;
                const snapshot = await storage.ref(storagePath).put(file);
                return await snapshot.ref.getDownloadURL();
            });
            photoUrls = await Promise.all(uploadPromises);
        }

        // (1) Event 데이터
        const eventData = {
            date: dateVal,
            title: title,
            location: location,
            photo: photoUrls, // 사진이 없으면 [] 가 저장됨
        };

        // (2) Schedule 데이터
        const scheduleData = {
            date: dateVal,
            location: location,
            opponent: title, 
            status: "event"  
        };

        // DB 저장
        await db.collection("event").doc(docId).set(eventData);
        await db.collection("schedule").doc(docId).set(scheduleData); 

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

// 2. 행사 목록 불러오기
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
        tableBody.innerHTML = `<tr><td colspan="4" style="color: var(--text-red);">데이터 로딩 실패</td></tr>`;
    }
}

// 3. 행사 삭제
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
        await db.collection("schedule").doc(docId).delete(); 

        alert("삭제되었습니다.");
        loadEventList(); 

    } catch (error) {
        console.error("삭제 실패:", error);
        alert("삭제 중 오류가 발생했습니다: " + error.message);
    }
};

// 4. 행사 수정 준비
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

        document.querySelector('#event-tab .form-container').scrollIntoView({ behavior: 'smooth' });
        alert(`${data.date} 수정 모드입니다.\n사진의 'X' 버튼을 누르면 저장 시 삭제됩니다.`);

    } catch (error) {
        console.error("수정 준비 실패:", error);
        alert("데이터 로딩 중 오류 발생");
    }
};

// 5. 행사 수정 저장
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

    // [수정 완료] YYYYMMDD
    const newDocId = newDate.replaceAll('-', '');
    const isDateChanged = (newDocId !== currentEditId);

    const updateBtn = document.querySelector('#event-tab .btn-edit');
    updateBtn.disabled = true;
    updateBtn.innerText = "저장 중...";

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
                    // 폴더명도 8자리로 변경
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

        const scheduleData = {
            date: newDate,
            location: newLocation,
            opponent: newTitle, 
            status: "event"
        };

        if (isDateChanged) {
            // [Event 이동]
            await db.collection("event").doc(newDocId).set(eventData);
            await db.collection("event").doc(currentEditId).delete();

            // [Schedule 이동]
            await db.collection("schedule").doc(newDocId).set(scheduleData);
            await db.collection("schedule").doc(currentEditId).delete();

            alert("날짜 변경 및 사진 정리가 완료되었습니다.");
        } else {
            // [Event 업데이트]
            await db.collection("event").doc(currentEditId).update(eventData);

            // [Schedule 업데이트]
            await db.collection("schedule").doc(currentEditId).update(scheduleData);

            alert("수정되었습니다.");
        }

        window.location.reload(); 

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