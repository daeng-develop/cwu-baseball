/* admin/admin-player.js */
// 1. 설정 파일에서 db와 storage 가져오기
import { db, storage } from "../../firebase/firebase.js";

// 수정 시 기존 정보를 기억할 변수들
let currentOriginalPhoto = ""; 
let currentOriginalPosition = ""; // ⭐ [추가] 포지션 변경 감지용

document.addEventListener("DOMContentLoaded", () => {
    // 1. 등록 버튼 이벤트
    const registerBtn = document.querySelector('.btn-register');
    if (registerBtn) {
        registerBtn.addEventListener('click', register_member);
    }

    // ⭐ 2. 수정 버튼 이벤트 (새로 추가)
    const editBtn = document.querySelector('.btn-edit');
    if (editBtn) {
        editBtn.addEventListener('click', update_member);
        editBtn.style.display = "none"; // 처음에 숨김
    }

    // ⭐ 3. 취소 버튼 이벤트 (새로 수정)
    const cancelBtn = document.querySelector('.btn-cancel');
    if (cancelBtn) {
        // 새로고침 대신 입력창 초기화 함수 연결
        cancelBtn.removeAttribute("onclick"); // HTML에 있는거 무시
        cancelBtn.addEventListener('click', resetFormState); 
    }

    // 연도 선택 이벤트 연결
    const yearSelect = document.getElementById('admin-year-select');
    if (yearSelect) {
        // 현재 연도로 자동 설정
        const currentYear = new Date().getFullYear().toString();
        // 만약 옵션에 현재 연도가 없으면 추가해주는 센스 (선택사항)
        if (!yearSelect.querySelector(`option[value="${currentYear}"]`)) {
             const option = document.createElement("option");
             option.value = currentYear;
             option.text = `${currentYear}년`;
             yearSelect.prepend(option);
             yearSelect.value = currentYear;
        }

        // 연도가 바뀌면 목록 다시 불러오기
        yearSelect.addEventListener('change', () => {
            loadPlayerList(yearSelect.value);
        });

        // 페이지 열리자마자 목록 한번 불러오기
        loadPlayerList(yearSelect.value);
    }
});

// 입력창 비우기 함수
function resetInputs() {
    const inputs = document.querySelectorAll('.input-field');
    inputs.forEach(input => input.value = "");
    document.getElementById('p-photo').value = ""; // 파일 입력창 초기화
}

// 선수 등록 함수   
async function register_member() {
    console.log("등록 시작...");

    // 1. 입력값 가져오기
    const name = document.getElementById('name').value.trim();
    const number = document.getElementById('number').value.trim();
    const grade = document.getElementById('grade').value;
    const birth = document.getElementById('birth').value.trim(); // ⭐ 추가
    const position = document.getElementById('position').value;
    
    // 선택항목: 값이 없으면 빈 문자열("") 또는 0으로 처리
    const height = document.getElementById('height').value.trim();
    const weight = document.getElementById('weight').value.trim();
    const type = document.getElementById('type').value;
    const school = document.getElementById('school').value.trim();
    const fileInput = document.getElementById('photo');

    // 2. 필수 항목 유효성 검사 (이름, 배번, 학년, 포지션)
    if (!name || !number || !grade || !position) {
        alert("필수 항목(이름, 배번, 학년, 포지션)을 모두 입력해주세요.");
        return;
    }

    // ⭐ [추가] 생년월일 8자리 검사 (입력값이 있을 때만)
    if (birth && !/^\d{8}$/.test(birth)) {
        alert("생년월일은 '20040101' 형식의 8자리 숫자로 입력해주세요.");
        document.getElementById('birth').focus();
        return;
    }

    // 사진 파일 확인 (선택사항)
    const file = fileInput.files[0];
    if (file) {
        const fileName = file.name.toLowerCase();
        if (!fileName.endsWith('.jpg') && !fileName.endsWith('.jpeg')) {
            alert("이미지는 jpg 파일만 가능합니다.");
            return;
        }
        if (file.size > 200 * 1024) {
            alert("파일 크기는 200KB 이하여야 합니다.");
            return;
        }
    }

    try {
        const registerBtn = document.querySelector('.btn-register');
        registerBtn.disabled = true;
        registerBtn.innerText = "저장 중...";

        const currentYear = new Date().getFullYear().toString(); 

        // 포지션 매핑
        const position_en = ["pitcher", "catcher", "infielder", "outfielder"][Number(position)];
        if (!position_en) throw new Error("포지션 선택 오류");

        // --- [1] 스토리지 업로드 (파일이 있을 경우만) ---
        let downloadURL = ""; // 기본값은 빈 문자열 (또는 기본 이미지 URL)

        if (file) {
            const storagePath = `player/${currentYear}/${number}.jpg`;
            const snapshot = await storage.ref(storagePath).put(file);
            downloadURL = await snapshot.ref.getDownloadURL();
        }

        // --- [2] 데이터베이스 저장 ---
        const player_data = {
            name: name,
            number: Number(number),
            grade: Number(grade),
            position: Number(position),
            birth: birth || "",       // ⭐ 추가: 없으면 빈 값
            height: height ? Number(height) : "", // 없으면 빈 값
            weight: weight ? Number(weight) : "", // 없으면 빈 값
            type: type || "미지정",
            school: school || "",     // 없으면 빈 값
            photo: downloadURL,       // 사진 없으면 ""
            updatedAt: new Date()
        };

        // 경로: player -> 2026 -> pitcher -> 10
        await db.collection("player").doc(currentYear)
                .collection(position_en).doc(number)
                .set(player_data);

        alert(`${grade}학년 ${name} 선수 등록 성공!`);
        location.reload();

    } catch (error) {
        console.error("에러 발생:", error);
        alert("오류 발생: " + error.message);
        
        const registerBtn = document.querySelector('.btn-register');
        registerBtn.disabled = false;
        registerBtn.innerText = "등록";
    }
}

