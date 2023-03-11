import Http from './http.js';
import Cache from './cache.js';
import { objectToString } from './util.js';
const STEAM_URL = 'http://store.steampowered.com/api/appdetails/';

export default class SteamClient {
    static async getPrices(allGames) {
        Cache.getGamePrices(allGames, 'steam');
        // create mapping of steam ids and item_ids
        const bySku = {};
        const pricesToGet = Object.values(allGames).filter((game) => {
            if ('sku' in game && game.platform_id === 1 && !('steam_price' in game)) {
                bySku[game.sku] = game;
                return true;
            }
            return false;
        });
        if (!pricesToGet.length) {
            return new Promise((resolve) => {
                resolve(null);
            });
        }

        // retrieve the prices from Steam
        const appIdString = Object.keys(bySku)
            .map((k) => encodeURIComponent(k))
            .join(',');
        const response = await Http.getPromise(
            `${STEAM_URL}?filters=price_overview&appids=${appIdString}`
        );
        if (response.status === 200) {
            // eslint-disable-next-line no-console
            console.log('Steam prices');
            // eslint-disable-next-line no-console
            console.log(response.data);
            for (const sku in response.data) {
                // only record successful price fetches
                if (response.data[sku].success === true) {
                    // 1085660: { success: true, data: [] },
                    // [] is used if the game is not available
                    if (objectToString(response.data[sku].data) === 'Array') {
                        bySku[sku].steam_price = null;
                    } else {
                        // game with a free trial period
                        // price_overview: {
                        //     currency: 'USD',
                        //     initial: 1999,
                        //     final: 1999,
                        //     discount_percent: 0,
                        //     initial_formatted: '',
                        //     final_formatted: 'Free',
                        // },
                        // discounted game
                        // price_overview: {
                        //     currency: 'USD',
                        //     initial: 5999,
                        //     final: 4019,
                        //     discount_percent: 33,
                        //     initial_formatted: '$59.99',
                        //     final_formatted: '$40.19',
                        // },
                        const priceOverview = response.data[sku].data.price_overview;
                        bySku[sku].steam_price = {
                            price: priceOverview.final / 100,
                            price_old: priceOverview.initial / 100,
                            cut: priceOverview.discount_percent,
                            currency: priceOverview.currency,
                        };
                    }
                }
            }
            Cache.saveGamePrices(allGames, 'steam');
        }
        return new Promise((resolve) => {
            resolve(response);
        });
    }
}
