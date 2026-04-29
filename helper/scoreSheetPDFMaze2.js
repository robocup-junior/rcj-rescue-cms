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

module.exports.generateScoreSheet = function (res, runs) {
  if (runs.length > 0) {
    let run = runs[0];
    const league = run.competition.leagues.find((l) => l.league == run.team.league);
    return rules[league.rule].generateScoreSheet(res, runs)
  }
  return rules[supportedRules[0]].generateScoreSheet(res, runs)
};

module.exports.generateScoreSheetsFromMaps = async function (res, maps, rule, noQR = false) {
  // Ensure tmp/course directory exists
  const tmpDir = path.join(__dirname, '../tmp/course');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  // Pre-generate map images for the score sheets
  for (const map of maps) {
    const buffer = await mazeSSR.generatePNG(map);
    fs.writeFileSync(path.join(tmpDir, `${map._id}.png`), buffer);
  }

  const dummyRuns = maps.map(map => {
    return {
      _id: map._id || '000000000000000000000000',
      competition: {
        name: (map.competition && map.competition.name) || 'Competition',
        logo: (map.competition && map.competition.logo) || '',
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

  if (rules[rule]) {
    return rules[rule].generateScoreSheet(res, dummyRuns);
  }
  return rules[supportedRules[0]].generateScoreSheet(res, dummyRuns);
};

module.exports.generateScoreSheetFromMap = async function (res, map, rule) {
  return await module.exports.generateScoreSheetsFromMaps(res, [map], rule, map.noQR);
};