// 포지션 숫자(0~3)를 글자로 변경해주는 함수
function getPositionKorea(index) {
    const names = ["투수", "포수", "내야수", "외야수"];
    return names[Number(index)] || "미지정";
}

function getPositionEn(index) {
    const names = ["pitcher", "catcher", "infielder", "outfielder"];
    return names[Number(index)] || "미지정";
}

// 전체 선수 목록 가져오기 함수
async function loadPlayerList(year) {
    const tableBody = document.getElementById('player-table-body');
    const titleElement = document.getElementById('player-list-title'); // ⭐ 제목 요소 가져오기

    if (!tableBody) return;

    // 로딩 표시
    tableBody.innerHTML = `<tr><td colspan="7" style="padding:20px;">데이터를 불러오는 중...</td></tr>`;
    
    // (선택사항) 로딩 중일 때 제목 변경
    if(titleElement) titleElement.innerText = "등록 선수 목록 (로딩 중...)";

    const positions = ["pitcher", "catcher", "infielder", "outfielder"];
    let allPlayers = [];

    try {
        console.log(`${year}년도 데이터 로딩 시작...`);

        // 4개의 컬렉션을 병렬로 동시에 조회
        const promises = positions.map(pos => 
            db.collection("player").doc(year).collection(pos).get()
        );
        
        const snapshots = await Promise.all(promises);

        // 가져온 데이터를 하나로 합치기
        snapshots.forEach(snapshot => {
            snapshot.forEach(doc => {
                allPlayers.push(doc.data());
            });
        });

        // 등번호 순으로 정렬
        allPlayers.sort((a, b) => Number(a.number) - Number(b.number));

        // ⭐ [추가] 선수 수 계산하여 제목 업데이트
        if (titleElement) {
            titleElement.innerText = `등록 선수 목록 (${allPlayers.length}명)`;
        }

        renderTable(allPlayers);

    } catch (error) {
        console.error("데이터 불러오기 실패:", error);
        tableBody.innerHTML = `<tr><td colspan="7" style="color:red;">데이터 로딩 실패</td></tr>`;
        
        // 에러 시 제목 원상복구 혹은 0명 처리
        if (titleElement) titleElement.innerText = "등록 선수 목록 (-명)";
    }
}
// 테이블에 그리는 함수
function renderTable(players) {
    const tableBody = document.getElementById('player-table-body');
    tableBody.innerHTML = ""; 

    if (players.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" style="padding:20px; color:#999;">등록된 선수가 없습니다.</td></tr>`;
        return;
    }

    const html = players.map(player => {
        // 생년월일 포맷팅
        let birthDisplay = "-";
        if (player.birth && player.birth.length === 8) {
            birthDisplay = `${player.birth.slice(0, 4)}.${player.birth.slice(4, 6)}.${player.birth.slice(6, 8)}`;
        } else if (player.birth) {
            birthDisplay = player.birth; 
        }

        // ⭐ 데이터 안전하게 넘기기 위한 준비 (수정된 부분)
        const p_name = player.name || "";
        
        // [수정] 0번일 경우에도 숫자가 유지되도록 조건 변경
        // (기존: player.number || ""  ->  0이면 거짓이 되어 빈값이 들어감)
        const p_number = (player.number === 0 || player.number) ? player.number : "";
        
        const p_grade = player.grade || "1";
        
        // [수정] 포지션 0(투수)도 안전하게 처리
        const p_pos = (player.position === 0 || player.position) ? player.position : "0";
        
        const p_birth = player.birth || "";
        const p_height = player.height || "";
        const p_weight = player.weight || "";
        const p_type = player.type || "미지정";
        const p_school = player.school || "";
        const p_photo = player.photo || "";

        return `
        <tr>
            <td>${p_name}</td>
            <td>No. ${p_number}</td>
            <td>${p_grade}학년</td>
            <td>${getPositionKorea(p_pos)}</td>
            <td>${birthDisplay}</td>
            <td>${p_height ? p_height + 'cm' : '-'} / ${p_weight ? p_weight + 'kg' : '-'}</td>
            <td>
                <button class="btn-list edit" 
                    onclick="startEditMode('${p_name}', '${p_number}', '${p_grade}', '${p_pos}', '${p_birth}', '${p_height}', '${p_weight}', '${p_type}', '${p_school}', '${p_photo}')">
                    수정
                </button>
                <button class="btn-list delete" onclick="deletePlayer('${p_number}','${p_name}', '${p_pos}')">삭제</button>
            </td>
        </tr>
        `;
    }).join('');

    tableBody.innerHTML = html;
}
// 삭제 기능 함수 틀
window.deletePlayer = async function(number,name, positionCode) {
    if(confirm(`${number}.${name} 선수를 삭제하시겠습니까?\n삭제된 데이터는 복구할 수 없습니다.`)) {  
        // 여기에 나중에 실제 삭제 로직을 추가하면 됩니다.
        deletePlayer(number, name,positionCode);
    }
}

