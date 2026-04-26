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

module.exports.generateScoreSheet = function (res, runs) {
  if (runs.length > 0) {
    let run = runs[0];
    const league = run.competition.leagues.find((l) => l.league == run.team.league);
    return rules[league.rule].generateScoreSheet(res, runs)
  }
  return rules[supportedRules[0]].generateScoreSheet(res, runs)
};

module.exports.generateScoreSheetFromMap = function (res, map, rule) {
  const dummyRun = {
    _id: map._id || '000000000000000000000000',
    competition: {
      name: (map.competition && map.competition.name) || 'Competition',
      logo: (map.competition && map.competition.logo) || '',
    },
    team: {
      name: '',
      teamCode: '',
      league: 'Maze',
    },
    startTime: null,
    round: { name: '' },
    field: { name: '' },
    map: map,
    diceNumber: (typeof map.dice === 'number' && map.dice >= 1 && map.dice <= 6 ? map.dice : (Array.isArray(map.dice) && typeof map.dice[0] === 'number' && map.dice[0] >= 1 && map.dice[0] <= 6 ? map.dice[0] : null)),
  };

  if (rules[rule]) {
    return rules[rule].generateScoreSheet(res, [dummyRun]);
  }
  return rules[supportedRules[0]].generateScoreSheet(res, [dummyRun]);
};
