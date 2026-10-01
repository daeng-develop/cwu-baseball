export function pitchingDecisionCounts(decision) {
  if (decision === undefined || decision === null) return { wins: null, losses: null, saves: null, holds: null };
  const value = String(decision).replace(/\s+/g, '').toUpperCase();
  const known = ['', '-', '—', '없음', '승', '승리', '패', '패전', '세', '세이브', '홀', '홀드', 'W', 'L', 'S', 'SV', 'H', 'HLD'];
  if (!known.includes(value)) return { wins: null, losses: null, saves: null, holds: null };
  return { wins: ['승', '승리', 'W'].includes(value) ? 1 : 0,
    losses: ['패', '패전', 'L'].includes(value) ? 1 : 0,
    saves: ['세', '세이브', 'S', 'SV'].includes(value) ? 1 : 0,
    holds: ['홀', '홀드', 'H', 'HLD'].includes(value) ? 1 : 0 };
}
