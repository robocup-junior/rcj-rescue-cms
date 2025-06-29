const express = require('express');

const publicRouter = express.Router();
const privateRouter = express.Router();
const adminRouter = express.Router();
const { ObjectId } = require('mongoose').Types;
const { lineRun } = require('../../models/lineRun');
const { mazeRun } = require('../../models/mazeRun');
const { simRun } = require('../../models/simRun');
const { user } = require('../../models/user');
const auth = require('../../helper/authLevels');
const { ACCESSLEVELS } = require('../../models/user');
const competitiondb = require('../../models/competition');
const { review } = require('../../models/document');
const { VICTIMS } = require('../../models/mazeMap');

const MINIMUM_REVIEWER = 5


// For line
publicRouter.get('/:competitionId/:leagueId', async function (req, res, next) {
  const competition = req.params.competitionId;
  const league = req.params.leagueId;

  if (!ObjectId.isValid(competition)) {
    return next();
  }
  if (!competitiondb.LINE_LEAGUES.includes(league)) {
    return next();
  }

  let competitionDb = await competitiondb.competition.findById(competition).lean().exec();
  let rankingSettings = competitionDb.leagues.find(r => r.league == league);
  if (!rankingSettings) {
    rankingSettings = {
      mode: competitiondb.SUM_OF_BEST_N_GAMES,
      disclose: false,
      num: 20
    }
  }
  if (!rankingSettings.disclose && !auth.authCompetition(
    req.user,
    competition,
    ACCESSLEVELS.VIEW
  )) {
    return res.status(401).send();
  }
  let sumGameNumber = rankingSettings.num;
  let rankingMode = rankingSettings.mode;

  let allRunsDb = await lineRun.find({
    competition: competition
  }).select("team score normalizationGroup LoPs rescueOrder nl isNL time startTime round")
  .populate([
    {
      path: 'team',
      select: 'name teamCode league'
    },
    {
      path: 'round',
      select: 'name'
    }
  ]).lean().exec();

  let allRunsLeague = allRunsDb.filter(r => r.team.league == league);
  let allRounds =[...new Set(allRunsLeague.map(r => r.round.name))].sort();
  let allNormGroups =[...new Set(allRunsLeague.map(r => r.normalizationGroup))].sort();

  if (competitiondb.NORMALIZED_RANKING_MODE.includes(rankingMode)) {
    let normGroups = allRunsLeague.map(r => r.normalizationGroup);
    normGroups = [...new Set(normGroups)];
    let maxScore = {};
    for (let n of normGroups) {
      maxScore[n] = Math.max(...allRunsLeague.filter(run => run.normalizationGroup == n).map(run => run.score))
    }
    allRunsLeague.map(run => {
      if (maxScore[run.normalizationGroup] == 0) run.normalizedScore = 0;
      else run.normalizedScore = run.score / maxScore[run.normalizationGroup];
    })
  }

  let teamRuns = {};
  for (let run of allRunsLeague) {
    if (teamRuns[run.team._id] == null) teamRuns[run.team._id] = { games: [] };
    teamRuns[run.team._id].games.push(run);
  }

  Object.keys(teamRuns).map(e => {
    teamRuns[e].gameSum = {};
    let bestRuns;
    if (competitiondb.NORMALIZED_RANKING_MODE.includes(rankingMode)) {
      teamRuns[e].games.sort(sortRunsNormalized)
      bestRuns = teamRuns[e].games.slice(0, sumGameNumber);
      teamRuns[e].gameSum.normalizedScore = sum(bestRuns.map(run => run.normalizedScore));
      teamRuns[e].gameSum.normalizedScoreMean = teamRuns[e].gameSum.normalizedScore / bestRuns.length;
    } else {
      teamRuns[e].games.sort(sortRuns)
      bestRuns = teamRuns[e].games.slice(0, sumGameNumber);
      teamRuns[e].gameSum.score = sum(bestRuns.map(run => run.score));
    }

    // Mark used or not
    teamRuns[e].games.map((run, index) => {
      if (index < sumGameNumber) run.used = true;
      else run.used = false;
    })

    // Sum of the time
    teamRuns[e].gameSum.time = {};
    teamRuns[e].gameSum.time.minutes = sum(bestRuns.map(run => run.time.minutes));
    teamRuns[e].gameSum.time.seconds = sum(bestRuns.map(run => run.time.seconds));
    teamRuns[e].gameSum.time.minutes += Math.floor(teamRuns[e].gameSum.time.seconds / 60);
    teamRuns[e].gameSum.time.seconds %= 60;

    // Sum of the victims
    if (teamRuns[e].games[0].isNL) { //NL
      teamRuns[e].gameSum.victims = {
        live: sum(bestRuns.map(run => run.nl.liveVictim.filter(l => l.found && l.identified).length)),
        dead: sum(bestRuns.map(run => run.nl.deadVictim.filter(l => l.found && l.identified).length)),
        unknown: sum(bestRuns.map(run => run.nl.liveVictim.filter(l => l.found && !l.identified).length + run.nl.deadVictim.filter(l => l.found && !l.identified).length))
      };
    } else { // WL
      teamRuns[e].gameSum.victims = bestRuns.flatMap(run => run.rescueOrder).reduce(function (result, current) {
        var element = result.find(p => p.victimType == current.victimType && p.zoneType == current.zoneType);
        if (element) {
          element.count ++;
        } else {
          result.push({
            victimType: current.victimType,
            zoneType: current.zoneType,
            count: 1
          });
        }
        return result;
      }, []);
    }

    // Sum of the LoPs
    teamRuns[e].gameSum.lops = sum(bestRuns.map(run => sum(run.LoPs)));

    // Set default score
    teamRuns[e].technicalChallenge = 0;
  })

  let result = {
    mode: rankingMode,
    modeDetails: {
      nonNormalized: competitiondb.NON_NORMALIZED_RANKING_MODE.includes(rankingMode),
      normalized: competitiondb.NORMALIZED_RANKING_MODE.includes(rankingMode),
      document: competitiondb.DOCUMENT_RANKING_MODE.includes(rankingMode),
      technicalChallenge: competitiondb.TECHNICAL_CHALLENGE_RANKING_MODE.includes(rankingMode)
    }
  };

  if (result.modeDetails.document) {
    let documentResult = await getDocumentScore(competition, league);
    let documentScore = documentResult.result;
    result.documentBlockTitles = documentResult.blockTitles;
    for (let d of documentScore) {
      if (teamRuns[d._id]) {
        teamRuns[d._id].document = {
          details: d.details,
          score: d.score
        };
      }
      
    }
  }

  if (result.modeDetails.technicalChallenge) {
    let tcResult = await getTechnicalChallengeScore(competition, league);
    for (let tc of tcResult) {
      if (teamRuns[tc.teamId]) {
        teamRuns[tc.teamId].technicalChallenge = tc.score;
      }
    }
  }

  let ranking = Object.values(teamRuns);
  ranking.map(r => {
    r.team = r.games[0].team;
    r.games.map(g => delete g.team);
    // Convert to object
    if (competitiondb.NORMALIZED_RANKING_MODE.includes(rankingMode)) {
      r.games = r.games.reduce((accumulator, value, index) => {
        return {...accumulator, [value.normalizationGroup]: value};
      }, {});
    } else {
      r.games = r.games.reduce((accumulator, value, index) => {
        return {...accumulator, [value.round.name]: value};
      }, {});
    }
  });

  switch(rankingMode) {
    case competitiondb.SUM_OF_BEST_N_GAMES:
      ranking.map(r => r.finalScore = r.gameSum.score);
      break;
    case competitiondb.MEAN_OF_NORMALIZED_BEST_N_GAMES:
      ranking.map(r => r.finalScore = r.gameSum.normalizedScoreMean);
      break;
    case competitiondb.MEAN_OF_NORMALIZED_BEST_N_GAMES_NORMALIZED_DOCUMENT:
      ranking.map(r => r.finalScore = 0.8* r.gameSum.normalizedScoreMean + 0.2 * r.document.score);
      break;
    case competitiondb.GAMES_DOCUMENT_CHALLENGE:
      ranking.map(r => r.finalScore = 0.6* r.gameSum.normalizedScoreMean + 0.2 * r.document.score + 0.2 * r.technicalChallenge);
      break;
  }

  ranking.sort(sortFinalScore);
  result.ranking = ranking;

  if (competitiondb.NORMALIZED_RANKING_MODE.includes(rankingMode)) {
    result.runGroups = allNormGroups;
  } else {
    result.runGroups = allRounds;
  }

  res.status(200).send(result);
});

