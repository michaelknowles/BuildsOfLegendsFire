import * as functions from 'firebase-functions';
import * as riot from './riot';
import admin from 'firebase-admin';
import * as gstorage from '@google-cloud/storage';

export class Db {
    #db: FirebaseFirestore.Firestore;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    #storage;

    version: string;

    constructor(serviceAccount: admin.ServiceAccount, version: string) {
        this.version = version;

        const adminConfig = JSON.parse(process.env.FIREBASE_CONFIG!);
        adminConfig.credential = admin.credential.cert(serviceAccount);

        // Initialize app and db
        if (!admin.apps.length) {
            admin.initializeApp(adminConfig);
        }
        this.#db = admin.firestore();
        this.#storage = admin.storage().bucket()
    }

    /**
     * Get a list of all version
     * @returns - a Promise with version collection data
     */
    async getVersions(): Promise<FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData>> {
        functions.logger.log("Getting current db versions");

        const versionsRef = this.#db.collection('versions');
        return await versionsRef.get();
    }

    /**
     * Enable the given version
     * @returns - a Promise with whether the update was successful
     */
    async enableVersion(): Promise<boolean> {
        functions.logger.log("Enabling db version");

        const docRef = this.#db.doc(`versions/${this.version}`);
        const doc = await docRef.get();
        const oldTime = doc.updateTime;

        const res = await docRef.update({enabled: true});
        if (res.writeTime.isEqual(oldTime!)) {
            functions.logger.error("Unable to enable version; write times didn't change.");
            return false;
        }

        functions.logger.log("Enabled db version");
        return true;
    }

    /**
     * Enable the given version
     * @returns - a Promise with whether the update was successful
     */
    async setVersionLoaded(): Promise<boolean> {
        functions.logger.log("Setting db version loaded");

        const docRef = this.#db.doc(`versions/${this.version}`);
        const doc = await docRef.get();
        const oldTime = doc.updateTime;

        const res = await docRef.update({loaded: true});
        if (res.writeTime.isEqual(oldTime!)) {
            functions.logger.error("Unable to set version loaded; write times didn't change.");
            return false;
        }

        functions.logger.log("Setting db version loaded");
        return true;
    }

    /**
     * Add the given version to the db
     */
    async setVersion(): Promise<void> {
        functions.logger.log("Adding version to db");

        const docRef = this.#db.doc(`versions/${this.version}`);
        const data = {
            version: this.version,
            loaded: false,
            enabled: false,
        };
        await docRef.set(data);

        functions.logger.log("Version added");
    }

    /**
     * Add the given maps to the db
     * @param maps - the maps to add
     */
    async setMaps(maps: LeagueMap[]): Promise<void> {
        functions.logger.log("Adding maps to db");

        const batch = this.#db.batch();
        const colRef = this.#db.collection('maps');

        for (const map of maps) {
            batch.set(colRef.doc(map.mapId.toString()), {
                mapName: map.mapName,
                notes: map.notes
            });
        }

        await batch.commit();

        functions.logger.log("Maps added");
    }

    /**
     * Add the given game modes to the db
     * @param gameModes - the game modes to add
     */
    async setGameModes(gameModes: GameMode[]): Promise<void> {
        functions.logger.log("Adding game modes to db");

        const batch = this.#db.batch();
        const colRef = this.#db.collection('gameModes');

        for (const gameMode of gameModes) {
            batch.set(colRef.doc(gameMode.gameMode), {
                description: gameMode.description
            });
        }

        await batch.commit();

        functions.logger.log("Game modes added");
    }

    /**
     * Add the given game types to the db
     * @param gameTypes - the game types to add
     */
    async setGameTypes(gameTypes: GameType[]): Promise<void> {
        functions.logger.log("Adding game types to db");

        const batch = this.#db.batch();
        const colRef = this.#db.collection('gameTypes');

        for (const gameType of gameTypes) {
            batch.set(colRef.doc(gameType.gametype), {
                description: gameType.description
            });
        }

        await batch.commit();

        functions.logger.log("Game types added");
    }

