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

    // 경기 선택 이벤트
    const matchSelect = document.getElementById('match-select');
    if (matchSelect) {
        matchSelect.addEventListener('change', handleMatchSelect);
    }
    
    // 상태 변경 이벤트
    const statusEl = document.getElementById('match-result-status');
    if (statusEl) {
        statusEl.addEventListener('change', toggleWinStats);
        statusEl.addEventListener('change', updateFormVisibility);
    }

    // 상세 입력 체크박스 이벤트 (분리된 버전)
    const checkScoreboardEl = document.getElementById('check-detail-scoreboard');
    if (checkScoreboardEl) {
        checkScoreboardEl.addEventListener('change', updateFormVisibility);
        checkScoreboardEl.addEventListener('change', toggleWinStats);
    }
    const checkLineupEl = document.getElementById('check-detail-lineup');
    if (checkLineupEl) {
        checkLineupEl.addEventListener('change', updateFormVisibility);
    }

    // 자동완성 설정
    const winPitcherEl = document.getElementById('win-pitcher');
    if (winPitcherEl) setupAutocomplete(winPitcherEl);

    // 저장 버튼 이벤트
    const saveBtn = document.getElementById('btn-save-record');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveMatchRecord);
    }
});

/**
 * 1. UI 가시성 제어 (체크박스 상태에 따라 섹션 노출/숨김)
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

/**
 * 2. 승리 투수/결승타 입력창 토글
 */
function toggleWinStats() {
    const statusEl = document.getElementById('match-result-status');
    const winBox = document.getElementById('win-stats-box');
    const checkScoreboardEl = document.getElementById('check-detail-scoreboard'); 
    
    if (!statusEl || !winBox || !checkScoreboardEl) return;

    const status = statusEl.value;
    const isScoreboardChecked = checkScoreboardEl.checked; 
    
    winBox.style.display = (status === 'win' && isScoreboardChecked) ? 'grid' : 'none';
}

/**
 * 3. 경기 선택 시 데이터 로드 및 폼 전시
 */
