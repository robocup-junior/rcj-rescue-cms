const { ACCESSLEVELS, user } = require('../models/user');

async function authCompetitionRole(authUser, competitionId, expectedRole) {
    let userObj = authUser;
    if (userObj == undefined) return false;
    if (typeof userObj == 'string' || userObj.competitions == undefined) {
        userObj = await user.findById(userObj).lean().exec();
        if (userObj == undefined) return false;
    }
    return (
        userObj.superDuperAdmin ||
        (userObj.competitions.length != 0 &&
            userObj.competitions
                .find((c) => c.id.equals(competitionId))
                .role.includes(expectedRole))
    );
}
module.exports.authCompetitionRole = authCompetitionRole;

function authCompetition(user, competitionId, level) {
    if (user == null) {
        return false;
    }

    if (user.superDuperAdmin) {
        return true;
    }
    if (user.competitions != undefined) {
        return user.competitions.some(
            (c) => c.id.toString() == competitionId && c.accessLevel >= level
        );
    }
    return false;
}
module.exports.authCompetition = authCompetition;

function authViewRun(user, run, level, preparation = false) {
    let competitionId;
    if (run == null) {
        return 0;
    }

    if (user == null) {
        if (run.sign.captain != '' || run.status == 6) {
            if (preparation) return 0;
            return 2;
        }
        return 0;
    }

    if (user.superDuperAdmin) {
        return 1;
    }

    if (run.competition != undefined && typeof run.competition == 'string') {
        competitionId = run.competition;
    } else if (
        run.competition != undefined &&
        typeof run.competition == 'object'
    ) {
        competitionId = run.competition._id;
    }
    if (authCompetition(user, competitionId, level)) {
        return 1;
    }
    if (run.sign.captain != '' || run.status == 6) {
        if (preparation) return 0;
        return 2;
    }
    return 0;
}
module.exports.authViewRun = authViewRun;

function authJudgeRun(user, run, level) {
    let competitionId;
    if (run == null) {
        return false;
    }
    if (user == null) {
        return false;
    }

    if (user.superDuperAdmin) {
        return true;
    }
    if (run.competition != undefined && run.competition.constructor == String) {
        competitionId = run.competition;
    } else if (
        run.competition != undefined &&
        run.competition.constructor == Object
    ) {
        competitionId = run.competition._id;
    }
    if (authCompetition(user, competitionId, level)) {
        return true;
    }
    return false;
}
module.exports.authJudgeRun = authJudgeRun;

function competitionLevel(user, competitionId) {
    if (user == null) {
        return ACCESSLEVELS.NONE;
    }
    if (competitionId == null) {
        return ACCESSLEVELS.NONE;
    }
    if (user.superDuperAdmin) {
        return ACCESSLEVELS.SUPERADMIN;
    }
    if (user.competitions != undefined) {
        const cp = user.competitions.find(
            (c) => c.id.toString() == competitionId
        );
        if (cp) return cp.accessLevel;
    }
    return ACCESSLEVELS.NONE;
}
module.exports.competitionLevel = competitionLevel;
