/* admin/admin-match.js */
import { db, storage } from "../../firebase/firebase.js";

// [전역 상태 변수]
let selectedMatchId = null; 
let currentKeptPhotos = [];
let photosPendingDelete = [];
let globalPlayersData = []; 

document.addEventListener("DOMContentLoaded", () => {
    const currentYear = new Date().getFullYear().toString();
    loadAllPlayers(currentYear); // 선수 데이터 로드
    loadPastMatches(); // 경기 목록 로드

    const matchSelect = document.getElementById('match-select');
    if (matchSelect) {
        matchSelect.addEventListener('change', handleMatchSelect);
    }
    
    const statusEl = document.getElementById('match-result-status');
    if (statusEl) {
        statusEl.addEventListener('change', toggleWinStats);
        statusEl.addEventListener('change', updateFormVisibility);
    }

    const checkScoreboardEl = document.getElementById('check-detail-scoreboard');
    if (checkScoreboardEl) {
        checkScoreboardEl.addEventListener('change', updateFormVisibility);
        checkScoreboardEl.addEventListener('change', toggleWinStats);
    }
    const checkLineupEl = document.getElementById('check-detail-lineup');
    if (checkLineupEl) {
        checkLineupEl.addEventListener('change', updateFormVisibility);
    }

    const winPitcherEl = document.getElementById('win-pitcher');
    if (winPitcherEl) setupAutocomplete(winPitcherEl);

    // 상황/교체 추가 버튼 이벤트
    const btnAddBench = document.getElementById('btn-add-bench');
    if (btnAddBench) {
        btnAddBench.addEventListener('click', () => {
            const tbody = document.querySelector('#table-bench tbody');
            if (tbody) addBenchRow(tbody, "1", "", "", "defense_change", "", "");
        });
    }

    const btnAddBatter = document.getElementById('btn-add-batter');
    if (btnAddBatter) {
        btnAddBatter.addEventListener('click', () => {
            const tbody = document.querySelector('#table-starting tbody');
            if (tbody) addBatterRow(tbody);
        });
    }

    const saveBtn = document.getElementById('btn-save-record');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveMatchRecord);
    }
});

/**
 * 1. UI 가시성 제어
 */
function updateFormVisibility() {
    const statusEl = document.getElementById('match-result-status');
    const checkScoreboardEl = document.getElementById('check-detail-scoreboard');
    const checkLineupEl = document.getElementById('check-detail-lineup');
    
    if (!statusEl) return;

    const status = statusEl.value;
    const isScoreboardChecked = checkScoreboardEl ? checkScoreboardEl.checked : false;
    const isLineupChecked = checkLineupEl ? checkLineupEl.checked : false;
    
    const scoreboardSection = document.getElementById('section-scoreboard');
    const lineupSection = document.getElementById('section-lineup');
    const detailCheckWrapper = document.getElementById('detail-check-wrapper');
    const winBox = document.getElementById('win-stats-box');
    
    const isSpecialStatus = ['no_record', 'rain_cancel', 'etc_cancel', 'rain_suspend', 'before'].includes(status);

    if (isSpecialStatus) {
        if (scoreboardSection) scoreboardSection.style.display = 'none';
        if (lineupSection) lineupSection.style.display = 'none';
        if (detailCheckWrapper) detailCheckWrapper.style.display = 'none';
        if (winBox) winBox.style.display = 'none'; 
    } else {
        if (scoreboardSection) scoreboardSection.style.display = 'block';
        if (detailCheckWrapper) detailCheckWrapper.style.display = 'flex';
        
        const detailColumns = document.querySelectorAll('.detail-column');
        if (isScoreboardChecked) {
            detailColumns.forEach(el => el.style.display = ''); 
            document.querySelectorAll('.detail-score').forEach(el => el.disabled = false);
            if (winBox) winBox.style.display = (status === 'win') ? 'grid' : 'none';
        } else {
            detailColumns.forEach(el => el.style.display = 'none');
            document.querySelectorAll('.detail-score').forEach(el => el.disabled = true);
            if (winBox) winBox.style.display = 'none';
        }

        if (isLineupChecked) {
            if (lineupSection) lineupSection.style.display = 'block';
        } else {
            if (lineupSection) lineupSection.style.display = 'none';
        }
    }
}