// For maze
publicRouter.get('/:competitionId/:leagueId', async function (req, res, next) {
  const competition = req.params.competitionId;
  const league = req.params.leagueId;

  if (!ObjectId.isValid(competition)) {
    return next();
  }
  if (!competitiondb.MAZE_LEAGUES.includes(league)) {
    return next();
  }

  let competitionDb = await competitiondb.competition.findById(competition).lean().exec();
  let rankingSettings = competitionDb.leagues.find(r => r.league == league);
  if (!rankingSettings.disclose && !auth.authCompetition(
    req.user,
    competition,
    ACCESSLEVELS.VIEW
  )) {
    return res.status(401).send();
  }
  let sumGameNumber = rankingSettings.num;
  let rankingMode = rankingSettings.mode;

  let allRunsDb = await mazeRun.find({
    competition: competition
  }).select("team score normalizationGroup LoPs misidentification foundVictims distKits exitBonus time startTime round")
  .populate([
    {
      path: 'team',
      select: 'name teamCode league'
    },
    {
      path: 'round',
      select: 'name'
    }
  ]).lean().exec();

  let allRunsLeague = allRunsDb.filter(r => r.team.league == league);
  let allRounds =[...new Set(allRunsLeague.map(r => r.round.name))].sort();
  let allNormGroups =[...new Set(allRunsLeague.map(r => r.normalizationGroup))].sort();

  if (competitiondb.NORMALIZED_RANKING_MODE.includes(rankingMode)) {
    let normGroups = allRunsLeague.map(r => r.normalizationGroup);
    normGroups = [...new Set(normGroups)];
    let maxScore = {};
    for (let n of normGroups) {
      maxScore[n] = Math.max(...allRunsLeague.filter(run => run.normalizationGroup == n).map(run => run.score))
    }
    allRunsLeague.map(run => {
      if (maxScore[run.normalizationGroup] == 0) run.normalizedScore = 0;
      else run.normalizedScore = run.score / maxScore[run.normalizationGroup];
    })
  }

  let teamRuns = {};
  for (let run of allRunsLeague) {
    if (teamRuns[run.team._id] == null) teamRuns[run.team._id] = { games: [] };
    teamRuns[run.team._id].games.push(run);
  }

  Object.keys(teamRuns).map(e => {
    teamRuns[e].gameSum = {};
    let bestRuns;
    if (competitiondb.NORMALIZED_RANKING_MODE.includes(rankingMode)) {
      teamRuns[e].games.sort(sortRunsNormalized)
      bestRuns = teamRuns[e].games.slice(0, sumGameNumber);
      teamRuns[e].gameSum.normalizedScore = sum(bestRuns.map(run => run.normalizedScore));
      teamRuns[e].gameSum.normalizedScoreMean = teamRuns[e].gameSum.normalizedScore / bestRuns.length;
    } else {
      teamRuns[e].games.sort(sortRuns)
      bestRuns = teamRuns[e].games.slice(0, sumGameNumber);
      teamRuns[e].gameSum.score = sum(bestRuns.map(run => run.score));
    }

    // Mark used or not
    teamRuns[e].games.map((run, index) => {
      if (index < sumGameNumber) run.used = true;
      else run.used = false;
    })

    // Sum of the time
    teamRuns[e].gameSum.time = {};
    teamRuns[e].gameSum.time.minutes = sum(bestRuns.map(run => run.time.minutes));
    teamRuns[e].gameSum.time.seconds = sum(bestRuns.map(run => run.time.seconds));
    teamRuns[e].gameSum.time.minutes += Math.floor(teamRuns[e].gameSum.time.seconds / 60);
    teamRuns[e].gameSum.time.seconds %= 60;

    // Sum of the victims
    teamRuns[e].gameSum.victims = bestRuns.flatMap(run => run.foundVictims).reduce(function (result, current) {
      var element = result.find(p => p.type == current.type);
      if (element) {
        element.count ++;
      } else {
        result.push({
          type: current.type,
          count: current.count
        });
      }
      return result;
    }, []).sort((a,b) => VICTIMS.indexOf(a.type) - VICTIMS.indexOf(b.type));


    // Sum of the LoPs
    teamRuns[e].gameSum.lops = sum(bestRuns.map(run => run.LoPs));

    // Sum of the misidentification
    teamRuns[e].gameSum.misidentification = sum(bestRuns.map(run => run.misidentification));

    // Sum of the distKits
    teamRuns[e].gameSum.distKits = sum(bestRuns.map(run => run.distKits));

    // Sum of the exitBonus
    teamRuns[e].gameSum.exitBonus = sum(bestRuns.map(run => run.exitBonus ? 1:0));

    // Set default score
    teamRuns[e].technicalChallenge = 0;
  })

  let result = {
    mode: rankingMode,
    modeDetails: {
      nonNormalized: competitiondb.NON_NORMALIZED_RANKING_MODE.includes(rankingMode),
      normalized: competitiondb.NORMALIZED_RANKING_MODE.includes(rankingMode),
      document: competitiondb.DOCUMENT_RANKING_MODE.includes(rankingMode),
      technicalChallenge: competitiondb.TECHNICAL_CHALLENGE_RANKING_MODE.includes(rankingMode)
    }
  };

  if (result.modeDetails.document) {
    let documentResult = await getDocumentScore(competition, league);
    let documentScore = documentResult.result;
    result.documentBlockTitles = documentResult.blockTitles;
    for (let d of documentScore) {
      if (teamRuns[d._id]) {
        teamRuns[d._id].document = {
          details: d.details,
          score: d.score
        };
      }
    }
  }

  if (result.modeDetails.technicalChallenge) {
    let tcResult = await getTechnicalChallengeScore(competition, league);
    for (let tc of tcResult) {
      if (teamRuns[tc.teamId]) {
        teamRuns[tc.teamId].technicalChallenge = tc.score;
      }
    }
  }

  let ranking = Object.values(teamRuns);
  ranking.map(r => {
    r.team = r.games[0].team;
    r.games.map(g => delete g.team);
    // Convert to object
    if (competitiondb.NORMALIZED_RANKING_MODE.includes(rankingMode)) {
      r.games = r.games.reduce((accumulator, value, index) => {
        return {...accumulator, [value.normalizationGroup]: value};
      }, {});
    } else {
      r.games = r.games.reduce((accumulator, value, index) => {
        return {...accumulator, [value.round.name]: value};
      }, {});
    }
  });

  switch(rankingMode) {
    case competitiondb.SUM_OF_BEST_N_GAMES:
      ranking.map(r => r.finalScore = r.gameSum.score);
      break;
    case competitiondb.MEAN_OF_NORMALIZED_BEST_N_GAMES:
      ranking.map(r => r.finalScore = r.gameSum.normalizedScoreMean);
      break;
    case competitiondb.MEAN_OF_NORMALIZED_BEST_N_GAMES_NORMALIZED_DOCUMENT:
      ranking.map(r => r.finalScore = 0.8* r.gameSum.normalizedScoreMean + 0.2 * r.document.score);
      break;
    case competitiondb.GAMES_DOCUMENT_CHALLENGE:
      ranking.map(r => r.finalScore = 0.6* r.gameSum.normalizedScoreMean + 0.2 * r.document.score + 0.2 * r.technicalChallenge);
      break;
  }

  ranking.sort(sortFinalScore);
  result.ranking = ranking;

  if (competitiondb.NORMALIZED_RANKING_MODE.includes(rankingMode)) {
    result.runGroups = allNormGroups;
  } else {
    result.runGroups = allRounds;
  }

  res.status(200).send(result);
});