async function handleMatchSelect(e) {
    selectedMatchId = e.target.value;
    if (!selectedMatchId) {
        document.getElementById('record-form').style.display = 'none';
        return;
    }

    try {
        const doc = await db.collection("match").doc(selectedMatchId).get();
        if (!doc.exists) {
            alert("상세 기록 데이터를 찾을 수 없습니다.");
            return;
        }
        const data = doc.data();

        // 헤더 정보 채우기
        document.getElementById('info-title').textContent = data.title;
        document.getElementById('info-meta').textContent = `${data.date} | ${data.location}`;
        document.getElementById('name-away').textContent = data.homeAway === 'home' ? data.opponent : '청운대학교';
        document.getElementById('name-home').textContent = data.homeAway === 'home' ? '청운대학교' : data.opponent;

        // 결과 상태값 설정
        document.getElementById('match-result-status').value = data.status || 'before';

        // 스코어보드 값 채우기
        ['home', 'away'].forEach(team => {
            const arr = data[`${team}-score`];
            const row = document.getElementById(`row-${team}`);
            if (arr && Array.isArray(arr)) {
                const scoreInputs = row.querySelectorAll('.score-in');
                arr.forEach((val, idx) => {
                    if (scoreInputs[idx]) scoreInputs[idx].value = val;
                });
            }
            // 총점 및 H/E/B
            row.querySelector('.r-val').value = data[`${team}-run`] || '0';
            document.getElementById(`h-${team}`).value = data[`${team}-hit`] || '0';
            document.getElementById(`e-${team}`).value = data[`${team}-error`] || '0';
            document.getElementById(`b-${team}`).value = data[`${team}-ball`] || '0';
        });

        // 승리투수 및 결승타
        const winPitcherEl = document.getElementById('win-pitcher');
        const mvpPlayerEl = document.getElementById('mvp-player');
        if (winPitcherEl) winPitcherEl.value = data['winning-pitcher'] || '';
        if (mvpPlayerEl) mvpPlayerEl.value = data['run-bat-in'] || '';

        // 라인업 초기화 및 채우기
        resetLineupTables();

        if (data['start-line-up']) {
            const trs = document.querySelectorAll('#table-starting tbody tr');
            data['start-line-up'].forEach((str, i) => {
                if (trs[i]) {
                    const parts = str.split(',');
                    trs[i].querySelector('.pos-select').value = parts[3] || "";
                    trs[i].querySelector('.player-input').value = parts[2] ? `${parts[2]} (${parts[1]})` : "";
                    trs[i].querySelector('.type-input').value = parts[4] || "";
                    const summaryInput = trs[i].querySelector('.stat-summary-input');
                    if (summaryInput) summaryInput.value = parts[5] || "";
                }
            });
        }

        if (data['pitcher-line-up']) {
            const trs = document.querySelectorAll('#table-pitcher tbody tr');
            data['pitcher-line-up'].forEach((str, i) => {
                if (trs[i]) {
                    const parts = str.split(',');
                    trs[i].querySelector('.player-input').value = parts[2] ? `${parts[2]} (${parts[1]})` : "";
                    trs[i].querySelectorAll('input')[1].value = parts[3] || "";
                    const summaryInput = trs[i].querySelector('.stat-summary-input');
                    if (summaryInput) summaryInput.value = parts[4] || "";
                }
            });
        }

        // 교체 명단 (Bench)
        const benchTbody = document.querySelector('#table-bench tbody');
        benchTbody.innerHTML = '';
        if (data['bench-line-up']) {
            data['bench-line-up'].forEach(str => {
                const parts = str.split(',');
                if (parts.length >= 6) {
                    addBenchRow(benchTbody, parts[0], parts[1], parts[2], parts[3], parts[4], parts[5]);
                }
            });
        }

        // 사진 미리보기
        currentKeptPhotos = data.photo || [];
        photosPendingDelete = [];
        renderPhotoPreviews();

        // 체크박스 자동 설정
        const isAllZeros = (arr) => Array.isArray(arr) && arr.length > 0 && arr.every(val => val === "0" || val === 0 || val === "");
        const hasLineup = data['start-line-up'] && data['start-line-up'].length > 0;
        const hasDetailScore = data['home-score'] && data['home-score'].length > 0 && !isAllZeros(data['home-score']);

        document.getElementById('check-detail-scoreboard').checked = hasDetailScore;
        document.getElementById('check-detail-lineup').checked = hasLineup;

        // 폼 전시 및 가시성 업데이트
        document.getElementById('record-form').style.display = 'block';
        updateFormVisibility();

    } catch (error) {
        console.error("경기 로드 중 오류:", error);
        alert("데이터를 불러오는 중 오류가 발생했습니다.");
    }
}

/**
 * 4. 경기 기록 저장
 */
