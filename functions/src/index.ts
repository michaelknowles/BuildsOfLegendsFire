import * as functions from 'firebase-functions';

import * as riot from './riot';
import * as local from './db';

// Get service account info
import serviceAccountJson from '../serviceAccount.json';

const serviceAccount = {
    projectId: serviceAccountJson.project_id,
    clientEmail: serviceAccountJson.client_email,
    privateKey: serviceAccountJson.private_key
}

const main = async (requestedVersion: string): Promise<FunctionResponse> => {
    let version = '';
    let loaded = false;
    let enabled = false;
    let error = '';
    try {
        // Get versions from Riot
        const versions = await riot.getJson('https://ddragon.leagueoflegends.com/api/versions.json') as string[];

        // Make sure the requestedVersion is in Riot's list
        if (requestedVersion) {
            if (versions.includes(requestedVersion)) {
                version = requestedVersion;
            } else {
                functions.logger.error('Requested version not found',
                    {requestedVersion: requestedVersion});
                throw new Error('Requested version not found');
            }
        } else {
            version = versions[0];
        }

        // If no version has been determined, exit
        if (version === '') {
            functions.logger.error('No version being loaded', {
                requestedVersion: requestedVersion,
                latestVersion: versions[0]
            });
            throw new Error('No version being loaded')
        }

        functions.logger.log("Determined version to load",
            {version: version});

        // Initialize DB connection
        const db = new local.Db(serviceAccount, version);

        const localVersions = await db.getVersions();

        functions.logger.log("Got versions from local",
            {versions: localVersions});

        // See if the version has already been loaded
        let versionFound = false;
        localVersions.forEach(v => {
            const localVersion = v.get('version');
            const loaded = v.get('loaded');
            if (loaded && version === localVersion) {
                versionFound = true;
            }
        });

        if (versionFound) {
            loaded = true;
            enabled = true;
            functions.logger.log("Version has already been loaded",
                {version: version});
        } else {
            functions.logger.log("Version has not already been loaded",
                {version: version});

            // Version
            await db.setVersion();

            // Maps
            const maps = await riot.getJson('http://static.developer.riotgames.com/docs/lol/maps.json') as LeagueMap[];
            await db.setMaps(maps);

            // Game Modes
            const gameModes = await riot.getJson('http://static.developer.riotgames.com/docs/lol/gameModes.json') as GameMode[];
            await db.setGameModes(gameModes);

            // Game Types
            const gameTypes = await riot.getJson('http://static.developer.riotgames.com/docs/lol/gameTypes.json') as GameType[];
            await db.setGameTypes(gameTypes);

            // Champions
            const champions = await riot.getJson(`http://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`) as Champions;
            await db.setChampions(champions);

            // Items
            const items = await riot.getJson(`http://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/item.json`) as Items;
            await db.setItems(items);

            // Summoner Spells
            // http://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/summoner.json
            // http://ddragon.leagueoflegends.com/cdn/${version}/img/spell/SummonerFlash.png

            // Set version as loaded
            loaded = await db.setVersionLoaded();
            // Set version as enabled
            enabled = await db.enableVersion();
        }
    } catch (e) {
        error = e.stack;
        functions.logger.error(error);
    }

    return {
        version,
        loaded,
        enabled,
        error
    }
}

exports.scheduledFunctionCrontab = functions.pubsub.schedule('0 16 * * *')
    .timeZone('America/Los_Angeles')
    .onRun((context) => {
        return null;
    })

export const dataDragon = functions
    .runWith({timeoutSeconds: 540})
    .https.onRequest(async (request, response) => {
        functions.logger.log('Start dataDragon');

        const requestedVersion = request.body['version'];
        if (requestedVersion !== '') {
            functions.logger.log('Version was given in request', {version: requestedVersion});
        } else {
            functions.logger.log('No version given in request');
        }

        const res = await main(requestedVersion);
        response.json(res);

        functions.logger.log('End dataDragon');
    })
