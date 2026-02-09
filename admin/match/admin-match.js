/* admin/admin-match.js */
import { db, storage } from "../../firebase.js";

// 상태 변수
let selectedMatchId = null; 
let currentKeptPhotos = [];
let photosPendingDelete = [];
let globalPlayersData = []; 

document.addEventListener("DOMContentLoaded", () => {
    const currentYear = new Date().getFullYear().toString();
    loadAllPlayers(currentYear);
    loadPastMatches();

    document.getElementById('match-select').addEventListener('change', handleMatchSelect);
    document.getElementById('match-result-status').addEventListener('change', toggleWinStats);
    document.getElementById('btn-save-record').addEventListener('click', saveMatchRecord);

    // 승리 투수 입력창 자동완성 적용
    setupAutocomplete(document.getElementById('win-pitcher'));
});

// ==========================================
// 1. 초기 데이터 로딩
// ==========================================

async function loadAllPlayers(year) {
    console.log(`[${year}년] 선수 명단 로딩...`);
    const positions = ['pitcher', 'catcher', 'infielder', 'outfielder'];
    const pos_name = ["투수", "포수", "내야수", "외야수"];
    let allPlayers = [];

    try {
        const promises = positions.map(pos => 
            db.collection("player").doc(year).collection(pos).get()
        );
        
        const snapshots = await Promise.all(promises);

        snapshots.forEach(snapshot => {
            snapshot.forEach(doc => {
                const p = doc.data();
                if (p.name) {
                    allPlayers.push({
                        ...p,
                        id: doc.id
                    });
                }
            });
        });

        // 배번 순 정렬
        allPlayers.sort((a, b) => Number(a.backNumber || a.number || 999) - Number(b.backNumber || b.number || 999));

        globalPlayersData = allPlayers.map(p => ({
            name: p.name,
            number:  p.number || '?',
            position: pos_name[p.position],
            type: p.type || '', // 투타 정보
            displayName: `${p.number || '?'}.${p.name}`
        }));

        console.log(`총 ${globalPlayersData.length}명 데이터 캐싱 완료`);

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
            option.text = `[${data.date}] vs ${data.opponent} (${data.title})`;
            selectEl.add(option);
        });

    } catch (error) {
        console.error("경기 목록 로딩 실패:", error);
    }
}

// ==========================================
// 2. 경기 데이터 불러오기 & 폼 채우기
// ==========================================
async function handleMatchSelect(e) {
    const docId = e.target.value;
    if (!docId) {
        document.getElementById('record-form').style.display = 'none';
        return;
    }

    selectedMatchId = docId;
    const matchYear = docId.substring(0, 4);
    await loadAllPlayers(matchYear); 

    try {
        const doc = await db.collection("match").doc(docId).get();
        if (!doc.exists) return;
        const data = doc.data();

        // 1. 기본 정보 표시
        document.getElementById('info-title').textContent = data.title;
        document.getElementById('info-meta').textContent = `${data.date} | ${data.location} | ${data.homeAway === 'home' ? 'HOME(후공)' : 'AWAY(선공)'}`;
        
        // 2. ⭐ [수정] 팀 이름 축약 로직 변경 (고등학교->고, 대학교->대)
        let shortOpponent = data.opponent;
        if (shortOpponent) {
            shortOpponent = shortOpponent
                .replace(/고등학교/g, '고')
                .replace(/대학교/g, '대')
                .replace(/학교/g, ''); // 그 외 '중학교' 등은 '학교'만 제거
        }

        // 스코어보드 팀 위치 배치 (Away=위, Home=아래)
        if (data.homeAway === 'home') {
            // 우리가 홈(후공) -> 상대가 어웨이(위)
            document.getElementById('name-away').textContent = shortOpponent; 
            document.getElementById('name-home').textContent = "청운대";      
        } else {
            // 우리가 어웨이(선공) -> 우리가 위
            document.getElementById('name-away').textContent = "청운대";      
            document.getElementById('name-home').textContent = shortOpponent; 
        }

        // 3. 상태 & 기록
        document.getElementById('match-result-status').value = data.status || 'before';
        toggleWinStats();

        if (data.keyStats) {
            document.getElementById('win-pitcher').value = data.keyStats.winPitcher || '';
            document.getElementById('mvp-player').value = data.keyStats.mvp || '';
        }

        if (data.scoreboard) {
            fillScoreboardRow('away', data.scoreboard.away);
            fillScoreboardRow('home', data.scoreboard.home);
        } else {
            clearScoreboard();
        }

        // 4. 라인업 (스타팅은 고정 9명 생성)
        renderFixedStartingRows(data.lineups ? data.lineups.starting : []);
        
        renderLineupTable('table-pitcher', data.lineups ? data.lineups.pitcher : []);
        renderLineupTable('table-bench', data.lineups ? data.lineups.bench : []);

        currentKeptPhotos = data.photo || [];
        photosPendingDelete = [];
        renderPhotoPreviews();

        document.getElementById('record-form').style.display = 'block';

    } catch (error) {
        console.error("상세 데이터 로딩 실패:", error);
    }
}

