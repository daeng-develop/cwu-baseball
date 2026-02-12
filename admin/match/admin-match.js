/* admin/admin-match.js */
import { db, storage } from "../../firebase/firebase.js";

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

        allPlayers.sort((a, b) => Number(a.backNumber || a.number || 999) - Number(b.backNumber || b.number || 999));

        globalPlayersData = allPlayers.map(p => {
            // ⭐ [핵심 수정] 0번일 경우에도 숫자가 유지되도록 조건 변경
            const pNum = (p.number === 0 || p.number) ? p.number : '?';
            
            return {
                name: p.name,
                number: pNum, 
                position: pos_name[p.position] || 'Unknown', 
                type: p.type || '', 
                displayName: `${pNum}.${p.name}` // 여기도 0.이름 으로 잘 뜨게 수정
            };
        });

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
// 2. 경기 데이터 불러오기
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

        // 1. 기본 정보
        document.getElementById('info-title').textContent = data.title;
        document.getElementById('info-meta').textContent = `${data.date} | ${data.location} | ${data.homeAway === 'home' ? 'HOME(후공)' : 'AWAY(선공)'}`;
        
        let shortOpponent = data.opponent;
        if (shortOpponent) {
            shortOpponent = shortOpponent.replace(/고등학교/g, '고').replace(/대학교/g, '대').replace('학교', ''); 
        }

        if (data.homeAway === 'home') {
            document.getElementById('name-away').textContent = shortOpponent; 
            document.getElementById('name-home').textContent = "청운대";      
        } else {
            document.getElementById('name-away').textContent = "청운대";      
            document.getElementById('name-home').textContent = shortOpponent; 
        }

        document.getElementById('match-result-status').value = data.status || 'before';
        
        // ⭐ [복구됨] 상태에 따라 승리투수 입력창 보이기/숨기기
        toggleWinStats();

        // 승리 정보
        if (data['winning-pitcher']) document.getElementById('win-pitcher').value = data['winning-pitcher'];
        else if (data.keyStats) document.getElementById('win-pitcher').value = data.keyStats.winPitcher || '';
        
        if (data['run-bat-in']) document.getElementById('mvp-player').value = data['run-bat-in'];
        else if (data.keyStats) document.getElementById('mvp-player').value = data.keyStats.mvp || '';

        // 2. 스코어보드 로드
        if (data['home-score'] || data['away-score']) {
            fillScoreboardNewFormat('home', data['home-score'], data);
            fillScoreboardNewFormat('away', data['away-score'], data);
        } else if (data.scoreboard) {
            fillScoreboardOldFormat('home', data.scoreboard.home);
            fillScoreboardOldFormat('away', data.scoreboard.away);
        } else {
            clearScoreboard();
        }

        // 3. 라인업 로드
        
        // (1) Start Line Up
        let startingList = [];
        if (data['start-line-up'] && Array.isArray(data['start-line-up'])) {
            // "타순,배번,이름,포지션,투타" -> 객체 변환
            startingList = data['start-line-up'].map(str => {
                const parts = str.split(','); 
                if (parts.length >= 5) {
                    return {
                        order: parts[0],
                        name: `${parts[1]}.${parts[2]}`, // "배번.이름"
                        pos: parts[3],
                        type: parts[4]
                    };
                }
                return null;
            }).filter(item => item !== null);
        } else if (data.lineups && data.lineups.starting) {
            startingList = data.lineups.starting;
        }
        renderFixedStartingRows(startingList);

        // (2) Pitcher Line Up
        document.querySelector('#table-pitcher tbody').innerHTML = '';
        if (data['pitcher-line-up'] && Array.isArray(data['pitcher-line-up'])) {
            // "순서,배번,이름,이닝"
            data['pitcher-line-up'].forEach(str => {
                const parts = str.split(',');
                if (parts.length >= 4) {
                    addPitcherRow({
                        name: `${parts[1]}.${parts[2]}`, 
                        inn: parts[3]
                    });
                }
            });
        } else if (data.lineups && data.lineups.pitcher) {
            data.lineups.pitcher.forEach(p => addPitcherRow(p));
        }

        // (3) Bench Line Up (없어도 에러 안 남)
        document.querySelector('#table-bench tbody').innerHTML = '';
        if (data['bench-line-up'] && Array.isArray(data['bench-line-up'])) {
            // "이닝,이름,배번,교체사유,교체된선수"
            data['bench-line-up'].forEach(str => {
                const parts = str.split(',');
                if (parts.length >= 5) {
                    addBenchRow({
                        inn: parts[0],
                        inName: `${parts[1]}.${parts[2]}`, // "배번.이름"으로 복원
                        reason: parts[3],
                        outName: `${parts[4]}.${parts[5]}` // "배번.이름"으로 복원
                    });
                }
            });
        } else if (data.lineups && data.lineups.bench) {
            data.lineups.bench.forEach(b => addBenchRow(b));
        }

        currentKeptPhotos = data.photo || [];
        photosPendingDelete = [];
        renderPhotoPreviews();

        document.getElementById('record-form').style.display = 'block';

    } catch (error) {
        console.error("상세 데이터 로딩 실패:", error);
    }
}

