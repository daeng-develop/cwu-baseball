/* admin/admin-match.js */
import { db, storage } from "../../firebase.js";

// 상태 변수
let selectedMatchId = null; // 현재 선택된 경기 ID (YYYYMMDD)
let currentKeptPhotos = []; // 유지할 사진 URL 목록
let photosPendingDelete = []; // 삭제할 사진 URL 목록

document.addEventListener("DOMContentLoaded", () => {
    loadPastMatches();

    // 경기 선택 시 이벤트
    document.getElementById('match-select').addEventListener('change', (e) => {
        const docId = e.target.value;
        if (docId) {
            loadMatchRecord(docId);
        } else {
            document.getElementById('record-form').style.display = 'none';
        }
    });

    // 승패 선택 시 '승리 투수' 입력창 토글
    document.getElementById('match-result-status').addEventListener('change', (e) => {
        const winBox = document.getElementById('win-stats-box');
        if (e.target.value === 'win') {
            winBox.style.display = 'grid';
        } else {
            winBox.style.display = 'none';
        }
    });

    // 저장 버튼
    document.getElementById('btn-save-record').addEventListener('click', saveMatchRecord);
});

// 1. 지난 경기 목록 불러오기 (Dropdown)
async function loadPastMatches() {
    const selectEl = document.getElementById('match-select');
    // 오늘 날짜 구하기 (YYYY-MM-DD)
    const today = new Date().toISOString().split('T')[0];

    try {
        const snapshot = await db.collection("match")
            .where("date", "<=", today) // 오늘 포함 과거 경기만
            .orderBy("date", "desc")
            .get();

        if (snapshot.empty) {
            const opt = document.createElement('option');
            opt.text = "기록할 지난 경기가 없습니다.";
            selectEl.add(opt);
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            const option = document.createElement('option');
            option.value = doc.id; // YYYYMMDD
            option.text = `[${data.date}] vs ${data.opponent} (${data.title})`;
            selectEl.add(option);
        });

    } catch (error) {
        console.error("경기 목록 로딩 실패:", error);
        alert("경기 목록을 불러오지 못했습니다.");
    }
}

// 2. 선택한 경기 데이터 불러오기 & 폼 채우기
async function loadMatchRecord(docId) {
    selectedMatchId = docId;
    
    try {
        const doc = await db.collection("match").doc(docId).get();
        if (!doc.exists) return;
        const data = doc.data();

        // (1) 기본 정보 표시
        document.getElementById('info-title').textContent = data.title;
        document.getElementById('info-meta').textContent = `${data.date} | ${data.location} | ${data.homeAway === 'home' ? 'HOME(후공)' : 'AWAY(선공)'}`;
        
        // (2) 팀 이름 설정 (스코어보드)
        document.getElementById('name-home').textContent = "청운대"; // 우리 학교 고정
        document.getElementById('name-away').textContent = data.opponent;

        // (3) 기존 기록이 있으면 채워넣기
        
        // 상태 & 승리 기록
        document.getElementById('match-result-status').value = data.status || 'before';
        if (data.status === 'win') document.getElementById('win-stats-box').style.display = 'grid';
        else document.getElementById('win-stats-box').style.display = 'none';

        if (data.keyStats) {
            document.getElementById('win-pitcher').value = data.keyStats.winPitcher || '';
            document.getElementById('mvp-player').value = data.keyStats.mvp || '';
        }

        // 스코어보드
        if (data.scoreboard) {
            fillScoreboardRow('away', data.scoreboard.away);
            fillScoreboardRow('home', data.scoreboard.home);
        } else {
            // 없으면 초기화
            clearScoreboard();
        }

        // 라인업 테이블 초기화 및 채우기
        renderLineupTable('table-starting', data.lineups ? data.lineups.starting : []);
        renderLineupTable('table-pitcher', data.lineups ? data.lineups.pitcher : []);
        renderLineupTable('table-bench', data.lineups ? data.lineups.bench : []);

        // 사진
        currentKeptPhotos = data.photo || [];
        photosPendingDelete = [];
        renderPhotoPreviews();

        // 폼 보여주기
        document.getElementById('record-form').style.display = 'block';

    } catch (error) {
        console.error("경기 상세 로딩 실패:", error);
        alert("데이터 로딩 중 오류가 발생했습니다.");
    }
}

