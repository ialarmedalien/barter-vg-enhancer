import Greasemonkey from './greasemonkey.js';

// 1 day expiry time
const PRICE_EXPIRY_TIME = 24 * 3600 * 1000;
// 1 week expiry time for null plains values
const PLAIN_EXPIRY_TIME = 7 * 24 * 3600 * 1000;

export default class Cache {
    /**
     * Populate the games in allGames with the ITAD plain, if available
     *
     * @param {object} allGames object containing games, indexed by item_id
     * @returns {Array[string]} item_ids for games that do not have an ITAD plain
     */
    static getItadGamePlains(allGames) {
        const toRetrieve = [];
        const ts = new Date();
        for (const game of Object.values(allGames)) {
            const plainJson = Greasemonkey.getValue(`itadPlainsCache.${game.item_id}`, 'NOT_FOUND');
            if (plainJson === 'NOT_FOUND') {
                toRetrieve.push(game.item_id);
            } else {
                const cachedId = JSON.parse(plainJson);
                if (cachedId === null && ts - new Date(cachedId.ts) > PLAIN_EXPIRY_TIME) {
                    // Expire the ID and try re-fetching it
                    Greasemonkey.deleteValue(`itadPlainsCache.${game.item_id}`);
                    toRetrieve.push(game.item_id);
                } else {
                    game.itad_id = cachedId.itad_id;
                }
            }
        }
        return toRetrieve;
    }

    static saveItadGamePlain(game, ts = new Date()) {
        if ('itad_id' in game) {
            const cachedId = {
                itad_id: game.itad_id,
            };
            if (game.itad_id === null) {
                cachedId.ts = ts;
            }
            Greasemonkey.setValue('itadPlainsCache.' + game.item_id, JSON.stringify(cachedId));
        }
    }

    /**
     * Cache the ITAD plains from allGames. The ITAD plain is in the field `itad_id`
     *
     * @param {object} allGames object containing games, indexed by item_id
     */
    static saveItadGamePlains(allGames) {
        const ts = new Date();
        for (const game of Object.values(allGames)) {
            this.saveItadGamePlain(game, ts);
        }
    }

    static getGamePrice(game, store, ts = new Date()) {
        const item_id = game.item_id;
        const cachedPriceJson = Greasemonkey.getValue(`${store}PriceCache.${item_id}`, 'NOT_FOUND');
        if (cachedPriceJson !== 'NOT_FOUND') {
            const cachedPrice = JSON.parse(cachedPriceJson);
            const cacheAge = ts - new Date(cachedPrice.ts);
            if (cacheAge > PRICE_EXPIRY_TIME) {
                // Expired
                Greasemonkey.deleteValue(`${store}PriceCache.${item_id}`);
            } else {
                game[`${store}_price`] = cachedPrice[`${store}_price`];
            }
        }
    }

    /**
     * Retrieve the cached game prices for either Steam or ITAD, and populate
     * the appropriate fields in allGames
     *
     * @param {object} allGames object containing games, indexed by item_id
     * @param {string} store either 'itad' or 'steam'
     */
    static getGamePrices(allGames, store) {
        const ts = new Date();
        for (const item_id in allGames) {
            this.getGamePrice(allGames[item_id], store, ts);
        }
    }

    static saveGamePrice(game, store, ts = new Date()) {
        const priceLabel = `${store}_price`;
        if (priceLabel in game) {
            const cachedPrice = {
                ts,
                [priceLabel]: game[priceLabel],
            };
            Greasemonkey.setValue(
                `${store}PriceCache.${game.item_id}`,
                JSON.stringify(cachedPrice)
            );
        }
    }

    /**
     * Cache the prices for either Steam or ITAD from the games in allGames
     *
     * @param {object} allGames object containing games, indexed by item_id
     * @param {string} store store either 'itad' or 'steam'
     */
    static saveGamePrices(allGames, store) {
        const ts = new Date();
        for (const item_id in allGames) {
            this.saveGamePrice(allGames[item_id], store, ts);
        }
    }

    /**
     * Clear all cached data
     */
    static clearCache() {
        for (const value of Greasemonkey.listValues()) {
            Greasemonkey.deleteValue(value);
        }
    }
}
