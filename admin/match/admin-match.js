/* admin/admin-match.js */
import { db, storage } from "../../firebase.js";

// 상태 변수
let selectedMatchId = null; 
let currentKeptPhotos = [];
let photosPendingDelete = [];

// 선수 목록 캐싱
let cachedPlayerOptions = '<option value="">선수 선택</option>';

document.addEventListener("DOMContentLoaded", () => {
    loadAllPlayers();
    loadPastMatches();

    document.getElementById('match-select').addEventListener('change', handleMatchSelect);
    document.getElementById('match-result-status').addEventListener('change', toggleWinStats);
    document.getElementById('btn-save-record').addEventListener('click', saveMatchRecord);
});

// ==========================================
// 1. 초기 데이터 로딩
// ==========================================

async function loadAllPlayers() {
    try {
        const snapshot = await db.collection("player").orderBy("backNumber", "asc").get();
        let optionsHtml = '<option value="">선수 선택</option>';
        snapshot.forEach(doc => {
            const p = doc.data();
            const displayName = `${p.name} (${p.backNumber})`;
            optionsHtml += `<option value="${displayName}">${displayName} - ${p.position}</option>`;
        });
        cachedPlayerOptions = optionsHtml;
        document.getElementById('win-pitcher').innerHTML = cachedPlayerOptions;
    } catch (error) {
        console.error("선수 목록 로딩 실패:", error);
    }
}

async function loadPastMatches() {
    const selectEl = document.getElementById('match-select');
    const today = new Date().toISOString().split('T')[0]; 

    try {
        const snapshot = await db.collection("match")
            .where("date", "<=", today)
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
            option.value = doc.id; 
            // Select Box는 전체 이름 유지 (원하신다면 여기도 축약 가능)
            option.text = `[${data.date}] vs ${data.opponent} (${data.title})`;
            selectEl.add(option);
        });

    } catch (error) {
        console.error("경기 목록 로딩 실패:", error);
    }
}

// ==========================================
// 2. 경기 데이터 불러오기 (⭐ 여기가 핵심 수정 부분)
// ==========================================
async function handleMatchSelect(e) {
    const docId = e.target.value;
    if (!docId) {
        document.getElementById('record-form').style.display = 'none';
        return;
    }

    selectedMatchId = docId;

    try {
        const doc = await db.collection("match").doc(docId).get();
        if (!doc.exists) return;
        const data = doc.data();

        // 기본 정보
        document.getElementById('info-title').textContent = data.title;
        document.getElementById('info-meta').textContent = `${data.date} | ${data.location} | ${data.homeAway === 'home' ? 'HOME' : 'AWAY'}`;
        
        // ⭐ [수정] 스코어보드 팀 이름 축약 로직 적용
        let shortOpponent = data.opponent;
        if (shortOpponent) {
            shortOpponent = shortOpponent
                .replace('고등학교', '고')
                .replace('대학교', '대')
                .replace('학교', ''); // 중학교 -> 중 등 나머지 케이스
        }

        document.getElementById('name-home').textContent = "청운대";
        document.getElementById('name-away').textContent = shortOpponent; // 축약된 이름 적용

        // 상태 및 승리 기록
        document.getElementById('match-result-status').value = data.status || 'before';
        toggleWinStats();

        if (data.keyStats) {
            document.getElementById('win-pitcher').value = data.keyStats.winPitcher || '';
            document.getElementById('mvp-player').value = data.keyStats.mvp || '';
        }

        // 스코어보드
        if (data.scoreboard) {
            fillScoreboardRow('away', data.scoreboard.away);
            fillScoreboardRow('home', data.scoreboard.home);
        } else {
            clearScoreboard();
        }

        // 라인업
        renderLineupTable('table-starting', data.lineups ? data.lineups.starting : []);
        renderLineupTable('table-pitcher', data.lineups ? data.lineups.pitcher : []);
        renderLineupTable('table-bench', data.lineups ? data.lineups.bench : []);

        // 사진
        currentKeptPhotos = data.photo || [];
        photosPendingDelete = [];
        renderPhotoPreviews();

        document.getElementById('record-form').style.display = 'block';

    } catch (error) {
        console.error("상세 데이터 로딩 실패:", error);
        alert("데이터를 불러오는 중 오류가 발생했습니다.");
    }
}

