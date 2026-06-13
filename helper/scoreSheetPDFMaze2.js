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

  const mapKeys = new Set();
  for (const run of runs) {
    if (run.map) {
      const mapKey = run.map._id ? run.map._id.toString() : `inline-${runs.indexOf(run)}`;
      if (!mapKeys.has(mapKey)) {
        mapKeys.add(mapKey);
        let rule = '2026';
        if (run.competition && run.competition.leagues && run.team) {
          const league = run.competition.leagues.find((l) => l.league == run.team.league);
          if (league) rule = league.rule;
        }

        run.mapImageBuffer = await mazeSSR.generatePNG(run.map, rule);
        if (!run.map._id) continue;

        const buffer = run.mapImageBuffer;
        fs.writeFileSync(path.join(tmpDir, `${run.map._id}.png`), buffer);
      } else if (run.map._id) {
        const existingPath = path.join(tmpDir, `${run.map._id}.png`);
        if (fs.existsSync(existingPath)) run.mapImageBuffer = fs.readFileSync(existingPath);
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