// ------------------------------------
// [헬퍼 함수들]
// ------------------------------------

// ⭐ [복구됨] 승리 투수/결승타 입력창 토글 함수
function toggleWinStats() {
    const status = document.getElementById('match-result-status').value;
    const winBox = document.getElementById('win-stats-box');
    winBox.style.display = (status === 'win') ? 'grid' : 'none';
}

function fillScoreboardNewFormat(team, inningArr, fullData) {
    const row = document.getElementById(`row-${team}`);
    const inputs = row.querySelectorAll('.score-in');
    if (inningArr && Array.isArray(inningArr)) {
        inningArr.forEach((sc, i) => { 
            if(inputs[i]) inputs[i].value = sc; 
        });
    } else {
        inputs.forEach(inp => inp.value = "0");
    }

    row.querySelector('.r-val').value = fullData[`${team}-run`] || 0;
    document.getElementById(`h-${team}`).value = fullData[`${team}-hit`] || 0;
    document.getElementById(`e-${team}`).value = fullData[`${team}-error`] || 0;
    document.getElementById(`b-${team}`).value = fullData[`${team}-ball`] || 0;
}

function fillScoreboardOldFormat(team, scoreData) {
    if (!scoreData) return;
    const row = document.getElementById(`row-${team}`);
    const inputs = row.querySelectorAll('.score-in');
    
    if (scoreData.innings) {
        scoreData.innings.forEach((sc, i) => { if(inputs[i]) inputs[i].value = sc; });
    }
    row.querySelector('.r-val').value = scoreData.r || 0;
    document.getElementById(`h-${team}`).value = scoreData.h || 0;
    document.getElementById(`e-${team}`).value = scoreData.e || 0;
    document.getElementById(`b-${team}`).value = 0; 
}