function toggleWinStats() {
    const status = document.getElementById('match-result-status').value;
    const winBox = document.getElementById('win-stats-box');
    winBox.style.display = (status === 'win') ? 'grid' : 'none';
}

// ==========================================
// 3. 스코어보드 Helper
// ==========================================
function fillScoreboardRow(team, scoreData) {
    if (!scoreData) return;
    const row = document.getElementById(`row-${team}`);
    const inputs = row.querySelectorAll('.score-in');
    
    if (scoreData.innings) {
        scoreData.innings.forEach((sc, i) => { if(inputs[i]) inputs[i].value = sc; });
    }
    row.querySelector('.r-val').value = scoreData.r || 0;
    document.getElementById(`h-${team}`).value = scoreData.h || 0;
    document.getElementById(`e-${team}`).value = scoreData.e || 0;
}

function clearScoreboard() {
    document.querySelectorAll('.score-in, .stat-in').forEach(el => el.value = '');
}

// R(득점) 자동 계산
document.querySelectorAll('.score-in').forEach(input => {
    input.addEventListener('change', () => {
        ['home', 'away'].forEach(team => {
            let total = 0;
            document.getElementById(`row-${team}`).querySelectorAll('.score-in').forEach(inp => {
                total += Number(inp.value) || 0;
            });
            document.getElementById(`row-${team}`).querySelector('.r-val').value = total;
        });
    });
});

// ==========================================
// 4. 라인업 동적 테이블 Helper
// ==========================================
window.addStartingRow = (data = {}) => {
    const tbody = document.querySelector('#table-starting tbody');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="number" class="input-field" value="${data.order || ''}" placeholder="타순"></td>
        <td><select class="input-field player-select">${cachedPlayerOptions}</select></td>
        <td><input type="text" class="input-field" value="${data.pos || ''}" placeholder="POS"></td>
        <td><input type="text" class="input-field" value="${data.type || ''}" placeholder="우투우타"></td>
        <td><button class="btn-mini del" onclick="this.closest('tr').remove()">삭제</button></td>
    `;
    tbody.appendChild(tr);
    if (data.name) tr.querySelector('.player-select').value = data.name;
};

window.addPitcherRow = (data = {}) => {
    const tbody = document.querySelector('#table-pitcher tbody');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="number" class="input-field" value="${data.order || ''}" placeholder="순서"></td>
        <td><select class="input-field player-select">${cachedPlayerOptions}</select></td>
        <td><input type="text" class="input-field" value="${data.inn || ''}" placeholder="이닝"></td>
        <td><button class="btn-mini del" onclick="this.closest('tr').remove()">삭제</button></td>
    `;
    tbody.appendChild(tr);
    if (data.name) tr.querySelector('.player-select').value = data.name;
};

window.addBenchRow = (data = {}) => {
    const tbody = document.querySelector('#table-bench tbody');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="text" class="input-field" value="${data.inn || ''}" placeholder="7회"></td>
        <td><select class="input-field in-player">${cachedPlayerOptions}</select></td>
        <td><input type="text" class="input-field" value="${data.reason || ''}" placeholder="대타/대주자"></td>
        <td><select class="input-field out-player">${cachedPlayerOptions}</select></td>
        <td><button class="btn-mini del" onclick="this.closest('tr').remove()">삭제</button></td>
    `;
    tbody.appendChild(tr);
    if (data.inName) tr.querySelector('.in-player').value = data.inName;
    if (data.outName) tr.querySelector('.out-player').value = data.outName;
};

function renderLineupTable(tableId, list) {
    document.querySelector(`#${tableId} tbody`).innerHTML = '';
    if (!list || list.length === 0) return;
    list.forEach(item => {
        if (tableId === 'table-starting') window.addStartingRow(item);
        else if (tableId === 'table-pitcher') window.addPitcherRow(item);
        else window.addBenchRow(item);
    });
}