function toggleWinStats() {
    const statusEl = document.getElementById('match-result-status');
    const winBox = document.getElementById('win-stats-box');
    const checkScoreboardEl = document.getElementById('check-detail-scoreboard'); 
    
    if (!statusEl || !winBox || !checkScoreboardEl) return;
    winBox.style.display = (statusEl.value === 'win' && checkScoreboardEl.checked) ? 'grid' : 'none';
}

/**
 * 2. 데이터 로드 (handleMatchSelect)
 * 타자 이닝별 결과 및 투수 독립 테이블 로직 반영
 */
async function handleMatchSelect(e) {
    selectedMatchId = e.target.value;
    if (!selectedMatchId) {
        document.getElementById('record-form').style.display = 'none';
        return;
    }

    try {
        const doc = await db.collection("match").doc(selectedMatchId).get();
        if (!doc.exists) return;
        const data = doc.data();

        // 기본 정보
        document.getElementById('info-title').textContent = data.title;
        document.getElementById('info-meta').textContent = `${data.date} | ${data.location}`;
        const nameHomeEl = document.getElementById('name-home');
        const nameAwayEl = document.getElementById('name-away');
        nameAwayEl.textContent = data.homeAway === 'home' ? data.opponent : '청운대학교';
        nameHomeEl.textContent = data.homeAway === 'home' ? '청운대학교' : data.opponent;

        document.getElementById('match-result-status').value = data.status || 'before';

        // 스코어보드
        ['home', 'away'].forEach(team => {
            const arr = data[`${team}-score`];
            const row = document.getElementById(`row-${team}`);
            if (arr) {
                const inputs = row.querySelectorAll('.score-in');
                arr.forEach((val, idx) => { if (inputs[idx]) inputs[idx].value = val; });
            }
            row.querySelector('.r-val').value = data[`${team}-run`] || '0';
            document.getElementById(`h-${team}`).value = data[`${team}-hit`] || '0';
            document.getElementById(`e-${team}`).value = data[`${team}-error`] || '0';
            document.getElementById(`b-${team}`).value = data[`${team}-ball`] || '0';
        });

        if (document.getElementById('win-pitcher')) document.getElementById('win-pitcher').value = data['winning-pitcher'] || '';
        if (document.getElementById('mvp-player')) document.getElementById('mvp-player').value = data['run-bat-in'] || '';

        resetLineupTables();

        // ⭐ 타자 라인업 로드 (이닝별 결과 포함)
        if (data['start-line-up']) {
            const tbody = document.querySelector('#table-starting tbody');
            
            // 데이터(교체 포함)가 9개보다 많으면, 모자란 만큼 줄을 추가 생성합니다.
            while (tbody.children.length < data['start-line-up'].length) {
                addBatterRow(tbody);
            }

            const trs = tbody.querySelectorAll('tr');
            data['start-line-up'].forEach((str, i) => {
                if (trs[i]) {
                    const parts = str.split(','); 
                    
                    // ⭐ DB에 저장된 타순(parts[0])을 그대로 복원합니다.
                    const orderInput = trs[i].querySelector('.order-input');
                    if (orderInput) orderInput.value = parts[0] || ""; 
                    
                    trs[i].querySelector('.player-input').value = parts[2] ? `${parts[2]} (${parts[1]})` : "";
                    trs[i].querySelector('.pos-select').value = parts[3] || "";
                    trs[i].querySelector('.type-input').value = parts[4] || "";
                    
                    if (parts[5]) {
                        const innResults = parts[5].split('|');
                        const innInputs = trs[i].querySelectorAll('.inn-res-input');
                        innResults.forEach((res, idx) => { if (innInputs[idx]) innInputs[idx].value = res; });
                    }
                }
            });
        }

        // ⭐ 투수 라인업 로드
        if (data['pitcher-line-up']) {
            const pTbody = document.querySelector('#table-pitcher tbody');
            pTbody.innerHTML = '';
            data['pitcher-line-up'].forEach(str => {
                const p = str.split(',');
                addPitcherRow(pTbody, p[0], p[2]?`${p[2]} (${p[1]})` : "", p[3], p[4], p[5], p[6], p[7], p[8], p[9]);
            });
        }

        // 교체 명단
        const benchTbody = document.querySelector('#table-bench tbody');
        if (benchTbody) {
            benchTbody.innerHTML = '';
            if (data['bench-line-up']) {
                data['bench-line-up'].forEach(str => {
                    const parts = str.split(',');
                    if (parts.length >= 6) addBenchRow(benchTbody, parts[0], parts[1], parts[2], parts[3], parts[4], parts[5]);
                });
            }
        }

        currentKeptPhotos = data.photo || [];
        photosPendingDelete = [];
        renderPhotoPreviews();

        document.getElementById('check-detail-scoreboard').checked = data['home-score']?.some(v => v !== "0");
        document.getElementById('check-detail-lineup').checked = data['start-line-up']?.length > 0;

        document.getElementById('record-form').style.display = 'block';
        updateFormVisibility();

    } catch (error) {
        console.error("로드 오류:", error);
    }
}

