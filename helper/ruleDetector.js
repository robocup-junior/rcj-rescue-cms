const { lineRun } = require('../models/lineRun');
const { mazeRun } = require('../models/mazeRun');
const { competition, LEAGUES_JSON } = require('../models/competition');

const { simRun } = require('../models/simRun');

const { ObjectId } = require('mongoose').Types;

async function _fromRunId(model, id) {
    if (!ObjectId.isValid(id)) {
        return -1;
    }
    try {
        const result = await model
            .findById(id, '-__v')
            .populate(['team', 'competition'])
            .exec();
        const type = LEAGUES_JSON.find((l) => l.id == result.team.league).type;
        const league = result.competition.leagues.find(
            (l) => l.league == result.team.league
        );
        return {
            type: type,
            rule: league.rule,
        };
    } catch {
        return '0';
    }
}

module.exports.getRuleFromLineRunId = async function (id) {
    let rule = await _fromRunId(lineRun, id);
    if (!rule) return null;
    return rule;
};

module.exports.getRuleFromMazeRunId = async function (id) {
    let rule = await _fromRunId(mazeRun, id);
    if (!rule) return null;
    return rule;
};

module.exports.getRuleFromSimulationRunId = async function (id) {
    let rule = await _fromRunId(simRun, id);
    if (!rule) return null;
    return rule;
};

module.exports.getRuleFromCompetitionId = async function (id) {
    if (!ObjectId.isValid(id)) {
        return -1;
    }
    try {
        const result = await competition.findById(id, '-__v').exec();
        return result.rule;
    } catch {
        return '0';
    }
};

module.exports.getLeagueTypeAndRule = async function (competitionId, leagueId) {
    const comp = await competition.findById(competitionId, '-__v').exec();
    if (comp) {
        const league = comp.leagues.find((l) => l.league == leagueId);
        const type = LEAGUES_JSON.find((l) => l.id == leagueId).type;
        if (league) {
            return {
                type: type,
                rule: league.rule,
            };
        }
    }
    return null;
};
