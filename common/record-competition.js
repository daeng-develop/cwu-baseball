// A competition belongs to a specific school and season, even if its title repeats.
export function recordCompetition(record, game = record) {
  const date = String(game.date || record.date || '');
  const year = date.match(/^(\d{4})[-/.]/)?.[1] ||
    (/^\d{4}$/.test(String(game.recordYear || record.recordYear || game.year || '')) ? String(game.recordYear || record.recordYear || game.year) : '');
  const school = String(record.teamName || game.teamName || '청운대').trim();
  const competition = String(game.competition || record.competition || '기타 대회').trim();
  return { recordYear: year, competitionKey: JSON.stringify([school, year, competition]), competitionStatsVersion: 1 };
}
export function historyMatches(record, filters) {
  const meta = recordCompetition(record);
  return (!filters.school || (record.teamName || '학교 미등록') === filters.school) &&
    (!filters.year || (meta.recordYear || '미등록') === filters.year) &&
    (!filters.competition || JSON.stringify([meta.recordYear, record.competition || '기타 대회']) === filters.competition);
}
