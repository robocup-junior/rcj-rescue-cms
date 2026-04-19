const rules = {};
const scoreSheetPath = require('path').join(
    __dirname,
    'scoreSheetPDFMazeRules'
);

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
        const league = run.competition.leagues.find(
            (l) => l.league == run.team.league
        );
        return rules[league.rule].generateScoreSheet(res, runs);
    }
    return rules[supportedRules[0]].generateScoreSheet(res, runs);
};
