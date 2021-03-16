// eslint-disable-next-line @typescript-eslint/no-var-requires
const fetch = require('node-fetch');
// import * as util from 'util';
// const streamPipeline = util.promisify(require('stream').pipeline);

/**
 * Get JSON from the given Riot URL
 * @param url
 */
export const getJson = async (url: string): Promise<any> => {
    const response = await fetch(url);
    if (response.ok) {
        return await response.json();
    }

    throw new Error(`${response.statusText}`);
}

/**
 * Get image from the given Riot URL
 * Throws an error if the response is not ok
 * @param url
 * @returns Buffer
 */
export const getImage = async (url: string): Promise<Buffer> => {
    // Get/return the image
    const response = await fetch(url);
    if (response.ok) {
        return await response.buffer();
    }

    throw new Error(`${response.statusText}`);
}