/**
 * 3. 데이터 저장 (saveMatchRecord)
 * 타자 이닝별 결과 수집 및 투수 소수점 이닝 처리
 */
async function saveMatchRecord() {
    if (!selectedMatchId) return;
    const btn = document.getElementById('btn-save-record');
    const status = document.getElementById('match-result-status').value;
    
    btn.disabled = true;
    btn.innerText = "저장 중...";

    const updateData = { status: status };
    const isScoreboardChecked = document.getElementById('check-detail-scoreboard').checked;
    const isLineupChecked = document.getElementById('check-detail-lineup').checked;
    const isSpecialStatus = ['no_record', 'rain_cancel', 'etc_cancel', 'rain_suspend', 'before'].includes(status);

    try {
        // 점수 유효성 검사
        if (status !== 'no_record' && !isSpecialStatus) {
            const nameHome = document.getElementById('name-home').textContent.trim();
            const homeRunStr = document.getElementById(`row-home`).querySelector('.r-val').value.trim();
            const awayRunStr = document.getElementById(`row-away`).querySelector('.r-val').value.trim();
            const homeRun = Number(homeRunStr || 0);
            const awayRun = Number(awayRunStr || 0);

            let ourScore = nameHome.includes('청운대') ? homeRun : awayRun;
            let oppScore = nameHome.includes('청운대') ? awayRun : homeRun;

            if (homeRunStr !== "" || awayRunStr !== "") {
                if (status === 'win' && ourScore <= oppScore) throw new Error("승리인데 점수가 낮거나 같습니다.");
                if (status === 'loss' && ourScore >= oppScore) throw new Error("패배인데 점수가 높거나 같습니다.");
                if (status === 'draw' && ourScore !== oppScore) throw new Error("무승부인데 점수가 다릅니다.");
            }
        }

        // 스코어 데이터 수집
        if (isSpecialStatus || !isScoreboardChecked) {
            updateData['home-score'] = Array(12).fill("0");
            updateData['away-score'] = Array(12).fill("0");
            ['home', 'away'].forEach(t => { updateData[`${t}-hit`] = "0"; updateData[`${t}-error`] = "0"; updateData[`${t}-ball`] = "0"; });
        } else {
            const getInnings = (t) => Array.from(document.getElementById(`row-${t}`).querySelectorAll('.score-in')).map(i => i.value || "0");
            updateData['home-score'] = getInnings('home');
            updateData['away-score'] = getInnings('away');
            ['home', 'away'].forEach(t => {
                updateData[`${t}-hit`] = document.getElementById(`h-${t}`).value || "0";
                updateData[`${t}-error`] = document.getElementById(`e-${t}`).value || "0";
                updateData[`${t}-ball`] = document.getElementById(`b-${t}`).value || "0";
            });
            updateData['winning-pitcher'] = document.getElementById('win-pitcher')?.value || "";
            updateData['run-bat-in'] = document.getElementById('mvp-player')?.value || "";
        }

        // ⭐ 라인업 데이터 수집 (타자 이닝별 결과 + 투수 독립 테이블)
        if (isSpecialStatus || !isLineupChecked) {
            updateData['start-line-up'] = [];
            updateData['pitcher-line-up'] = [];
            updateData['bench-line-up'] = [];
        } else {
            // 타자 수집
            const startArr = [];
            document.querySelectorAll('#table-starting tbody tr').forEach((tr) => {
                // ⭐ index 대신 화면에 적힌 타순 값을 가져옵니다.
                const order = tr.querySelector('.order-input').value.trim(); 
                const nameRaw = tr.querySelector('.player-input').value;
                const pos = tr.querySelector('.pos-select').value;
                const type = tr.querySelector('.type-input').value;
                const innRes = Array.from(tr.querySelectorAll('.inn-res-input')).map(i => i.value.trim() || "");
                if (nameRaw) {
                    const { name, number } = parseNameNum(nameRaw);
                    // 배열의 첫 번째 값으로 order(타순) 삽입
                    startArr.push(`${order},${number},${name},${pos},${type},${innRes.join('|')}`);
                }
            });
            updateData['start-line-up'] = startArr;

            // 투수 수집 (소수점 이닝 허용)
            const pitchArr = [];
            document.querySelectorAll('#table-pitcher tbody tr').forEach((tr) => {
                const order = tr.querySelector('.p-order').value;
                const nameRaw = tr.querySelector('.player-input').value;
                const ip = tr.querySelector('.p-ip').value || "0";
                const h = tr.querySelector('.p-h').value || "0";
                const bb = tr.querySelector('.p-bb').value || "0";
                const k = tr.querySelector('.p-k').value || "0";
                const r = tr.querySelector('.p-r').value || "0";
                const er = tr.querySelector('.p-er').value || "0";
                const note = tr.querySelector('.p-note').value.trim();

                if (nameRaw) {
                    const { name, number } = parseNameNum(nameRaw);
                    // 저장 형식: 순서,번호,이름,이닝,피안타,4사구,삼진,실점,자책,비고
                    pitchArr.push(`${order},${number},${name},${ip},${h},${bb},${k},${r},${er},${note}`);
                }
            });
            updateData['pitcher-line-up'] = pitchArr;

            // 벤치 수집
            let benchArr = [];
            document.querySelectorAll('#table-bench tbody tr').forEach(tr => {
                const inn = tr.querySelector('.inning-select').value;
                const nameIn = tr.querySelector('.in-player').value;
                const reason = tr.querySelector('.reason-select').value;
                const nameOut = tr.querySelector('.out-player').value;
                if (nameIn) {
                    const inP = parseNameNum(nameIn);
                    const outP = parseNameNum(nameOut);
                    benchArr.push({ inn: Number(inn), str: `${inn},${inP.number},${inP.name},${reason},${outP.number},${outP.name}` });
                }
            });
            updateData['bench-line-up'] = benchArr.sort((a, b) => a.inn - b.inn).map(i => i.str);
        }

        updateData['home-run'] = document.getElementById(`row-home`).querySelector('.r-val').value || "0";
        updateData['away-run'] = document.getElementById(`row-away`).querySelector('.r-val').value || "0";

        // 사진 처리
        if (photosPendingDelete.length > 0) {
            await Promise.all(photosPendingDelete.map(url => {
                try { return storage.refFromURL(url).delete(); } catch(e) { return Promise.resolve(); }
            }));
        }
        const fileInput = document.getElementById('match-photos');
        let finalPhotos = [...currentKeptPhotos];
        if (fileInput.files.length > 0) {
            const uploads = Array.from(fileInput.files).map(async f => {
                const snap = await storage.ref(`match/${selectedMatchId}/${f.name}`).put(f);
                return await snap.ref.getDownloadURL();
            });
            finalPhotos = [...finalPhotos, ...(await Promise.all(uploads))];
        }
        updateData['photo'] = finalPhotos;

        await db.collection("match").doc(selectedMatchId).update(updateData);
        await db.collection("schedule").doc(selectedMatchId).update({ status: status });

        alert("저장 완료!");
        location.reload();

    } catch (error) {
        alert("오류: " + error.message);
        btn.disabled = false;
        btn.innerText = "경기 기록 저장";
    }
}

