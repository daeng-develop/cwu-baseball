import { battingAdditionalStats } from './batting-stats.js';
import { pitchingDecisionCounts } from './pitching-decision.js';
const clean = (value) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
const text = (element) => clean(element?.textContent);
const integer = (value) => {
  if (clean(value) === '') return null;
  const number = Number(clean(value));
  return Number.isFinite(number) ? number : null;
};
const cells = (row, selector) => [...row.querySelectorAll(selector)].map(text);

function inningsToOuts(value) {
  const mixed = clean(value).match(/^(\d+)\s+(1|2)\/3$/);
  if (mixed) return Number(mixed[1]) * 3 + Number(mixed[2]);
  const decimal = clean(value).match(/^(\d+)(?:\.([012]))?$/);
  return decimal ? Number(decimal[1]) * 3 + Number(decimal[2] || 0) : null;
}

export function parseKbsaHtml(html, gameIdx, options = {}) {
  const document = new DOMParser().parseFromString(html, 'text/html');
  const name = text(document.querySelector('.game_summary .game_name dt'));
  const detail = text(document.querySelector('.game_summary .game_name dd'));
  const dateMatch = detail.match(
    /(20\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})\s+(\d{1,2}:\d{2})\s*(.*)/,
  );
  if (!dateMatch)
    throw Error('경기 날짜와 시간을 찾지 못했습니다. 기록 페이지의 HTML 파일인지 확인해 주세요.');
  const date = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
  const teams = ['.team1', '.team2'].map((selector) => ({
    name: text(document.querySelector(`.game_summary .hero_sum ${selector} .team .txt`)),
    score: integer(
      text(document.querySelector(`.game_summary .hero_sum ${selector} .team .score`)),
    ),
  }));
  const tableNames = [...document.querySelectorAll('.game_summary .box_table tbody tr')]
    .map((row) => text(row.querySelector('th')))
    .filter(Boolean);
  const recordNames = [
    ...new Set(
      [...document.querySelectorAll('.game_detail .section_sumrec h4')]
        .map((heading) =>
          text(heading)
            .replace(/\s*(타자|투수)기록.*$/, '')
            .trim(),
        )
        .filter(Boolean),
    ),
  ];
  teams.forEach((team, index) => {
    if (!team.name) team.name = tableNames[index] || recordNames[index] || '';
  });
  const cwuIndex = teams.findIndex((team) => /청운/.test(team.name));
  if (cwuIndex < 0 && !options.includeAllTeams) throw Error('청운대 경기로 확인되지 않았습니다.');
  if (teams.some((team) => !team.name)) throw Error('원본에서 양 팀 이름을 찾지 못했습니다.');
  const selectedIndex = cwuIndex < 0 ? 0 : cwuIndex;
  const otherIndex = 1 - selectedIndex;
  const scoreRows = [...document.querySelectorAll('.game_summary .box_table tbody tr')].map(
    (row) => ({
      team: text(row.querySelector('th')),
      values: cells(row, 'th, td').slice(1),
    }),
  );
  const scoreHeaders = cells(
    document.querySelector('.game_summary .box_table thead tr:last-child') ||
      document.createElement('tr'),
    'th, td',
  ).map((header) => header.toUpperCase());
  const cwuInnings = scoreRows.find((row) => row.team === teams[selectedIndex].name)?.values || [];
  const otherInnings = scoreRows.find((row) => row.team === teams[otherIndex].name)?.values || [];
  const columns =
    scoreHeaders.length === cwuInnings.length + 1 ? scoreHeaders.slice(1) : scoreHeaders;
  const runsIndex = columns.findIndex((header) => header === 'R');
  const trailingTotals =
    cwuInnings.length >= 11 &&
    integer(cwuInnings.at(-4)) === teams[selectedIndex].score &&
    integer(otherInnings.at(-4)) === teams[otherIndex].score;
  const inningCount =
    runsIndex >= 0 ? runsIndex : trailingTotals ? cwuInnings.length - 4 : cwuInnings.length;
  const scoreboard = Object.fromEntries(
    [
      ['cwu', cwuInnings],
      ['opponent', otherInnings],
    ].map(([team, values]) => [
      team,
      Object.fromEntries(
        ['r', 'h', 'e', 'b'].map((key, offset) => {
          const headerIndex = columns.findIndex((header) => header === key.toUpperCase());
          return [
            key,
            headerIndex >= 0
              ? integer(values[headerIndex])
              : values.length >= inningCount + 4
                ? integer(values[inningCount + offset])
                : null,
          ];
        }),
      ),
    ]),
  );
  const lastInning = Math.max(
    cwuInnings.slice(0, inningCount).findLastIndex(Boolean),
    otherInnings.slice(0, inningCount).findLastIndex(Boolean),
  );
  const innings = Array.from({ length: Math.min(lastInning + 1, 20) }, (_, index) => ({
    cwu: integer(cwuInnings[index]),
    opponent: integer(otherInnings[index]),
  }));
  const records = new Map();
  const lineup = [];
  const pitchingLineup = [];
  let battingSections = 0;
  let pitchingSections = 0;
  for (const section of document.querySelectorAll('.game_detail .section_sumrec')) {
    const heading = text(section.querySelector('h4'));
    if (!options.includeAllTeams && !/청운/.test(heading)) continue;
    const teamName = heading.replace(/\s*(타자|투수)기록.*$/, '').trim();
    const batting = heading.includes('타자기록');
    const pitching = heading.includes('투수기록');
    if (!batting && !pitching) continue;
    if (batting) battingSections++;
    if (pitching) pitchingSections++;
    for (const row of section.querySelectorAll('table tbody tr:not(.sum)')) {
      const headers = cells(row, 'th');
      const identity = clean(batting ? headers[2] : headers[0]).match(/^(.+?)\s*\((\d+)\)$/);
      if (!identity) continue;
      const td = cells(row, 'td');
      const playerName = clean(identity[1]);
      const number = identity[2];
      const key = `${teamName}:${number}:${playerName}`;
      const record = records.get(key) || {
        playerName,
        number,
        teamName,
        position: batting ? headers[1] : '투수',
        atBats: 0,
        hits: 0,
        rbi: 0,
        runs: 0,
        homeRuns: 0,
        inningsPitched: '',
        inningsOuts: 0,
        strikeouts: 0,
      };
      if (batting) {
        if (td.length < 5) continue;
        const [atBats, hits, rbi, runs] = td.slice(-5).map(integer);
        if ([atBats, hits, rbi, runs].some((n) => n === null)) continue;
        const order = headers[0];
        if (Number(order) > 9) continue;
        const previous = lineup.filter((entry) => entry.order === order);
        const events = td
          .slice(0, -5)
          .flatMap((value, index) => (value ? [{ inning: index + 1, text: value }] : []));
        const eventText = events.map((event) => event.text).join(',');
        const entryType = previous.length
          ? /대타/.test(eventText)
            ? '대타'
            : /대주자/.test(eventText)
              ? '대주자'
              : /대수비/.test(eventText)
                ? '대수비'
                : '교체 출전'
          : '선발';
        const homeRuns = events.reduce(
          (count, event) => count + event.text.split(',').filter((part) => /홈/.test(part)).length,
          0,
        );
        const battingRecord = {
          order,
          lineupSequence: lineup.length,
          position: headers[1],
          entryType,
          replacedPlayerName: previous.at(-1)?.playerName || '',
          atBats,
          hits,
          rbi,
          runs,
          homeRuns,
          battingAverage: td.at(-1),
          events,
        };
        lineup.push({
          playerName,
          number,
          order,
          lineupSequence: lineup.length,
          position: headers[1],
          entryType,
          replacedPlayerName: battingRecord.replacedPlayerName,
        });
        record.position = headers[1] || record.position;
        record.batting = { ...battingRecord, ...battingAdditionalStats(battingRecord) };
        record.atBats += atBats;
        record.hits += hits;
        record.rbi += rbi;
        record.runs += runs;
        record.homeRuns += homeRuns;
      }
      if (pitching) {
        if (td.length < 15) continue;
        const outs = inningsToOuts(td[4]);
        if (outs === null) continue;
        record.pitching = {
          appearanceOrder: pitchingLineup.length,
          appearance: td[0],
          decision: td[1],
          ...pitchingDecisionCounts(td[1]),
          decisionStatsVersion: 2,
          seasonWins: integer(td[2]),
          seasonLosses: integer(td[3]),
          inningsPitched: td[4],
          inningsOuts: outs,
          battersFaced: integer(td[5]),
          pitchCount: integer(td[6]),
          atBatsAgainst: integer(td[7]),
          hitsAllowed: integer(td[8]),
          homeRunsAllowed: integer(td[9]),
          walksAndHitByPitch: integer(td[10]),
          strikeouts: integer(td[11]),
          runsAllowed: integer(td[12]),
          earnedRuns: integer(td[13]),
          era: td[14],
        };
        pitchingLineup.push({
          playerName,
          number,
          appearanceOrder: pitchingLineup.length,
          appearance: td[0],
          decision: td[1],
        });
        record.inningsOuts += outs;
        record.inningsPitched = td[4];
        record.strikeouts += integer(td[11]) || 0;
        record.hitsAllowed = (record.hitsAllowed || 0) + (integer(td[8]) || 0);
        record.runsAllowed = (record.runsAllowed || 0) + (integer(td[12]) || 0);
        record.earnedRuns = (record.earnedRuns || 0) + (integer(td[13]) || 0);
        record.pitches = (record.pitches || 0) + (integer(td[6]) || 0);
      }
      records.set(key, record);
    }
  }
  if (!battingSections || !pitchingSections || !records.size)
    throw Error('청운대 선수 기록표를 판독하지 못했습니다.');
  if (
    !options.includeAllTeams &&
    (teams[selectedIndex].score === null || teams[otherIndex].score === null)
  )
    throw Error('경기 점수를 판독하지 못했습니다.');
  return {
    game: {
      date,
      time: dateMatch[4],
      competition: name,
      venue: clean(dateMatch[5]),
      opponent: teams[otherIndex].name,
      status: 'finished',
      cwuScore: teams[selectedIndex].score,
      opponentScore: teams[otherIndex].score,
      innings,
      scoreboard,
      lineup,
      pitchingLineup,
      teams,
      sourceGameId: String(gameIdx),
      sourceUrl: `https://www.korea-baseball.com/game/record_detail?game_idx=${gameIdx}`,
    },
    records: [...records.values()],
    year: dateMatch[1],
  };
}