// ==========================================
// 5. 사진 & 저장
// ==========================================
function renderPhotoPreviews() {
    const box = document.getElementById('photo-preview-box');
    box.innerHTML = '';
    if (currentKeptPhotos.length > 0) {
        box.style.display = 'flex';
        currentKeptPhotos.forEach((url, idx) => {
            const div = document.createElement('div');
            div.className = 'photo-item';
            div.innerHTML = `<img src="${url}"><button type="button" class="btn-remove-photo" onclick="removePhoto(${idx})">✕</button>`;
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

async function saveMatchRecord() {
    if (!selectedMatchId) return;
    const btn = document.getElementById('btn-save-record');
    btn.disabled = true;
    btn.innerText = "저장 중...";

    try {
        const getScore = (team) => {
            const inputs = document.getElementById(`row-${team}`).querySelectorAll('.score-in');
            const innings = [];
            inputs.forEach(inp => { if(inp.value !== '') innings.push(Number(inp.value)); });
            return {
                innings,
                r: Number(document.getElementById(`row-${team}`).querySelector('.r-val').value) || 0,
                h: Number(document.getElementById(`h-${team}`).value) || 0,
                e: Number(document.getElementById(`e-${team}`).value) || 0
            };
        };

        const lineups = { starting: [], pitcher: [], bench: [] };
        
        document.querySelectorAll('#table-starting tbody tr').forEach(tr => {
            const sel = tr.querySelector('select');
            if (sel.value) {
                const inputs = tr.querySelectorAll('input');
                lineups.starting.push({
                    order: inputs[0].value, name: sel.value, pos: inputs[1].value, type: inputs[2].value
                });
            }
        });
        document.querySelectorAll('#table-pitcher tbody tr').forEach(tr => {
            const sel = tr.querySelector('select');
            if (sel.value) {
                lineups.pitcher.push({
                    order: tr.querySelector('input').value, name: sel.value, inn: tr.querySelectorAll('input')[1].value
                });
            }
        });
        document.querySelectorAll('#table-bench tbody tr').forEach(tr => {
            const inSel = tr.querySelector('.in-player');
            const outSel = tr.querySelector('.out-player');
            if (inSel.value) {
                const inputs = tr.querySelectorAll('input');
                lineups.bench.push({
                    inn: inputs[0].value, inName: inSel.value, reason: inputs[1].value, outName: outSel.value
                });
            }
        });

        if (photosPendingDelete.length > 0) {
            await Promise.all(photosPendingDelete.map(url => {
                try { return storage.refFromURL(url).delete(); } catch(e) { return Promise.resolve(); }
            }));
        }

        const fileInput = document.getElementById('match-photos');
        let finalPhotos = [...currentKeptPhotos];

        if (fileInput.files.length > 0) {
            for(const file of fileInput.files) {
                if(file.size > 200 * 1024) throw new Error(`${file.name} 200KB 초과`);
                if(!file.name.match(/\.(jpg|jpeg)$/i)) throw new Error("JPG만 가능");
            }
            const uploads = Array.from(fileInput.files).map(async f => {
                const snap = await storage.ref(`match/${selectedMatchId}/${f.name}`).put(f);
                return await snap.ref.getDownloadURL();
            });
            const newUrls = await Promise.all(uploads);
            finalPhotos = [...finalPhotos, ...newUrls];
        }

        const status = document.getElementById('match-result-status').value;
        const updateData = {
            status: status,
            scoreboard: { home: getScore('home'), away: getScore('away') },
            keyStats: {
                winPitcher: document.getElementById('win-pitcher').value,
                mvp: document.getElementById('mvp-player').value
            },
            lineups: lineups,
            photo: finalPhotos
        };

        await db.collection("match").doc(selectedMatchId).update(updateData);
        await db.collection("schedule").doc(selectedMatchId).update({ status: status });

        alert("저장 완료!");
        location.reload();

    } catch (error) {
        console.error("저장 실패:", error);
        alert("오류: " + error.message);
        btn.disabled = false;
        btn.innerText = "경기 기록 저장";
    }
}