// ==========================================
// [라인업] 스타팅 고정 9명 생성 함수
// ==========================================
function renderFixedStartingRows(savedData = []) {
    const tbody = document.querySelector('#table-starting tbody');
    tbody.innerHTML = ''; 

    const positions = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];
    let options = `<option value="">선택</option>`;
    positions.forEach(pos => options += `<option value="${pos}">${pos}</option>`);

    for (let i = 1; i <= 9; i++) {
        const savedItem = savedData.find(item => item.order == i) || {};

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:bold; color:#333; text-align:center;">${i}</td>
            <td>
                <select class="input-field pos-select">${options}</select>
            </td>
            <td>
                <div class="autocomplete-wrapper">
                    <input type="text" class="input-field player-input" value="${savedItem.name || ''}" placeholder="선수 검색">
                </div>
            </td>
            <td>
                <input type="text" class="input-field type-input" value="${savedItem.type || ''}" readonly style="background:#f9f9f9; color:#666; text-align:center;">
            </td>
        `;
        
        tbody.appendChild(tr);

        if (savedItem.pos) tr.querySelector('.pos-select').value = savedItem.pos;
        setupAutocomplete(tr.querySelector('.player-input'));
    }
}


// ==========================================
// [자동완성] 기능
// ==========================================
function setupAutocomplete(input) {
    if (!input) return;
    if (input.dataset.autocomplete === "active") return;
    input.dataset.autocomplete = "active";

    input.addEventListener("input", function(e) {
        const val = this.value;
        closeAllLists();
        if (!val) return false;

        const listDiv = document.createElement("DIV");
        listDiv.setAttribute("class", "autocomplete-items");
        this.parentNode.appendChild(listDiv);

        let matchCount = 0;
        for (let i = 0; i < globalPlayersData.length; i++) {
            const player = globalPlayersData[i];
            if (player.displayName.toUpperCase().includes(val.toUpperCase()) || 
                player.number.toString().includes(val)) {
                
                const itemDiv = document.createElement("DIV");
                itemDiv.className = "autocomplete-item";
                itemDiv.innerHTML = `
                    <span>${player.displayName}</span>
                    <span class="item-pos">${player.position}</span>
                `;
                
                itemDiv.addEventListener("click", function(e) {
                    input.value = player.displayName; 
                    
                    // 투타(Type) 자동 입력
                    const tr = input.closest('tr');
                    if(tr) {
                        const typeInput = tr.querySelector('.type-input');
                        if (typeInput) {
                            typeInput.value = player.type || ''; 
                        }
                    }
                    closeAllLists();
                });
                listDiv.appendChild(itemDiv);
                matchCount++;
            }
        }
        if(matchCount === 0) {
            const noItem = document.createElement("DIV");
            noItem.className = "autocomplete-item";
            noItem.innerHTML = "<span style='color:#ccc'>검색 결과 없음</span>";
            listDiv.appendChild(noItem);
        }
    });

    document.addEventListener("click", function (e) {
        if (e.target !== input) closeAllLists(e.target);
    });
}

function closeAllLists(elmnt) {
    const items = document.getElementsByClassName("autocomplete-items");
    for (let i = 0; i < items.length; i++) {
        if (elmnt != items[i]) items[i].parentNode.removeChild(items[i]);
    }
}

// ... (기타 함수들 유지) ...

function toggleWinStats() {
    const status = document.getElementById('match-result-status').value;
    const winBox = document.getElementById('win-stats-box');
    winBox.style.display = (status === 'win') ? 'grid' : 'none';
}

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

// Pitcher & Bench 행 추가 함수
window.addPitcherRow = (data = {}) => {
    const tbody = document.querySelector('#table-pitcher tbody');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="number" class="input-field" value="${data.order || ''}" placeholder="순서"></td>
        <td><div class="autocomplete-wrapper"><input type="text" class="input-field player-input" value="${data.name || ''}" placeholder="선수 검색"></div></td>
        <td><input type="text" class="input-field" value="${data.inn || ''}" placeholder="이닝"></td>
        <td><button class="btn-mini del" onclick="this.closest('tr').remove()">삭제</button></td>
    `;
    tbody.appendChild(tr);
    setupAutocomplete(tr.querySelector('.player-input'));
};