// ------------------------------------------
// [Helper] 스코어보드 관련
// ------------------------------------------
function fillScoreboardRow(team, scoreData) {
    // scoreData: { innings: [1,0,0...], r: 1, h: 5, e: 0 }
    if (!scoreData) return;
    
    const row = document.getElementById(`row-${team}`);
    const inputs = row.querySelectorAll('.score-in');
    
    // 이닝 점수
    if (scoreData.innings) {
        scoreData.innings.forEach((score, idx) => {
            if (inputs[idx]) inputs[idx].value = score;
        });
    }

    // R, H, E
    row.querySelector('.r-val').value = scoreData.r || 0;
    document.getElementById(`h-${team}`).value = scoreData.h || 0;
    document.getElementById(`e-${team}`).value = scoreData.e || 0;
}

function clearScoreboard() {
    document.querySelectorAll('.score-in, .stat-in').forEach(el => el.value = '');
}

// R(득점) 자동 계산 (입력할 때마다)
document.querySelectorAll('.score-in').forEach(input => {
    input.addEventListener('change', calculateRuns);
});

function calculateRuns() {
    ['home', 'away'].forEach(team => {
        let total = 0;
        const row = document.getElementById(`row-${team}`);
        row.querySelectorAll('.score-in').forEach(input => {
            total += Number(input.value) || 0;
        });
        row.querySelector('.r-val').value = total;
    });
}

// ------------------------------------------
// [Helper] 라인업 테이블 동적 생성
// ------------------------------------------

// 1. 스타팅 라인업 행 추가
window.addStartingRow = (data = {}) => {
    const tbody = document.querySelector('#table-starting tbody');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="number" value="${data.order || ''}" placeholder="타순"></td>
        <td><input type="text" value="${data.name || ''}" placeholder="이름(배번)"></td>
        <td><input type="text" value="${data.pos || ''}" placeholder="POS"></td>
        <td><input type="text" value="${data.type || ''}" placeholder="우투우타"></td>
        <td><button class="btn-mini del" onclick="this.closest('tr').remove()">삭제</button></td>
    `;
    tbody.appendChild(tr);
};

// 2. 투수 라인업 행 추가
window.addPitcherRow = (data = {}) => {
    const tbody = document.querySelector('#table-pitcher tbody');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="number" value="${data.order || ''}" placeholder="순서"></td>
        <td><input type="text" value="${data.name || ''}" placeholder="이름(배번)"></td>
        <td><input type="text" value="${data.inn || ''}" placeholder="5.0"></td>
        <td><button class="btn-mini del" onclick="this.closest('tr').remove()">삭제</button></td>
    `;
    tbody.appendChild(tr);
};