async function deletePlayer(number,name, positionCode) {
    try {
        const yearSelect = document.getElementById('admin-year-select');
        const currentYear = yearSelect ? yearSelect.value : new Date().getFullYear().toString();

        // --- [1] 스토리지 사진 삭제 ---
        const storagePath = `player/${currentYear}/${number}.jpg`;
        // 사진이 없을 수도 있으므로 에러가 나도 무시하고 DB 삭제로 넘어가도록 처리
        try {
            await storage.ref(storagePath).delete();
            console.log("사진 삭제 완료");
        } catch (storageError) {
            console.warn("사진이 없거나 삭제 실패(무시하고 진행):", storageError.message);
        }

        // --- [2] 데이터베이스 문서 삭제 ---
        // 경로: player -> 2026 -> pitcher -> 10
        await db.collection("player").doc(currentYear)
                .collection(getPositionEn(positionCode)).doc(number.toString()) // 문자열로 변환 안전장치
                .delete();
        
        alert(`삭제 완료: ${number}.${name} 포지션 : ${getPositionKorea(positionCode)}`);
        
        // 목록 새로고침 (삭제된 것 반영)
        loadPlayerList(currentYear);
    }
    catch (error) {
        console.error("삭제 중 오류 발생:", error);
        alert("삭제 실패: " + error.message);
    }
}