// For simulation
publicRouter.get('/:competitionId/:leagueId', async function (req, res, next) {
  const competition = req.params.competitionId;
  const league = req.params.leagueId;

  if (!ObjectId.isValid(competition)) {
    return next();
  }
  if (!competitiondb.SIM_LEAGUES.includes(league)) {
    return next();
  }

  let competitionDb = await competitiondb.competition.findById(competition).lean().exec();
  let rankingSettings = competitionDb.leagues.find(r => r.league == league);
  if (!rankingSettings.disclose && !auth.authCompetition(
    req.user,
    competition,
    ACCESSLEVELS.VIEW
  )) {
    return res.status(401).send();
  }
  let sumGameNumber = rankingSettings.num;
  let rankingMode = rankingSettings.mode;

  let allRunsDb = await simRun.find({
    competition: competition
  }).select("team score normalizationGroup time startTime round")
  .populate([
    {
      path: 'team',
      select: 'name teamCode league'
    },
    {
      path: 'round',
      select: 'name'
    }
  ]).lean().exec();

  let allRunsLeague = allRunsDb.filter(r => r.team.league == league);
  let allRounds =[...new Set(allRunsLeague.map(r => r.round.name))].sort();
  let allNormGroups =[...new Set(allRunsLeague.map(r => r.normalizationGroup))].sort();

  if (competitiondb.NORMALIZED_RANKING_MODE.includes(rankingMode)) {
    let normGroups = allRunsLeague.map(r => r.normalizationGroup);
    normGroups = [...new Set(normGroups)];
    let maxScore = {};
    for (let n of normGroups) {
      maxScore[n] = Math.max(...allRunsLeague.filter(run => run.normalizationGroup == n).map(run => run.score))
    }
    allRunsLeague.map(run => {
      if (maxScore[run.normalizationGroup] == 0) run.normalizedScore = 0;
      else run.normalizedScore = run.score / maxScore[run.normalizationGroup];
    })
  }

  let teamRuns = {};
  for (let run of allRunsLeague) {
    if (teamRuns[run.team._id] == null) teamRuns[run.team._id] = { games: [] };
    teamRuns[run.team._id].games.push(run);
  }

  Object.keys(teamRuns).map(e => {
    teamRuns[e].gameSum = {};
    let bestRuns;
    if (competitiondb.NORMALIZED_RANKING_MODE.includes(rankingMode)) {
      teamRuns[e].games.sort(sortRunsNormalized)
      bestRuns = teamRuns[e].games.slice(0, sumGameNumber);
      teamRuns[e].gameSum.normalizedScore = sum(bestRuns.map(run => run.normalizedScore));
      teamRuns[e].gameSum.normalizedScoreMean = teamRuns[e].gameSum.normalizedScore / bestRuns.length;
    } else {
      teamRuns[e].games.sort(sortRuns)
      bestRuns = teamRuns[e].games.slice(0, sumGameNumber);
      teamRuns[e].gameSum.score = sum(bestRuns.map(run => run.score));
    }

    // Mark used or not
    teamRuns[e].games.map((run, index) => {
      if (index < sumGameNumber) run.used = true;
      else run.used = false;
    })

    // Sum of the time
    teamRuns[e].gameSum.time = {};
    teamRuns[e].gameSum.time.minutes = sum(bestRuns.map(run => run.time.minutes));
    teamRuns[e].gameSum.time.seconds = sum(bestRuns.map(run => run.time.seconds));
    teamRuns[e].gameSum.time.minutes += Math.floor(teamRuns[e].gameSum.time.seconds / 60);
    teamRuns[e].gameSum.time.seconds %= 60;

    // Set default score
    teamRuns[e].technicalChallenge = 0;
  })

  let result = {
    mode: rankingMode,
    modeDetails: {
      nonNormalized: competitiondb.NON_NORMALIZED_RANKING_MODE.includes(rankingMode),
      normalized: competitiondb.NORMALIZED_RANKING_MODE.includes(rankingMode),
      document: competitiondb.DOCUMENT_RANKING_MODE.includes(rankingMode),
      technicalChallenge: competitiondb.TECHNICAL_CHALLENGE_RANKING_MODE.includes(rankingMode)
    }
  };

  if (result.modeDetails.document) {
    let documentResult = await getDocumentScore(competition, league);
    let documentScore = documentResult.result;
    result.documentBlockTitles = documentResult.blockTitles;
    for (let d of documentScore) {
      if (teamRuns[d._id]) {
        teamRuns[d._id].document = {
          details: d.details,
          score: d.score
        };
      }
    }
  }

  if (result.modeDetails.technicalChallenge) {
    let tcResult = await getTechnicalChallengeScore(competition, league);
    for (let tc of tcResult) {
      if (teamRuns[tc.teamId]) {
        teamRuns[tc.teamId].technicalChallenge = tc.score;
      }
    }
  }

  let ranking = Object.values(teamRuns);
  ranking.map(r => {
    r.team = r.games[0].team;
    r.games.map(g => delete g.team);
    // Convert to object
    if (competitiondb.NORMALIZED_RANKING_MODE.includes(rankingMode)) {
      r.games = r.games.reduce((accumulator, value, index) => {
        return {...accumulator, [value.normalizationGroup]: value};
      }, {});
    } else {
      r.games = r.games.reduce((accumulator, value, index) => {
        return {...accumulator, [value.round.name]: value};
      }, {});
    }
  });

  switch(rankingMode) {
    case competitiondb.SUM_OF_BEST_N_GAMES:
      ranking.map(r => r.finalScore = r.gameSum.score);
      break;
    case competitiondb.MEAN_OF_NORMALIZED_BEST_N_GAMES:
      ranking.map(r => r.finalScore = r.gameSum.normalizedScoreMean);
      break;
    case competitiondb.MEAN_OF_NORMALIZED_BEST_N_GAMES_NORMALIZED_DOCUMENT:
      ranking.map(r => r.finalScore = 0.8* r.gameSum.normalizedScoreMean + 0.2 * r.document.score);
      break;
    case competitiondb.GAMES_DOCUMENT_CHALLENGE:
      ranking.map(r => r.finalScore = 0.6* r.gameSum.normalizedScoreMean + 0.2 * r.document.score + 0.2 * r.technicalChallenge);
      break;
  }

  ranking.sort(sortFinalScore);
  result.ranking = ranking;

  if (competitiondb.NORMALIZED_RANKING_MODE.includes(rankingMode)) {
    result.runGroups = allNormGroups;
  } else {
    result.runGroups = allRounds;
  }

  res.status(200).send(result);
});