// 3. 벤치/교체 행 추가
window.addBenchRow = (data = {}) => {
    const tbody = document.querySelector('#table-bench tbody');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="text" value="${data.inn || ''}" placeholder="7회"></td>
        <td><input type="text" value="${data.inName || ''}" placeholder="IN 선수"></td>
        <td><input type="text" value="${data.reason || ''}" placeholder="대타/대주자"></td>
        <td><input type="text" value="${data.outName || ''}" placeholder="OUT 선수"></td>
        <td><button class="btn-mini del" onclick="this.closest('tr').remove()">삭제</button></td>
    `;
    tbody.appendChild(tr);
};

// 초기 데이터로 테이블 그리기
function renderLineupTable(tableId, dataList) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    tbody.innerHTML = ''; // 초기화
    
    // 데이터가 없으면 기본 행 1개 추가 (편의성)
    if (!dataList || dataList.length === 0) {
        if (tableId === 'table-starting') for(let i=0; i<9; i++) window.addStartingRow({order: i+1});
        else if (tableId === 'table-pitcher') window.addPitcherRow({order: 1});
        // bench는 비워둠
        return;
    }

    dataList.forEach(item => {
        if (tableId === 'table-starting') window.addStartingRow(item);
        else if (tableId === 'table-pitcher') window.addPitcherRow(item);
        else window.addBenchRow(item);
    });
}

// ------------------------------------------
// [Helper] 사진 관리 (admin-schedule.js 로직 재사용)
// ------------------------------------------
function renderPhotoPreviews() {
    const box = document.getElementById('photo-preview-box');
    box.innerHTML = '';
    
    if (currentKeptPhotos.length > 0) {
        box.style.display = 'flex';
        currentKeptPhotos.forEach((url, idx) => {
            const div = document.createElement('div');
            div.className = 'photo-item';
            div.innerHTML = `
                <img src="${url}">
                <button type="button" class="btn-remove-photo" onclick="removePhoto(${idx})">✕</button>
            `;
            box.appendChild(div);
        });
    } else {
        box.style.display = 'none';
    }
}

window.removePhoto = (index) => {
    photosPendingDelete.push(currentKeptPhotos[index]);
    currentKeptPhotos.splice(index, 1);
    renderPhotoPreviews();
};


// ==========================================
// 3. 최종 저장 함수
// ==========================================
async function saveMatchRecord() {
    if (!selectedMatchId) return;

    const btn = document.getElementById('btn-save-record');
    btn.disabled = true;
    btn.innerText = "저장 중...";

    try {
        // (1) 스코어보드 데이터 수집
        const getScoreData = (team) => {
            const row = document.getElementById(`row-${team}`);
            const inputs = row.querySelectorAll('.score-in');
            const innings = [];
            inputs.forEach(inp => {
                if(inp.value !== '') innings.push(Number(inp.value));
            });
            
            return {
                innings: innings,
                r: Number(row.querySelector('.r-val').value) || 0,
                h: Number(document.getElementById(`h-${team}`).value) || 0,
                e: Number(document.getElementById(`e-${team}`).value) || 0
            };
        };

        const scoreboard = {
            home: getScoreData('home'),
            away: getScoreData('away')
        };

        // (2) 주요 기록 수집
        const status = document.getElementById('match-result-status').value;
        const keyStats = {
            winPitcher: document.getElementById('win-pitcher').value.trim(),
            mvp: document.getElementById('mvp-player').value.trim()
        };

        // (3) 라인업 데이터 수집
        const lineups = {
            starting: [],
            pitcher: [],
            bench: []
        };

        // Starting
        document.querySelectorAll('#table-starting tbody tr').forEach(tr => {
            const inputs = tr.querySelectorAll('input');
            if (inputs[1].value) { // 이름이 있어야 저장
                lineups.starting.push({
                    order: inputs[0].value,
                    name: inputs[1].value,
                    pos: inputs[2].value,
                    type: inputs[3].value
                });
            }
        });

        // Pitcher
        document.querySelectorAll('#table-pitcher tbody tr').forEach(tr => {
            const inputs = tr.querySelectorAll('input');
            if (inputs[1].value) {
                lineups.pitcher.push({
                    order: inputs[0].value,
                    name: inputs[1].value,
                    inn: inputs[2].value
                });
            }
        });

        // Bench
        document.querySelectorAll('#table-bench tbody tr').forEach(tr => {
            const inputs = tr.querySelectorAll('input');
            if (inputs[1].value) {
                lineups.bench.push({
                    inn: inputs[0].value,
                    inName: inputs[1].value,
                    reason: inputs[2].value,
                    outName: inputs[3].value
                });
            }
        });

        // (4) 사진 처리 (삭제 -> 업로드)
        
        // 4-1. 삭제 대기 파일 삭제
        if (photosPendingDelete.length > 0) {
            await Promise.all(photosPendingDelete.map(url => {
                try { return storage.refFromURL(url).delete(); } 
                catch(e) { return Promise.resolve(); }
            }));
        }

        // 4-2. 새 파일 업로드
        const fileInput = document.getElementById('match-photos');
        let finalPhotos = [...currentKeptPhotos];

        if (fileInput.files.length > 0) {
            // 유효성 검사
            for(const file of fileInput.files) {
                if(file.size > 200 * 1024) throw new Error(`${file.name} 용량이 200KB를 초과합니다.`);
                if(!file.name.toLowerCase().match(/\.(jpg|jpeg)$/)) throw new Error("JPG 파일만 가능합니다.");
            }

            const uploadPromises = Array.from(fileInput.files).map(async (file) => {
                const path = `match/${selectedMatchId}/${file.name}`;
                const snap = await storage.ref(path).put(file);
                return await snap.ref.getDownloadURL();
            });
            const newUrls = await Promise.all(uploadPromises);
            finalPhotos = [...finalPhotos, ...newUrls];
        }

        // (5) DB 업데이트
        // match 컬렉션 업데이트
        await db.collection("match").doc(selectedMatchId).update({
            status: status,
            scoreboard: scoreboard,
            keyStats: keyStats,
            lineups: lineups,
            photo: finalPhotos,
            updatedAt: new Date()
        });

        // schedule 컬렉션도 status 업데이트 (경기 결과 반영)
        await db.collection("schedule").doc(selectedMatchId).update({
            status: status
        });

        alert("경기 기록이 저장되었습니다.");
        location.reload();

    } catch (error) {
        console.error("저장 실패:", error);
        alert("저장 중 오류 발생: " + error.message);
        btn.disabled = false;
        btn.innerText = "경기 기록 저장";
    }
}