window.addBenchRow = (data = {}) => {
    const tbody = document.querySelector('#table-bench tbody');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="text" class="input-field" value="${data.inn || ''}" placeholder="7회"></td>
        <td><div class="autocomplete-wrapper"><input type="text" class="input-field in-player" value="${data.inName || ''}" placeholder="IN 선수"></div></td>
        <td><input type="text" class="input-field" value="${data.reason || ''}" placeholder="사유"></td>
        <td><div class="autocomplete-wrapper"><input type="text" class="input-field out-player" value="${data.outName || ''}" placeholder="OUT 선수"></div></td>
        <td><button class="btn-mini del" onclick="this.closest('tr').remove()">삭제</button></td>
    `;
    tbody.appendChild(tr);
    setupAutocomplete(tr.querySelector('.in-player'));
    setupAutocomplete(tr.querySelector('.out-player'));
};

function renderLineupTable(tableId, list) {
    document.querySelector(`#${tableId} tbody`).innerHTML = '';
    if (!list || list.length === 0) return;
    list.forEach(item => {
        if (tableId === 'table-pitcher') window.addPitcherRow(item);
        else if (tableId === 'table-bench') window.addBenchRow(item);
    });
}

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
        
        // 1. 스타팅 라인업 (고정 9행) 데이터 수집
        const startRows = document.querySelectorAll('#table-starting tbody tr');
        startRows.forEach((tr, index) => {
            const order = index + 1; 
            const pos = tr.querySelector('.pos-select').value;
            const name = tr.querySelector('.player-input').value;
            const type = tr.querySelector('.type-input').value;

            if (name) { 
                lineups.starting.push({ order, pos, name, type });
            }
        });
        
        // 2. Pitcher
        document.querySelectorAll('#table-pitcher tbody tr').forEach(tr => {
            const nameVal = tr.querySelector('.player-input').value;
            if (nameVal) {
                const inputs = tr.querySelectorAll('input');
                lineups.pitcher.push({ order: inputs[0].value, name: nameVal, inn: inputs[2].value });
            }
        });
        // 3. Bench
        document.querySelectorAll('#table-bench tbody tr').forEach(tr => {
            const inName = tr.querySelector('.in-player').value;
            const outName = tr.querySelector('.out-player').value;
            if (inName) {
                const inputs = tr.querySelectorAll('input');
                lineups.bench.push({ inn: inputs[0].value, inName: inName, reason: inputs[2].value, outName: outName });
            }
        });

        // 사진 처리
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