interface FirebaseOptions {
    databaseURL: string,
    storageBucket: string
}

interface FunctionResponse {
    version: string,
    loaded: boolean,
    enabled: boolean,
    error: string
}

interface LeagueMap {
    mapId: number,
    mapName: string,
    notes: string,
}

interface GameMode {
    gameMode: string,
    description: string
}

interface GameType {
    gametype: string,
    description: string
}

interface Champions {
    type: string,
    format: string,
    version: string,
    data: {
        [key: string]: {
            version: string,
            id: string,
            key: string,
            name: string,
            image: Image
        }
    }
}

interface Champion {
    type: string,
    format: string,
    version: string,
    data: {
        [key: string]: ChampionData
    }
}
interface ChampionData {
    id: string,
    key: string,
    name: string,
    title: string,
    image: Image,
    lore: string,
    blurb: string,
    tags: string[],
    partype: string,
    stats: {
        hp: number,
        hpperlevel: number,
        mp: number,
        mpperlevel: number,
        movespeed: number,
        armor: number,
        armorperlevel: number,
        spellblock: number,
        spellblockperlevel: number,
        attackrange: number,
        hpregen: number,
        hpregenperlevel: number,
        mpregen: number,
        mpregenperlevel: number,
        crit: number,
        critperlevel: number,
        attackdamage: number,
        attackdamageperlevel: number,
        attackspeedperlevel: number,
        attackspeed: number
    },
    spells: Spell[],
    passive: {
        name: string,
        description: string,
        image: Image
    }
}

interface Spell {
    id: string,
    name: string,
    description: string,
    tooltip: string,
    leveltip: {
        label: string[],
        effect: string[]
    },
    maxrank: number,
    cooldown: number[],
    cooldownBurn: string,
    cost: number[],
    costBurn: string,
    datavalues: Record<string, unknown>,
    effectBurn: string[],
    vars: string[],
    costType: string,
    maxammo: string,
    range: number[],
    rangeBurn: string,
    image: Image,
    resource?: string
}

interface Items {
    type: string,
    version: string,
    basic: Record<string, unknown>,
    data: {
        [key: string]: Item
    }
}

interface Item {
    key: string,
    name: string,
    description: string,
    colloq: string,
    plaintext: string,
    from: string[],
    into: string[],
    image: Image,
    stacks: number,
    specialRecipe: number,
    inStore: boolean,
    hideFromAll: boolean,
    requiredChampion: string,
    requiredAlly: string,
    gold: {
        base: number,
        purchasable: boolean,
        total: number,
        sell: number
    },
    group: string,
    consumed: boolean,
    consumeOnFull: boolean,
    tags: string[],
    maps: {
        [key: string]: boolean
    },
    stats: {
        [key: string]: boolean
    },

}

interface Image {
    full: string,
    sprite: string,
    group: string
    x: number,
    y: number,
    w: number,
    h: number
}