function sortRuns(a, b) {
  if (a.score == b.score) {
      if (a.time.minutes < b.time.minutes) {
          return -1
      } else if (a.time.minutes > b.time.minutes) {
          return 1
      } else if (a.time.seconds < b.time.seconds) {
          return -1
      } else if (a.time.seconds > b.time.seconds) {
          return 1
      } else {
          return 0
      }
  } else {
      return b.score - a.score
  }
}

function sortRunsNormalized(a, b) {
  if (a.normalizedScore == b.normalizedScore) {
      if (a.time.minutes < b.time.minutes) {
          return -1
      } else if (a.time.minutes > b.time.minutes) {
          return 1
      } else if (a.time.seconds < b.time.seconds) {
          return -1
      } else if (a.time.seconds > b.time.seconds) {
          return 1
      } else {
          return 0
      }
  } else {
      return b.normalizedScore - a.normalizedScore
  }
}

function sortFinalScore(a, b) {
  if (a.finalScore == b.finalScore) {
      if (a.gameSum.time.minutes < b.gameSum.time.minutes) {
          return -1
      } else if (a.gameSum.time.minutes > b.gameSum.time.minutes) {
          return 1
      } else if (a.gameSum.time.seconds < b.gameSum.time.seconds) {
          return -1
      } else if (a.gameSum.time.seconds > b.gameSum.time.seconds) {
          return 1
      } else {
          return 0
      }
  } else {
      return b.finalScore - a.finalScore
  }
}

