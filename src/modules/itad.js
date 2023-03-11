import Http from './http.js';
import Cache from './cache.js';

const apiKey = '27ebda8ff1e410917ae5b1f17af235783a9e335a';
const baseUrl = 'https://api.isthereanydeal.com/';

function makeProjectedPlain(string) {
    return string
        .toLowerCase()
        .replace('&amp;', ' and ')
        .replace(/&[a-z]+;/g, '')
        .replace(/([1-9])/g, ($1) => {
            const n = Number($1);
            switch (n) {
                case 1:
                    return 'i';
                case 2:
                    return 'ii';
                case 3:
                    return 'iii';
                case 4:
                    return 'iv';
                case 5:
                    return 'v';
                case 6:
                    return 'vi';
                case 7:
                    return 'vii';
                case 8:
                    return 'viii';
                case 9:
                    return 'ix';
            }
        })
        .replace(/(^| )the /g, ' ')
        .replace(/[^a-z0-9]+/g, '');
}

// const invalidMappings = {
//     1182310: 'excavationofhobsbarrow',
//     : 'norco',

//     halflifeopposingforce
//     halflifesource
//     dreamfallchapters -- 237850
//     preyii00vi
//     infra
//     iii0iii0deathwarreduxaspaceodyssey
//     talespc
//     massivegalaxy
//     darksidedetectiveseasonii => darksidedetectiveafumbleindark
//     lightmatterfirsthour => lightmatter
//     shadowsofdoubt
//     norcofarawaylights => norco
// };

export default class ItadClient {
    /**
     * Retrieve the plains for a set of indexed games and populate the games in allGames
     *
     * @param {object} allGames games indexed by item_id
     * @param {string} store number representing the store
     */
    static async getPlainsById(allGames, store) {
        const endpoint = 'v01/game/plain/id/';
        if (store === '1') {
            // steam store
            const plainsToRetrieve = Cache.getItadGamePlains(allGames);
            const bySku = {};
            const queryString = plainsToRetrieve
                .filter((item_id) => {
                    return 'sku' in allGames[item_id];
                })
                .map((item_id) => {
                    const steamId = `app/${allGames[item_id].sku}`;
                    bySku[steamId] = allGames[item_id];
                    return steamId;
                })
                .join(',');
            const response = await Http.getPromise(
                `${baseUrl}${endpoint}?key=${apiKey}&shop=steam&ids=${encodeURIComponent(
                    queryString
                )}`
            );
            if (response.status === 200) {
                for (const steamId in response.data.data) {
                    const plain = response.data.data[steamId];
                    if (plain !== null) {
                        bySku[steamId].itad_id = plain;
                        const game = bySku[steamId];
                        const projectedPlain = makeProjectedPlain(game.title);
                        if (game.itad_id !== projectedPlain) {
                            // eslint-disable-next-line no-console
                            console.log(
                                `${game.title}: plain: ${game.itad_id}, expected ${projectedPlain}`
                            );
                        }
                        Cache.saveItadGamePlain(game);
                    }
                }
            }
        }
        return new Promise((resolve) => resolve());
    }

    static async getPrices(allGames, lowest = false) {
        const priceType = lowest ? 'lowest' : 'itad';
        const endpoint = lowest ? 'v01/game/lowest/' : 'v01/game/prices/';

        await ItadClient.getPlainsById(allGames, '1');
        Cache.getGamePrices(allGames, priceType);
        const byItad = {};
        const queryString = Object.values(allGames)
            .filter((game) => {
                // no need to send off nulls
                return 'itad_id' in game;
            })
            .map((game) => {
                byItad[game.itad_id] = game;
                return game.itad_id;
            })
            .join(',');
        const response = await Http.getPromise(
            `${baseUrl}${endpoint}?key=${apiKey}&plains=${encodeURIComponent(queryString)}`
        );
        if (response.status === 200) {
            // eslint-disable-next-line no-console
            console.log(`ITAD ${lowest ? 'lowest' : 'current'} prices`);
            // eslint-disable-next-line no-console
            console.log(response.data);
            if (lowest) {
                ItadClient._processLowestPrices(response, byItad);
            } else {
                ItadClient._processCurrentPrices(response, byItad);
            }
        }
        return new Promise((resolve) => resolve());
    }

    static _processCurrentPrices(response, byItad) {
        const freshTime = new Date();
        const currency = response.data['.meta'].currency;
        for (const itadId in response.data.data) {
            // standard game response
            // "list": [
            //     {
            //       "price_new": 0.89,
            //       "price_old": 2.99,
            //       "price_cut": 70,
            //       "url": "https://akamarigames.itch.io/story-of-the-survivor",
            //       "shop": {
            //         "id": "itchio",
            //         "name": "Itch.io"
            //       },
            //       "drm": []
            //     },
            if (response.data.data[itadId].list.length) {
                const bestPrice = response.data.data[itadId].list[0];
                // n.b. there may be several stores that with the same price;
                // this just saves the first one
                byItad[itadId].itad_price = {
                    shop: bestPrice.shop,
                    price_old: bestPrice.price_old,
                    price: bestPrice.price_new,
                    cut: bestPrice.price_new === 0 ? 100 : bestPrice.price_cut,
                    currency,
                };
            } else {
                byItad[itadId].itad_price = null;
            }
            Cache.saveGamePrice(byItad[itadId], 'itad', freshTime);
        }
    }

    static _processLowestPrices(response, byItad) {
        const freshTime = new Date();
        const currency = response.data['.meta'].currency;
        for (const itadId in response.data.data) {
            // game that was free
            // "shop": {
            //     "id": "steam",
            //     "name": "Steam"
            // },
            // "price": 0,
            // "cut": 0,
            // "added": 1490636731,
            // "urls": { ... }

            // currently-discounted game
            // "shop": {
            //     "id": "nuuvem",
            //     "name": "Nuuvem"
            // },
            // "price": 4.26,
            // "cut": 80,
            // "added": 1419894191,
            // "urls": { ... }
            if ('price' in response.data.data[itadId]) {
                byItad[itadId].lowest_price = {
                    shop: response.data.data[itadId].shop,
                    price: response.data.data[itadId].price,
                    currency,
                    cut:
                        response.data.data[itadId].price === 0
                            ? 100
                            : response.data.data[itadId].cut,
                };
            } else {
                byItad[itadId].lowest_price = null;
            }
            Cache.saveGamePrice(byItad[itadId], 'lowest', freshTime);
        }
    }

    static getLowestPrices(allGames) {
        return ItadClient.getPrices(allGames, true);
    }
}
