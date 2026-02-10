/* admin/admin-player.js */
// 1. 설정 파일에서 db와 storage 가져오기
import { db, storage } from "../../firebase/firebase.js";

document.addEventListener("DOMContentLoaded", () => {
    // 등록 버튼에 클릭 이벤트 연결
    const registerBtn = document.querySelector('.btn-register');
    if (registerBtn) {
        registerBtn.addEventListener('click',register_member);
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
    const position = document.getElementById('position').value;
    const height = document.getElementById('height').value.trim();
    const weight = document.getElementById('weight').value.trim();
    const type = document.getElementById('type').value;
    const school = document.getElementById('school').value.trim();
    const fileInput = document.getElementById('photo');

    // 2. 유효성 검사
    if (!name || !number || !height || !weight || !school) {
        alert("모든 정보를 입력해주세요.");
        return;
    }

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
    } else {
        alert("프로필 사진을 등록해주세요.");
        return; 
    }

    try {
        const registerBtn = document.querySelector('.btn-register');
        registerBtn.disabled = true;
        registerBtn.innerText = "저장 중...";

        const currentYear = new Date().getFullYear().toString(); 

        // 포지션 매핑
        const position_doc = getPositionEn(Number(position));

        if (!position_doc) throw new Error("포지션 선택 오류");

        // --- [1] 스토리지 업로드 (Compat 스타일) ---
        // storage.ref()를 바로 사용합니다.
        const storagePath = `player/${currentYear}/${number}.jpg`;
        
        // put()을 사용하여 업로드
        const snapshot = await storage.ref(storagePath).put(file);
        
        // getDownloadURL()로 주소 가져오기
        const downloadURL = await snapshot.ref.getDownloadURL();


        // --- [2] 데이터베이스 저장 (Compat 스타일) ---
        const player_data = {
            name: name,
            number: Number(number),
            grade: Number(grade),
            position: Number(position),
            height: Number(height),
            weight: Number(weight),
            type: type,
            school: school,
            photo: downloadURL,
            updatedAt: new Date()
        };

        // 경로: collection(player) -> doc(2026) -> collection(pitcher) -> doc(10) -> set(data)
        // .doc(), .collection()을 체인처럼 연결해서 씁니다.
        await db.collection("player").doc(currentYear)
                .collection(position_doc).doc(number)
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
    if (!tableBody) return;

    // 로딩 표시
    tableBody.innerHTML = `<tr><td colspan="6" style="padding:20px;">데이터를 불러오는 중...</td></tr>`;

    const positions = ["pitcher", "catcher", "infielder", "outfielder"];
    let allPlayers = [];

    try {
        console.log(`${year}년도 데이터 로딩 시작...`);

        // 4개의 컬렉션을 병렬로 동시에 조회 (속도 향상)
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

        // 등번호 순으로 정렬 (오름차순 1 -> 99)
        allPlayers.sort((a, b) => Number(a.number) - Number(b.number));

        renderTable(allPlayers);

    } catch (error) {
        console.error("데이터 불러오기 실패:", error);
        tableBody.innerHTML = `<tr><td colspan="6" style="color:red;">데이터 로딩 실패</td></tr>`;
    }
}

// 테이블에 그리는 함수
function renderTable(players) {
    const tableBody = document.getElementById('player-table-body');
    tableBody.innerHTML = ""; // 기존 내용 초기화

    if (players.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" style="padding:20px; color:#999;">등록된 선수가 없습니다.</td></tr>`;
        return;
    }

    // HTML 생성
    const html = players.map(player => `
        <tr>
            <td>${player.name}</td>
            <td>No. ${player.number}</td>
            <td>${player.grade}학년</td>
            <td>${getPositionKorea(player.position)}</td>
            <td>${player.height}cm / ${player.weight}kg</td>
            <td>
                <button class="btn-list edit" onclick="alert('수정 기능 준비중: ${player.name}')">수정</button>
                <button class="btn-list delete" onclick="deletePlayer('${player.number}','${player.name}', '${player.position}')">삭제</button>
            </td>
        </tr>
    `).join('');

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