const rules = {};
const scoreSheetPath = require('path').join(__dirname, 'scoreSheetPDFMazeRules');

let supportedRules = [];
require('fs')
  .readdirSync(scoreSheetPath)
  .forEach((file) => {
    const name = file.replace(/\.js$/, '');
    rules[name] = require(`./scoreSheetPDFMazeRules/${file}`);
    supportedRules.push(name);
  });

const mazeSSR = require('./mazeSSR');
const fs = require('fs');
const path = require('path');

async function ensureMapImages(runs) {
  const tmpDir = path.join(__dirname, '../tmp/course');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  const mapIds = new Set();
  for (const run of runs) {
    if (run.map && run.map._id) {
      if (!mapIds.has(run.map._id.toString())) {
        mapIds.add(run.map._id.toString());
        const buffer = await mazeSSR.generatePNG(run.map);
        fs.writeFileSync(path.join(tmpDir, `${run.map._id}.png`), buffer);
      }
    }
  }
}

module.exports.generateScoreSheet = async function (res, runs) {
  await ensureMapImages(runs);
  if (runs.length > 0) {
    let run = runs[0];
    const league = run.competition.leagues.find((l) => l.league == run.team.league);
    return rules[league.rule].generateScoreSheet(res, runs)
  }
  return rules[supportedRules[0]].generateScoreSheet(res, runs)
};

module.exports.generateScoreSheetsFromMaps = async function (res, maps, rule, noQR = false) {
  const dummyRuns = maps.map(map => {
    return {
      _id: map._id || '000000000000000000000000',
      competition: {
        name: (map.competition && map.competition.name) || 'Competition',
        logo: (map.competition && map.competition.logo) || '',
        leagues: [{
          league: map.league || 'Maze',
          rule: rule
        }]
      },
      team: {
        name: '',
        teamCode: '',
        league: map.league || 'Maze',
      },
      startTime: null,
      round: { name: '' },
      field: { name: '' },
      map: map,
      noQR: noQR || map.noQR,
      diceNumber: (typeof map.dice === 'number' && map.dice >= 1 && map.dice <= 6 ? map.dice : (Array.isArray(map.dice) && typeof map.dice[0] === 'number' && map.dice[0] >= 1 && map.dice[0] <= 6 ? map.dice[0] : null)),
    };
  });

  return await module.exports.generateScoreSheet(res, dummyRuns);
};

module.exports.generateScoreSheetFromMap = async function (res, map, rule) {
  return await module.exports.generateScoreSheetsFromMaps(res, [map], rule, map.noQR);
};
