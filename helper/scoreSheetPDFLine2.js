const rules = {};
const scoreSheetPath = require('path').join(
    __dirname,
    'scoreSheetPDFLineRules'
);

let supportedRules = [];
require('fs')
    .readdirSync(scoreSheetPath)
    .forEach((file) => {
        const name = file.replace(/\.js$/, '');
        rules[name] = require(`./scoreSheetPDFLineRules/${file}`);
        supportedRules.push(name);
    });

const lineSSR = require('./lineSSR');
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
                // Determine rule - use run's league rule if possible, else default to 2026
                let rule = '2026';
                if (run.competition && run.competition.leagues) {
                    const league = run.competition.leagues.find(
                        (l) => l.league == run.team.league
                    );
                    if (league) rule = league.rule;
                }

                const buffer = await lineSSR.generatePNG(run.map, rule);
                fs.writeFileSync(
                    path.join(tmpDir, `${run.map._id}.png`),
                    buffer
                );
            }
        }
    }
}

module.exports.generateScoreSheet = async function (res, runs) {
    await ensureMapImages(runs);
    if (runs.length > 0) {
        let run = runs[0];
        const league = run.competition.leagues.find(
            (l) => l.league == run.team.league
        );
        return rules[league.rule].generateScoreSheet(res, runs);
    }
    return rules[supportedRules[0]].generateScoreSheet(res, runs);
};

module.exports.generateScoreSheetsFromMaps = async function (
    res,
    maps,
    rule,
    noQR = false
) {
    const dummyRuns = maps.map((map) => {
        // Normalize tiles if they are in object format from the frontend
        let normalizedTiles = map.tiles;
        if (map.tiles && !Array.isArray(map.tiles)) {
            normalizedTiles = Object.entries(map.tiles).map(([key, tile]) => {
                const [x, y, z] = key.split(',').map(Number);
                return { ...tile, x, y, z };
            });
        }

        return {
            _id: map._id || '000000000000000000000000',
            competition: {
                name:
                    (map.competition && map.competition.name) || 'Competition',
                logo: (map.competition && map.competition.logo) || '',
                leagues: [
                    {
                        league: map.league || 'Line',
                        rule: rule,
                    },
                ],
            },
            team: {
                name: '',
                teamCode: '',
                league: map.league || 'Line',
            },
            startTime: null,
            round: { name: '' },
            field: { name: '' },
            map: {
                ...map,
                tiles: normalizedTiles,
            },
            noQR: noQR || map.noQR,
        };
    });

    return await module.exports.generateScoreSheet(res, dummyRuns);
};

module.exports.generateScoreSheetFromMap = async function (res, map, rule) {
    return await module.exports.generateScoreSheetsFromMaps(
        res,
        [map],
        rule,
        map.noQR
    );
};