// [수정 모드 시작] 목록에서 수정 버튼 클릭 시 실행
window.startEditMode = function(name, number, grade, position, birth, height, weight, type, school, photoUrl) {
    // 1. 입력창에 값 채워넣기
    document.getElementById('name').value = name;
    document.getElementById('number').value = number;
    document.getElementById('grade').value = grade;
    document.getElementById('position').value = position;
    document.getElementById('birth').value = birth;
    document.getElementById('height').value = height;
    document.getElementById('weight').value = weight;
    document.getElementById('type').value = type;
    document.getElementById('school').value = school;

    // 2. 사진 URL 저장 (사진을 안 바꾸면 이걸 그대로 씀)
    currentOriginalPhoto = photoUrl;
    currentOriginalPosition = position; // ⭐ [핵심] 수정 전 포지션 기억!

    // 3. UI 변경 (등록 버튼 숨김, 수정 버튼 보임)
    document.querySelector('.btn-register').style.display = "none";
    document.querySelector('.btn-edit').style.display = "inline-block"; // flex 안깨지게 주의
    document.querySelector('.section-title').innerText = "선수 정보 수정";

    // 4. 중요: 배번(ID)은 수정 못하게 막기 (DB 키값이므로)
    const numInput = document.getElementById('number');
    numInput.readOnly = true;
    numInput.style.backgroundColor = "#e9ecef"; // 회색 처리

    // 5. 스크롤을 맨 위로 올려서 입력창 보여주기
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// [수정 실행] 실제 DB 업데이트 함수
async function update_member() {
    console.log("수정 시작...");

    // 1. 입력값 가져오기
    const name = document.getElementById('name').value.trim();
    const number = document.getElementById('number').value.trim();
    const grade = document.getElementById('grade').value;
    const position = document.getElementById('position').value;
    const birth = document.getElementById('birth').value.trim();
    
    // 선택 항목
    const height = document.getElementById('height').value.trim();
    const weight = document.getElementById('weight').value.trim();
    const type = document.getElementById('type').value;
    const school = document.getElementById('school').value.trim();
    const fileInput = document.getElementById('photo');

    // 2. 필수값 검사
    if (!name || !number || !grade || !position) {
        alert("필수 정보를 확인해주세요.");
        return;
    }

    // 3. 생년월일 8자리 유효성 검사
    if (birth && !/^\d{8}$/.test(birth)) {
        alert("생년월일은 '20040101' 형식의 8자리 숫자로 입력해주세요.");
        document.getElementById('birth').focus();
        return;
    }

    try {
        const editBtn = document.querySelector('.btn-edit');
        editBtn.disabled = true;
        editBtn.innerText = "수정 중...";

        const currentYear = document.getElementById('admin-year-select').value; // 현재 선택된 연도
        
        // ⭐ [수정] 변수 정의 부분 (이 부분이 빠져서 에러가 났습니다)
        const newPositionEn = getPositionEn(position);                // 바꿀 포지션 (영어)
        const oldPositionEn = getPositionEn(currentOriginalPosition); // 원래 포지션 (영어)

        // --- [1] 사진 처리 로직 ---
        let finalPhotoUrl = currentOriginalPhoto; // 기본적으로 기존 사진 유지

        // 만약 새 파일을 선택했다면 업로드 진행
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const storagePath = `player/${currentYear}/${number}.jpg`;
            const snapshot = await storage.ref(storagePath).put(file);
            finalPhotoUrl = await snapshot.ref.getDownloadURL();
        }

        // --- [2] DB 업데이트 데이터 준비 ---
        const player_data = {
            name: name,
            number: Number(number),
            grade: Number(grade),
            position: Number(position),
            birth: birth || "",
            height: height ? Number(height) : "",
            weight: weight ? Number(weight) : "",
            type: type || "미지정",
            school: school || "",
            photo: finalPhotoUrl, 
            updatedAt: new Date()
        };

        // ⭐ 4. [핵심] 포지션 변경 처리 로직
        // 새 포지션 컬렉션에 데이터 저장 (newPositionEn 사용)
        await db.collection("player").doc(currentYear)
                .collection(newPositionEn).doc(number)
                .set(player_data, { merge: true });

        // 만약 포지션이 바뀌었다면 -> 기존 포지션 컬렉션에서 삭제 (oldPositionEn 사용)
        if (currentOriginalPosition !== position) {
            console.log(`포지션 변경 감지: ${oldPositionEn} -> ${newPositionEn}. 기존 데이터 삭제.`);
            
            await db.collection("player").doc(currentYear)
                    .collection(oldPositionEn).doc(number)
                    .delete();
        }

        alert("수정 완료되었습니다.");
        
        // 3. 뒷정리
        resetFormState(); // 폼 초기화
        loadPlayerList(currentYear); // 목록 새로고침

    } catch (error) {
        console.error("수정 실패:", error);
        alert("수정 중 오류 발생: " + error.message);
        document.querySelector('.btn-edit').disabled = false;
        document.querySelector('.btn-edit').innerText = "수정";
    }
}
// [초기화] 입력창 및 버튼 상태를 '등록 모드'로 리셋
function resetFormState() {
    // 1. 입력창 비우기
    const inputs = document.querySelectorAll('.input-field');
    inputs.forEach(input => input.value = "");
    document.getElementById('photo').value = ""; 
    document.getElementById('type').value = "미지정"; // select 초기화

    // 2. 버튼 상태 복구
    document.querySelector('.btn-register').style.display = "inline-block";
    document.querySelector('.btn-edit').style.display = "none";
    document.querySelector('.btn-edit').disabled = false;
    document.querySelector('.btn-edit').innerText = "수정";
    document.querySelector('.section-title').innerText = "선수 등록 및 수정";

    // 3. 배번 입력창 잠금 해제
    const numInput = document.getElementById('number');
    numInput.readOnly = false;
    numInput.style.backgroundColor = "white";
    
    // 4. 변수 초기화
    currentOriginalPhoto = "";
}