/**
 * 유틸리티 함수들
 */
function resetLineupTables() {
    // 모든 input 초기화 (type-input 제외)
    document.querySelectorAll('#table-starting input:not(.type-input), #table-pitcher input').forEach(i => i.value = '');
    document.querySelectorAll('#table-starting select').forEach(s => s.selectedIndex = 0);
    const benchTbody = document.querySelector('#table-bench tbody');
    if (benchTbody) benchTbody.innerHTML = '';
}

function parseNameNum(raw) {
    if (!raw) return { name: "", number: "" };
    const match = raw.match(/^(.+?)\s*\((\d+)\)$/);
    return match ? { name: match[1].trim(), number: match[2] } : { name: raw.trim(), number: "" };
}

function addBenchRow(tbody, inn="", numIn="", nameIn="", reason="", numOut="", nameOut="") {
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><select class="input-field inning-select">${Array.from({length:12}, (_, i)=>`<option value="${i+1}" ${inn==(i+1)?'selected':''}>${i+1}</option>`).join('')}</select>회</td>
        <td><input type="text" class="input-field in-player" value="${nameIn?`${nameIn} (${numIn})`:''}"></td>
        <td><select class="input-field reason-select">
            <option value="pinch_hitter" ${reason=='pinch_hitter'?'selected':''}>대타</option>
            <option value="pinch_runner" ${reason=='pinch_runner'?'selected':''}>대주자</option>
            <option value="pitcher_change" ${reason=='pitcher_change'?'selected':''}>투수교체</option>
            <option value="defense_change" ${reason=='defense_change'?'selected':''}>수비교체</option>
        </select></td>
        <td><input type="text" class="input-field out-player" value="${nameOut?`${nameOut} (${numOut})`:''}"></td>
        <td><button class="btn-remove-row" onclick="this.closest('tr').remove()">✕</button></td>
    `;
    tbody.appendChild(tr);
    setupAutocomplete(tr.querySelector('.in-player'));
    setupAutocomplete(tr.querySelector('.out-player'));
}

function loadPastMatches() {
    db.collection("schedule").where("status", "in", ["win", "loss", "draw", "no_record", "end", "before"])
    .orderBy("date", "desc").get().then(snapshot => {
        const select = document.getElementById('match-select');
        snapshot.forEach(doc => {
            const data = doc.data();
            const opt = document.createElement('option');
            opt.value = doc.id;
            opt.textContent = `[${data.date}] vs ${data.opponent} (${data.status})`;
            select.appendChild(opt);
        });
    });
}

function loadAllPlayers(year) {
    db.collection("players").doc(year).get().then(doc => {
        if (doc.exists) globalPlayersData = doc.data().players || [];
        document.querySelectorAll('.player-input').forEach(setupAutocomplete);
    });
}

function setupAutocomplete(inputEl) {
    if (!inputEl) return;
    inputEl.addEventListener('input', function() {
        const val = this.value.trim();
        closeAllLists();
        if (!val) return;
        const list = document.createElement("div");
        list.setAttribute("class", "autocomplete-items");
        this.parentNode.appendChild(list);
        globalPlayersData.filter(p => p.name.includes(val) || p.number.includes(val)).forEach(p => {
            const item = document.createElement("div");
            item.innerHTML = `<strong>${p.name}</strong> (${p.number}) - ${p.position}`;
            item.addEventListener("click", () => {
                inputEl.value = `${p.name} (${p.number})`;
                const row = inputEl.closest('tr');
                if (row && row.querySelector('.type-input')) row.querySelector('.type-input').value = p.type || "";
                closeAllLists();
            });
            list.appendChild(item);
        });
    });
}

function addBatterRow(tbody) {
    const tr = document.createElement('tr');
    let inningInputs = "";
    for(let j=1; j<=12; j++) {
        inningInputs += `<td><input type="text" class="input-field inn-res-input"></td>`;
    }
    
    tr.innerHTML = `
        <td><input type="text" class="input-field order-input" placeholder="타순" style="text-align:center;"></td>
        <td><input type="text" class="input-field player-input" placeholder="선수 검색"></td>
        <td>
            <select class="input-field pos-select">
                <option value="">선택</option>
                <option value="P">P</option><option value="C">C</option>
                <option value="1B">1B</option><option value="2B">2B</option>
                <option value="3B">3B</option><option value="SS">SS</option>
                <option value="LF">LF</option><option value="CF">CF</option>
                <option value="RF">RF</option><option value="DH">DH</option>
            </select>
        </td>
        <td><input type="text" class="input-field type-input" readonly></td>
        ${inningInputs}
        <td><button type="button" class="btn-remove-row" onclick="this.closest('tr').remove()">✕</button></td>
    `;
    
    tbody.appendChild(tr);
    
    // 새로 추가된 줄의 선수 입력칸에 자동완성 기능 연결
    const newPlayerInput = tr.querySelector('.player-input');
    if (typeof setupAutocomplete === 'function') {
        setupAutocomplete(newPlayerInput);
    }
}

function addPitcherRow(tbody, order="", nameRaw="", ip="0", h="0", bb="0", k="0", r="0", er="0", note="") {
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="text" class="input-field p-order" value="${order}" placeholder="순서" style="text-align:center;"></td>
        <td><input type="text" class="input-field player-input" value="${nameRaw}" placeholder="투수 검색"></td>
        <td><input type="number" class="input-field p-ip" step="0.1" value="${ip}"></td>
        <td><input type="number" class="input-field p-h" value="${h}"></td>
        <td><input type="number" class="input-field p-bb" value="${bb}"></td>
        <td><input type="number" class="input-field p-k" value="${k}"></td>
        <td><input type="number" class="input-field p-r" value="${r}"></td>
        <td><input type="number" class="input-field p-er" value="${er}"></td>
        <td><input type="text" class="input-field p-note" value="${note}" placeholder="비고"></td>
        <td><button type="button" class="btn-remove-row" onclick="this.closest('tr').remove()">✕</button></td>
    `;
    tbody.appendChild(tr);
    setupAutocomplete(tr.querySelector('.player-input'));
}

function closeAllLists() { document.querySelectorAll(".autocomplete-items").forEach(el => el.remove()); }

function renderPhotoPreviews() {
    const box = document.getElementById('photo-preview-box');
    box.innerHTML = "";
    if (currentKeptPhotos.length > 0) {
        box.style.display = 'flex';
        currentKeptPhotos.forEach((url, i) => {
            const div = document.createElement('div');
            div.className = 'photo-item';
            div.innerHTML = `<img src="${url}"><button type="button" class="btn-remove-photo" onclick="removePhoto(${i})">✕</button>`;
            box.appendChild(div);
        });
    } else { box.style.display = 'none'; }
}

window.removePhoto = (i) => {
    photosPendingDelete.push(currentKeptPhotos[i]);
    currentKeptPhotos.splice(i, 1);
    renderPhotoPreviews();
};