    /**
     * Get and upload a file to Firebase from Riot, then delete the local copy
     * @param url - the URL to get the image from
     * @param destination - the path to upload it to in Firebase Storage
     */
    async setImage(url: string, destination: string): Promise<void> {
        let mimeType = '';
        switch (url.slice(-3)) {
            case 'jpg':
                mimeType = 'image/jpeg';
                break;
            case 'png':
                mimeType = 'image/png';
                break;
        }

        riot.getImage(url)
            .then(result => {
                const file: gstorage.File = this.#storage.file(destination);
                const options = {
                    resumable: false,
                    validation: 'md5',
                    metadata: {
                        contentType: mimeType,
                        cacheControl: 'public, max-age=86400'
                    }
                }

                file.save(result, options).catch(err => {
                    throw err;
                });
            })
            .catch(error => {
                throw error;
            });

        functions.logger.log('Saved image', {
            url: url,
            destination: destination
        });
    }

    /**
     * Add the given champions to the db
     * @param champions
     */
    async setChampions(champions: Champions): Promise<void> {
        functions.logger.log("Adding champions to db");

        // Get each champion ID to get their individual JSON
        const championNames = Object.keys(champions.data);
        const championIds = championNames.map(name => champions.data[name].id)
        // Load each champion
        for (const championId of championIds) {
            const champion = await riot.getJson(`http://ddragon.leagueoflegends.com/cdn/${this.version}/data/en_US/champion/${championId}.json`) as Champion;
            // Use champion key to store as document title in DB
            const championData = champion.data[championId];
            await this.setChampion(championData);
        }

        // Collect essential info for each champ into the version doc
        const championKeysNames = championNames.map(name => {
            return {
                key: champions.data[name].key,
                name: champions.data[name].name,
                image: champions.data[name].image.full
            }
        });
        const docRef = this.#db.collection('versions').doc(this.version);
        await docRef.update({champions: championKeysNames});

        functions.logger.log("Finished adding champions to db");
    }

    /**
     * Add the given champion to the db
     * @param champion - the champion to add
     */
    async setChampion(champion: ChampionData): Promise<void> {
        functions.logger.log("Adding champion to db", {champion: champion.key});

        // Use champion key as document name to prevent issues in case champions are renamed (like Nunu)
        const docRef = this.#db.collection('versions')
            .doc(this.version)
            .collection('champions')
            .doc(champion.key);

        const {
            id,
            key,
            name,
            title,
            image,
            partype,
            stats,
            spells,
            passive
        } = champion;

        await docRef.set({
            id,
            key,
            name,
            title,
            image,
            partype,
            stats,
            spells: JSON.stringify(spells),
            passive,
        });

        // Images
        // Champion square
        await this.setImage(`http://ddragon.leagueoflegends.com/cdn/${this.version}/img/champion/${id}.png`,
            `champions/${id}.png`);
        // Passive
        await this.setImage(`http://ddragon.leagueoflegends.com/cdn/${this.version}/img/passive/${passive.image.full}`,
            `passives/${passive.image.full}`);

        functions.logger.log("Champion added", {champion: champion.key});
    }

    /**
     * Add the given items to the db
     * @param items - the items to add
     */
    async setItems(items: Items): Promise<void> {
        functions.logger.log("Adding items to db");

        const batch = this.#db.batch();
        const colRef = this.#db.collection('versions').doc(this.version).collection('items');

        // Collect essential info for each item into the version doc
        // Also add each item as a new document under the items collection
        const itemKeysNames = [];
        for (const item of Object.keys(items.data)) {
            const itemData = items.data[item];
            itemData.key = item;

            // Add to version doc if on summoner's rift
            if (itemData.maps["11"]) {
                itemKeysNames.push({
                    key: item,
                    name: itemData.name,
                    image: itemData.image.full
                });
            }

            // Add to items collection
            batch.set(colRef.doc(item), itemData);
            // Image
            await this.setImage(`http://ddragon.leagueoflegends.com/cdn/${this.version}/img/item/${item}.png`,
                `items/${item}.png`);
        }

        await batch.commit();

        const docRef = this.#db.collection('versions').doc(this.version);
        await docRef.update({items: itemKeysNames});

        functions.logger.log("Items added");
    }
}
