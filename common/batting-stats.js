// Plate appearances include at-bats and non-at-bat completed appearances.
export function battingAdditionalStats(batting) {
  const unknown = { walks: null, hitByPitch: null, plateAppearances: null, walksAndHitByPitch: null, battingStatsVersion: 2 };
  if (!Array.isArray(batting?.events)) return unknown;
  const tokens = batting.events.flatMap((event) => String(event.text || '').split(/[,，\n]/)).map((value) => value.trim()).filter(Boolean);
  if (!tokens.length && Number(batting.atBats) > 0) return unknown;
  const count = (pattern) => tokens.filter((value) => pattern.test(value)).length;
  const walks = count(/^(?:볼넷|고의\s*4구|고의사구|고4|4구)(?:$|\s|\()/);
  const hitByPitch = count(/^(?:사구|몸에\s*맞는\s*공|몸맞는공)(?:$|\s|\()/);
  const sacrificeBunts = count(/희생번트|희번/);
  const sacrificeFlies = count(/희생플라이|희비/);
  const interference = count(/타격방해|포수방해/);
  const atBats = Number(batting.atBats);
  return { walks, hitByPitch, walksAndHitByPitch: walks + hitByPitch,
    sacrificeBunts, sacrificeFlies, interference,
    plateAppearances: Number.isFinite(atBats) && atBats >= 0 ? atBats + walks + hitByPitch + sacrificeBunts + sacrificeFlies + interference : null,
    battingStatsVersion: 2 };
}

// Imported pitcher rows also contain zero-valued flat batting totals.
export function hasBattingRecord(record) {
  const batting = record.batting;
  const counts = ['atBats', 'hits', 'rbi', 'runs', 'homeRuns', 'plateAppearances', 'walks', 'hitByPitch'];
  if (batting && Number(batting.order) > 9) return false;
  if (counts.some((key) => Number(batting?.[key] ?? record[key]) > 0)) return true;
  if (!batting) return false;
  if (Number(batting.order) >= 1 && Number(batting.order) <= 9 || batting.entryType || batting.lineupSequence != null || batting.events?.length) return true;
  return !record.pitching;
}