function sum(array) {
  if (array.length == 0) return 0;
  return array.reduce(function(a,b){
    return a + b;
  });
}

adminRouter.get('/:competitionId/:leagueId/document', async function (req, res, next) {
  const competition = req.params.competitionId;
  const league = req.params.leagueId;

  if (!ObjectId.isValid(competition)) {
    return next();
  }
  if (!competitiondb.LEAGUES.includes(league)) {
    return next();
  }

  if (!auth.authCompetition(req.user, competition, ACCESSLEVELS.ADMIN)) {
    return res.status(403).send("User access permission error");
  }

  let result = await getDocumentScore(competition, league);
  res.status(200).send(result.result);
});

async function getDocumentScore(competitionId, leagueId) {
  // Retrieve review questions
  let competitionDb = await competitiondb.competition.findById(competitionId).lean().exec();
  if (competitionDb == null) return res.status(404).send("Could not find competition");
  let leagueInfo = competitionDb.documents.leagues.find(d => d.league == leagueId)
  let reviewQuestions = [];
  if (leagueInfo) {
    reviewQuestions = leagueInfo.review;
  }

  // Retrieve all temas of the league
  let teamsDb = await competitiondb.team.find({
    competition: competitionId,
    league: leagueId
  }).select("name teamCode country document.penalty").lean().exec();
  let teamIds = teamsDb.map(t => t._id);

  // Retrieve all review results
  let reviewResults = await review.find({
    competition: competitionId,
    team: { $in: teamIds }
  }).lean().exec();

  // Retrieve all users who has INTERVIEW role for this competition
  let users = await user.find().lean().exec();
  let authorizedUsers = users.filter((u) => u.competitions.some((c) => c.id == competitionId && c.role.includes("INTERVIEW"))).map((u) => u._id);

  // Questions list
  let questions = {};
  let weights = {};
  let blockTitles = [];
  let questionReviewerAssignments = {};
  for (let block of reviewQuestions) {
    if (block.weight == 0) continue;
    weights[block._id] = block.weight;
    blockTitles.push({
      _id: block._id,
      i18n: block.i18n
    });
    for (let question of block.questions) {
      if (question.type == "scale") {
        if (questions[block._id] == null) questions[block._id] = [];
        questions[block._id].push(question._id);
        questionReviewerAssignments[question._id] = block.assignedReviewers;
      }
    }
  }


  let result = [];
  let blockScores = {};
  // Calculate team's document score
  for (let team of teamsDb) {
    let penalty = (100 - team.document.penalty) / 100;
    let reviewTeam = reviewResults.filter(r => r.team.equals(team._id));
    let comments = {};
    for (let review of reviewTeam) {
      for (const [key, value] of Object.entries(review.comments)) {
        if (comments[key] == null) comments[key] = [];
        if (value == '') continue;

        let assignments = questionReviewerAssignments[key];
        if (assignments == undefined) continue;
        if(authorizedUsers.some((au) => au.equals(review.reviewer))) {
          if (assignments.length == 0 || assignments.some((a) => a.reviewerId.equals(review.reviewer) && (a.teamIds.some((t) => t.equals(team._id)) || a.teamIds.length == 0))) {
            comments[key].push(value);
          }
        }
      }
    }
    
    team.details = [];
    for (let blockId in questions) {
      let blockScore = 0;
      let blockReviewerNum = [];
      let expectedReviewerNum = [];
      for (let questionId of questions[blockId]) {
        let expectedReviewerCount = 0;
        if (questionReviewerAssignments[questionId].length == 0) {
          expectedReviewerCount += authorizedUsers.length;
        } else {
          for (let r of questionReviewerAssignments[questionId]) {
            if (r.teamIds.length == 0) {
              expectedReviewerCount++;
              continue;
            }
            if (r.teamIds.some((t) => t.equals(team._id))) {
              expectedReviewerCount++;
              continue;
            }
          }
        }
        expectedReviewerNum.push(expectedReviewerCount);

        if (comments[questionId] == null) {
          blockReviewerNum.push(0);
          continue;
        }

        let ratings = comments[questionId].map(str => parseInt(str));
        let numReviewer = ratings.length;
        blockReviewerNum.push(numReviewer);

        let score = 0;
        if (numReviewer >= MINIMUM_REVIEWER) {
          let min = Math.min(...ratings);
          let max = Math.max(...ratings);
          score = (sum(ratings) - min - max) / (numReviewer - 2);
        } else if (numReviewer > 0) {
          score = sum(ratings) / numReviewer;
        }
        blockScore += score * penalty;
      }
      
      team.details.push({
        blockId,
        score: blockScore,
        warning: (blockReviewerNum.toString() != expectedReviewerNum.toString()) ||  Math.max(...expectedReviewerNum) == 0,
        reviewerNum: Math.min(...blockReviewerNum),
        expectedReviewerNum: Math.max(...expectedReviewerNum)
      })
      if (blockScores[blockId] == null) blockScores[blockId] = [];
      blockScores[blockId].push(blockScore);
    }
    result.push(team);
  }

  // Calculate normalized score
  for (let team of result) {
    let score = 0;
    for (let block of team.details) {
      let maxScore = Math.max(...blockScores[block.blockId]);
      if (maxScore == 0) block.normalizedScore = 0;
      else block.normalizedScore = block.score / maxScore;
      score += block.normalizedScore * weights[block.blockId];
      block.weight = weights[block.blockId];
    }
    team.score = score;
  }

  return {
    result,
    blockTitles
  }
}

async function getTechnicalChallengeScore(competitionId, leagueId) {
  let data = (await competitiondb.technicalChallenge
    .find({
      competition: competitionId
    })
    .populate({
      path:'team',
      match: {'league': {$eq: leagueId}}
     })
    .exec()).filter(d => d.team != null);
  let maxScore = Math.max(...data.map(d => d.score));

  if (maxScore == 0) {
    return data.map((d) => ({
      teamId: d.team._id,
      rawScore: d.score,
      score: 1
    }));
  } else {
    return data.map((d) => ({
      teamId: d.team._id,
      rawScore: d.score,
      score: d.score / maxScore
    }));
  }
}

publicRouter.all('*', function (req, res, next) {
  next();
});
privateRouter.all('*', function (req, res, next) {
  next();
});

module.exports.public = publicRouter;
module.exports.private = privateRouter;
module.exports.admin = adminRouter;