function clearScoreboard() {
    document.querySelectorAll('.score-in, .stat-in').forEach(el => el.value = '0');
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

// ==========================================
// [라인업] 스타팅, 투수, 벤치
// ==========================================

function renderFixedStartingRows(savedData = []) {
    const tbody = document.querySelector('#table-starting tbody');
    tbody.innerHTML = ''; 

    const positions = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];
    let options = `<option value="">선택</option>`;
    positions.forEach(pos => options += `<option value="${pos}">${pos}</option>`);

    for (let i = 1; i <= 9; i++) {
        let savedItem = {};
        if (Array.isArray(savedData)) {
            savedItem = savedData.find(item => item.order == i) || {};
        }

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

window.addPitcherRow = (data = {}) => {
    const tbody = document.querySelector('#table-pitcher tbody');
    const index = tbody.children.length + 1;
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td style="font-weight:bold; color:#333; text-align:center;">${index}</td>
        <td><div class="autocomplete-wrapper"><input type="text" class="input-field player-input" value="${data.name || ''}" placeholder="선수 검색"></div></td>
        <td><input type="text" class="input-field" value="${data.inn || ''}" placeholder="이닝"></td>
        <td><button class="btn-mini del" onclick="removePitcherRow(this)">삭제</button></td>
    `;
    tbody.appendChild(tr);
    setupAutocomplete(tr.querySelector('.player-input'));
};

window.removePitcherRow = (btn) => {
    const tr = btn.closest('tr');
    const tbody = tr.parentNode;
    tr.remove();
    Array.from(tbody.children).forEach((row, idx) => { row.cells[0].textContent = idx + 1; });
};

window.addBenchRow = (data = {}) => {
    const tbody = document.querySelector('#table-bench tbody');
    const tr = document.createElement('tr');
    let inningOptions = '';
    for (let i = 1; i <= 12; i++) inningOptions += `<option value="${i}">${i}</option>`;
    const savedInn = (data.inn || '').toString().replace('회', '').trim();
    const reasons = ["대타", "대주자", "대수비"];
    let reasonOptions = '<option value="">선택</option>';
    reasons.forEach(r => {
        const isSelected = (data.reason === r) ? 'selected' : '';
        reasonOptions += `<option value="${r}" ${isSelected}>${r}</option>`;
    });

    tr.innerHTML = `
        <td><div class="inning-wrapper"><select class="input-field inning-select">${inningOptions}</select><span class="inning-label">회</span></div></td>
        <td><div class="autocomplete-wrapper"><input type="text" class="input-field in-player" value="${data.inName || ''}" placeholder="IN 선수"></div></td>
        <td><select class="input-field reason-select" style="text-align:center;">${reasonOptions}</select></td>
        <td><div class="autocomplete-wrapper"><input type="text" class="input-field out-player" value="${data.outName || ''}" placeholder="OUT 선수"></div></td>
        <td><button class="btn-mini del" onclick="this.closest('tr').remove()">삭제</button></td>
    `;
    tbody.appendChild(tr);
    if (savedInn) tr.querySelector('.inning-select').value = savedInn;
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
                itemDiv.innerHTML = `<span>${player.displayName}</span><span class="item-pos">${player.position}</span>`;
                
                itemDiv.addEventListener("click", function(e) {
                    input.value = player.displayName; 
                    const tr = input.closest('tr');
                    if(tr) {
                        const typeInput = tr.querySelector('.type-input');
                        if (typeInput) typeInput.value = player.type || ''; 
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

function parseNameNum(value) {
   if (!value) return { name: "", number: "" };
    const dotIndex = value.indexOf('.');
    if (dotIndex !== -1) {
        const numStr = value.substring(0, dotIndex).trim();
        const nameStr = value.substring(dotIndex + 1).trim();
        return { number: numStr, name: nameStr };
    }
    // 점(.)이 없으면 이름만 있는 것으로 간주 -> 번호는 ?
    return { name: value, number: "?" };
}

// ==========================================
// 3. 경기 기록 저장 (검증 포함)
// ==========================================
async function saveMatchRecord() {
    if (!selectedMatchId) return;
    const btn = document.getElementById('btn-save-record');
    const status = document.getElementById('match-result-status').value; // ⭐ 상태 미리 가져오기

    btn.disabled = true;
    btn.innerText = "저장 중...";

    try {
        const updateData = { status: status };

        // ⭐ [수정] '기록 없음'이 아닐 때만 데이터 검증 실시
        if (status !== 'no_record') {
            // 1. 점수 검증
            const nameHome = document.getElementById('name-home').textContent;
            const nameAway = document.getElementById('name-away').textContent;
            
            let ourScore = 0;
            let oppScore = 0;

            const homeRun = Number(document.getElementById(`row-home`).querySelector('.r-val').value || 0);
            const awayRun = Number(document.getElementById(`row-away`).querySelector('.r-val').value || 0);

            if (nameHome === '청운대') { ourScore = homeRun; oppScore = awayRun; } 
            else if (nameAway === '청운대') { ourScore = awayRun; oppScore = homeRun; }

            if (status === 'win' && ourScore <= oppScore) throw new Error("승리인데 점수가 낮거나 같습니다.");
            if (status === 'loss' && ourScore >= oppScore) throw new Error("패배인데 점수가 높거나 같습니다.");
            if (status === 'draw' && ourScore !== oppScore) throw new Error("무승부인데 점수가 다릅니다.");

            // 2. 스타팅 라인업 필수 검증 (9명)
            const filledStarters = Array.from(document.querySelectorAll('#table-starting .player-input'))
                                        .filter(input => input.value.trim() !== "").length;
            
            if (filledStarters < 9) {
                alert("⚠️ 스타팅 라인업 9명을 모두 입력해주세요.\n기록이 없다면 결과에서 '기록 없음'을 선택해주세요.");
                btn.disabled = false;
                btn.innerText = "경기 기록 저장";
                return;
            }
        }

        // --- 데이터 수집 (기록 없음이라도 현재 입력된 값이 있다면 저장하도록 유지) ---
        
        // 1. 승리 정보
        if (status === 'win') {
            const winP = document.getElementById('win-pitcher').value; 
            const rbi = document.getElementById('mvp-player').value;   
            if (winP) updateData['winning-pitcher'] = winP;
            if (rbi) updateData['run-bat-in'] = rbi;
        }

        // 2. 스코어 및 스태츠
        const getInningScores = (team) => {
            const inputs = document.getElementById(`row-${team}`).querySelectorAll('.score-in');
            const scores = [];
            inputs.forEach(inp => { scores.push(inp.value || "0"); }); 
            return scores;
        };

        updateData['home-score'] = getInningScores('home');
        updateData['away-score'] = getInningScores('away');
        updateData['home-run'] = document.getElementById(`row-home`).querySelector('.r-val').value || "0";
        updateData['home-hit'] = document.getElementById('h-home').value || "0";
        updateData['home-error'] = document.getElementById('e-home').value || "0";
        updateData['home-ball'] = document.getElementById('b-home').value || "0"; 

        updateData['away-run'] = document.getElementById(`row-away`).querySelector('.r-val').value || "0";
        updateData['away-hit'] = document.getElementById('h-away').value || "0";
        updateData['away-error'] = document.getElementById('e-away').value || "0";
        updateData['away-ball'] = document.getElementById('b-away').value || "0"; 

        // 3. 라인업 수집
        const startLineupArr = [];
        document.querySelectorAll('#table-starting tbody tr').forEach((tr, index) => {
            const order = index + 1; 
            const pos = tr.querySelector('.pos-select').value; 
            const rawName = tr.querySelector('.player-input').value; 
            const type = tr.querySelector('.type-input').value; 
            if (rawName) {
                const { name, number } = parseNameNum(rawName);
                startLineupArr.push(`${order},${number},${name},${pos},${type}`);
            }
        });
        updateData['start-line-up'] = startLineupArr;

        const pitcherLineupArr = [];
        document.querySelectorAll('#table-pitcher tbody tr').forEach((tr, index) => {
            const order = index + 1; 
            const rawName = tr.querySelector('.player-input').value; 
            const inn = tr.querySelectorAll('input')[1].value; 
            if (rawName) {
                const { name, number } = parseNameNum(rawName);
                pitcherLineupArr.push(`${order},${number},${name},${inn}`);
            }
        });
        updateData['pitcher-line-up'] = pitcherLineupArr;

        let benchLineupArr = [];
        document.querySelectorAll('#table-bench tbody tr').forEach(tr => {
            const inn = tr.querySelector('.inning-select').value;
            const rawInName = tr.querySelector('.in-player').value; 
            const reason = tr.querySelector('.reason-select').value; 
            const rawOutName = tr.querySelector('.out-player').value; 
            if (rawInName) {
                const inP = parseNameNum(rawInName); 
                const outP = parseNameNum(rawOutName); 
                benchLineupArr.push({
                    inn: Number(inn),
                    str: `${inn},${inP.number},${inP.name},${reason},${outP.number},${outP.name}`
                });
            }
        });
        benchLineupArr.sort((a, b) => a.inn - b.inn);
        updateData['bench-line-up'] = benchLineupArr.map(item => item.str);

        // 4. 사진 처리 (기록 없음 모드에서도 가장 핵심 기능)
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
        updateData['photo'] = finalPhotos;

        // 최종 업데이트
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