async function saveMatchRecord() {
    if (!selectedMatchId) return;
    const btn = document.getElementById('btn-save-record');
    const statusEl = document.getElementById('match-result-status');
    if (!statusEl) return;
    
    const status = statusEl.value;
    btn.disabled = true;
    btn.innerText = "저장 중...";

    const updateData = { status: status };

    const isScoreboardChecked = document.getElementById('check-detail-scoreboard').checked;
    const isLineupChecked = document.getElementById('check-detail-lineup').checked;
    const isSpecialStatus = ['no_record', 'rain_cancel', 'etc_cancel', 'rain_suspend', 'before'].includes(status);

    try {
        // 1. 점수 유효성 검사 (0점 입력 시 보완됨)
        if (status !== 'no_record' && !isSpecialStatus) {
const nameHome = document.getElementById('name-home').textContent.trim(); // 양옆 공백 제거
const nameAway = document.getElementById('name-away').textContent.trim();
            
const homeRunStr = document.getElementById(`row-home`).querySelector('.r-val').value.trim();
const awayRunStr = document.getElementById(`row-away`).querySelector('.r-val').value.trim();

const homeRun = Number(homeRunStr || 0);
const awayRun = Number(awayRunStr || 0);

// '청운대'라는 단어가 포함되어 있기만 하면 우리 팀으로 정확히 인식합니다.
let ourScore = nameHome.includes('청운대') ? homeRun : awayRun;
let oppScore = nameHome.includes('청운대') ? awayRun : homeRun;

            if (homeRunStr !== "" || awayRunStr !== "") {
                if (status === 'win' && ourScore <= oppScore) throw new Error("승리인데 점수가 낮거나 같습니다.");
                if (status === 'loss' && ourScore >= oppScore) throw new Error("패배인데 점수가 높거나 같습니다.");
                if (status === 'draw' && ourScore !== oppScore) throw new Error("무승부인데 점수가 다릅니다.");
            }
        }

        // 2. 스코어보드 데이터 수집
        if (isSpecialStatus || !isScoreboardChecked) {
            updateData['home-score'] = Array(12).fill("0");
            updateData['away-score'] = Array(12).fill("0");
            updateData['winning-pitcher'] = "";
            updateData['run-bat-in'] = "";
            ['home', 'away'].forEach(t => {
                updateData[`${t}-hit`] = "0"; updateData[`${t}-error`] = "0"; updateData[`${t}-ball`] = "0";
            });
        } else {
            const getInningScores = (team) => Array.from(document.getElementById(`row-${team}`).querySelectorAll('.score-in')).map(inp => inp.value || "0");
            updateData['home-score'] = getInningScores('home');
            updateData['away-score'] = getInningScores('away');
            ['home', 'away'].forEach(t => {
                updateData[`${t}-hit`] = document.getElementById(`h-${t}`).value || "0";
                updateData[`${t}-error`] = document.getElementById(`e-${t}`).value || "0";
                updateData[`${t}-ball`] = document.getElementById(`b-${t}`).value || "0";
            });
            if (status === 'win') {
                updateData['winning-pitcher'] = document.getElementById('win-pitcher').value || "";
                updateData['run-bat-in'] = document.getElementById('mvp-player').value || "";
            }
        }

        // 3. 라인업 데이터 수집
        if (isSpecialStatus || !isLineupChecked) {
            updateData['start-line-up'] = [];
            updateData['pitcher-line-up'] = [];
            updateData['bench-line-up'] = [];
        } else {
            // 스타팅
            const startArr = [];
            document.querySelectorAll('#table-starting tbody tr').forEach((tr, idx) => {
                const nameRaw = tr.querySelector('.player-input').value;
                const pos = tr.querySelector('.pos-select').value;
                const type = tr.querySelector('.type-input').value;
                const summary = tr.querySelector('.stat-summary-input').value.trim();
                if (nameRaw) {
                    const { name, number } = parseNameNum(nameRaw);
                    startArr.push(`${idx + 1},${number},${name},${pos},${type},${summary}`);
                }
            });
            updateData['start-line-up'] = startArr;

            // 투수
            const pitchArr = [];
            document.querySelectorAll('#table-pitcher tbody tr').forEach((tr, idx) => {
                const nameRaw = tr.querySelector('.player-input').value;
                const inn = tr.querySelectorAll('input')[1].value;
                const summary = tr.querySelector('.stat-summary-input').value.trim();
                if (nameRaw) {
                    const { name, number } = parseNameNum(nameRaw);
                    pitchArr.push(`${idx + 1},${number},${name},${inn},${summary}`);
                }
            });
            updateData['pitcher-line-up'] = pitchArr;

            // 벤치
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
            updateData['bench-line-up'] = benchArr.sort((a, b) => a.inn - b.inn).map(item => item.str);
        }

        // 총점
        updateData['home-run'] = document.getElementById(`row-home`).querySelector('.r-val').value || "0";
        updateData['away-run'] = document.getElementById(`row-away`).querySelector('.r-val').value || "0";

        // 사진 업로드
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
        console.error("저장 실패:", error);
        alert("오류: " + error.message);
        btn.disabled = false;
        btn.innerText = "경기 기록 저장";
    }
}

/** 헬퍼 함수들 **/

function resetLineupTables() {
    document.querySelectorAll('#table-starting tbody tr, #table-pitcher tbody tr').forEach(tr => {
        tr.querySelectorAll('input:not(.type-input)').forEach(inp => inp.value = '');
        tr.querySelectorAll('select').forEach(sel => sel.selectedIndex = 0);
    });
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
        <td><select class="input-field reason-select"><option value="pinch_hitter" ${reason=='pinch_hitter'?'selected':''}>대타</option><option value="pinch_runner" ${reason=='pinch_runner'?'selected':''}>대주자</option><option value="pitcher_change" ${reason=='pitcher_change'?'selected':''}>투수교체</option><option value="defense_change" ${reason=='defense_change'?'selected':''}>수비교체</option></select></td>
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

function closeAllLists() {
    document.querySelectorAll(".autocomplete-items").forEach(el => el.remove());
}

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