const rules = {};
const scoreCalculatorPath = require('path').join(
    __dirname,
    'scoreCalculatorRules'
);
const { LEAGUES_JSON } = require('../models/competition');

require('fs')
    .readdirSync(scoreCalculatorPath)
    .forEach((file) => {
        const name = file.replace(/\.js$/, '');
        rules[name] = require(`./scoreCalculatorRules/${file}`);
    });

module.exports.calculateScore = function (run) {
    const type = LEAGUES_JSON.find((l) => l.id == run.team.league).type;
    const league = run.competition.leagues.find(
        (l) => l.league == run.team.league
    );

    let reuleSet = rules[league.rule];
    if (type == 'line') return reuleSet.calculateLineScore(run);
    else return reuleSet.calculateMazeScore(run);
};
