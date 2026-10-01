const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { parseKbsaRecord } = require('./kbsa-parser');

// This function only requests a validated game ID from the association site.
exports.previewKbsaGame = onCall(
  { region: 'asia-northeast3', timeoutSeconds: 35, memory: '256MiB', maxInstances: 3 },
  async (request) => {
    const id = String(request.data?.gameIdx || '');
    if (!/^\d{1,10}$/.test(id))
      throw new HttpsError('invalid-argument', '경기 ID를 확인해 주세요.');
    const url = `https://www.korea-baseball.com/game/record_detail?game_idx=${id}`;
    let response;
    try {
      response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CWUBaseballAdmin/1.0)' },
        signal: AbortSignal.timeout(25000),
      });
    } catch {
      throw new HttpsError('unavailable', '협회 기록 페이지에 연결할 수 없습니다.');
    }
    if (!response.ok) throw new HttpsError('unavailable', `협회 페이지 응답: ${response.status}`);
    const html = await response.text();
    if (html.length > 2_000_000) throw new HttpsError('resource-exhausted', '응답이 너무 큽니다.');
    try {
      return parseKbsaRecord(html, id, { includeAllTeams: request.data?.mode === 'history' });
    } catch (error) {
      throw new HttpsError('failed-precondition', error.message);
    }
  },
);
