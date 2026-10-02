// Plate appearances include at-bats and non-at-bat completed appearances.
function battingAdditionalStats(batting) {
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

function pitchingDecisionCounts(decision) {
  if (decision === undefined || decision === null) return { wins: null, losses: null, saves: null, holds: null };
  const value = String(decision).replace(/\s+/g, '').toUpperCase();
  const known = ['', '-', '—', '없음', '승', '승리', '패', '패전', '세', '세이브', '홀', '홀드', 'W', 'L', 'S', 'SV', 'H', 'HLD'];
  if (!known.includes(value)) return { wins: null, losses: null, saves: null, holds: null };
  return { wins: ['승', '승리', 'W'].includes(value) ? 1 : 0,
    losses: ['패', '패전', 'L'].includes(value) ? 1 : 0,
    saves: ['세', '세이브', 'S', 'SV'].includes(value) ? 1 : 0,
    holds: ['홀', '홀드', 'H', 'HLD'].includes(value) ? 1 : 0 };
}

const cheerio = require('cheerio');

const clean = (value) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
const integer = (value) => {
  if (clean(value) === '') return null;
  const n = Number(clean(value));
  return Number.isFinite(n) ? n : null;
};

function inningsToOuts(value) {
  const text = clean(value);
  const mixed = text.match(/^(\d+)\s+(1|2)\/3$/);
  if (mixed) return Number(mixed[1]) * 3 + Number(mixed[2]);
  const decimal = text.match(/^(\d+)(?:\.([012]))?$/);
  if (decimal) return Number(decimal[1]) * 3 + Number(decimal[2] || 0);
  return null;
}

function playerIdentity(value) {
  const match = clean(value).match(/^(.+?)\s*\((\d+)\)$/);
  if (!match) return null;
  return { playerName: clean(match[1]), number: match[2] };
}

function parseKbsaRecord(html, gameIdx, options = {}) {
  const $ = cheerio.load(html);
  const name = clean($('.game_summary .game_name dt').first().text());
  const detail = clean($('.game_summary .game_name dd').first().text());
  const dateMatch = detail.match(
    /(20\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})\s+(\d{1,2}:\d{2})\s*(.*)/,
  );
  if (!dateMatch) throw Error('경기 날짜와 시간을 찾지 못했습니다.');
  const date = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
  const year = dateMatch[1];
  const teams = ['.team1', '.team2'].map((selector) => ({
    name: clean($(`.game_summary .hero_sum ${selector} .team .txt`).text()),
    score: integer($(`.game_summary .hero_sum ${selector} .team .score`).text()),
  }));
  const tableNames = $('.game_summary .box_table tbody tr')
    .toArray()
    .map((row) => clean($(row).children('th').first().text()))
    .filter(Boolean);
  const recordNames = [
    ...new Set(
      $('.game_detail .section_sumrec h4')
        .toArray()
        .map((heading) =>
          clean($(heading).text())
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
  const scoreRows = $('.game_summary .box_table tbody tr')
    .toArray()
    .map((row) => ({
      team: clean($(row).children('th').first().text()),
      values: $(row)
        .children('th, td')
        .slice(1)
        .toArray()
        .map((cell) => clean($(cell).text())),
    }));
  const scoreHeaders = $('.game_summary .box_table thead tr')
    .last()
    .find('th, td')
    .toArray()
    .map((cell) => clean($(cell).text()).toUpperCase());
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
    cwuInnings.slice(0, inningCount).findLastIndex((value) => value !== ''),
    otherInnings.slice(0, inningCount).findLastIndex((value) => value !== ''),
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
  $('.game_detail .section_sumrec').each((_, section) => {
    const heading = clean($(section).children('h4').text());
    if (!options.includeAllTeams && !/청운/.test(heading)) return;
    const teamName = heading.replace(/\s*(타자|투수)기록.*$/, '').trim();
    const batting = heading.includes('타자기록');
    const pitching = heading.includes('투수기록');
    if (!batting && !pitching) return;
    if (batting) battingSections++;
    if (pitching) pitchingSections++;
    $(section)
      .find('table tbody tr')
      .not('.sum')
      .each((_, row) => {
        const headers = $(row)
          .children('th')
          .toArray()
          .map((cell) => clean($(cell).text()));
        const identity = playerIdentity(batting ? headers[2] : headers[0]);
        if (!identity) return;
        const cells = $(row)
          .children('td')
          .toArray()
          .map((cell) => clean($(cell).text()));
        const key = `${teamName}:${identity.number}:${identity.playerName}`;
        const record = records.get(key) || {
          ...identity,
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
          if (cells.length < 5) return;
          const [atBats, hits, rbi, runs] = cells.slice(-5).map(integer);
          if ([atBats, hits, rbi, runs].some((n) => n === null)) return;
          const order = headers[0];
          if (Number(order) > 9) return;
          const previous = lineup.filter((entry) => entry.order === order);
          const events = cells
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
            (count, event) =>
              count + event.text.split(',').filter((part) => /홈/.test(part)).length,
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
            battingAverage: cells.at(-1),
            events,
          };
          lineup.push({
            ...identity,
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
          if (cells.length < 15) return;
          const outs = inningsToOuts(cells[4]);
          if (outs === null) return;
          record.pitching = {
            appearanceOrder: pitchingLineup.length,
            appearance: cells[0],
            decision: cells[1],
            ...pitchingDecisionCounts(cells[1]),
            decisionStatsVersion: 2,
            seasonWins: integer(cells[2]),
            seasonLosses: integer(cells[3]),
            inningsPitched: cells[4],
            inningsOuts: outs,
            battersFaced: integer(cells[5]),
            pitchCount: integer(cells[6]),
            atBatsAgainst: integer(cells[7]),
            hitsAllowed: integer(cells[8]),
            homeRunsAllowed: integer(cells[9]),
            walksAndHitByPitch: integer(cells[10]),
            strikeouts: integer(cells[11]),
            runsAllowed: integer(cells[12]),
            earnedRuns: integer(cells[13]),
            era: cells[14],
          };
          pitchingLineup.push({
            ...identity,
            appearanceOrder: pitchingLineup.length,
            appearance: cells[0],
            decision: cells[1],
          });
          record.inningsOuts += outs;
          record.inningsPitched = cells[4];
          record.strikeouts += integer(cells[11]) || 0;
          record.hitsAllowed = (record.hitsAllowed || 0) + (integer(cells[8]) || 0);
          record.runsAllowed = (record.runsAllowed || 0) + (integer(cells[12]) || 0);
          record.earnedRuns = (record.earnedRuns || 0) + (integer(cells[13]) || 0);
          record.pitches = (record.pitches || 0) + (integer(cells[6]) || 0);
        }
        records.set(key, record);
      });
  });
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
    year,
  };
}

module.exports = { parseKbsaRecord, inningsToOuts };
