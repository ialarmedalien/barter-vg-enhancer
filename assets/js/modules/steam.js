import $ from 'jquery';

import Greasemonkey from './greasemonkey';
import Http from './http';

export default class Steam {
    static getPricesFor(steamAppIds, callback) {
        const gamePrices = {};
        $.each(steamAppIds, (index, steamAppId) => {
            // Check if the game's price has been retrieved lately
            const cachedPriceJson = Greasemonkey.getValue('priceCache.' + steamAppId, null);
            if (cachedPriceJson === null) {
                return;
            }

            const cachedPrice = JSON.parse(cachedPriceJson);
            const cacheAge = new Date() - new Date(cachedPrice.freshTime);
            if (cacheAge > 3600 * 1000) {
                // Expired
                Greasemonkey.deleteValue('priceCache.' + steamAppId);
            } else {
                gamePrices[steamAppId] = {
                    prices: cachedPrice.prices,
                };
            }
        });
        $.each(gamePrices, (steamAppId) => {
            const index = steamAppIds.indexOf(steamAppId);
            if (index === -1) {
                return;
            }
            steamAppIds.splice(index, 1);
        });
        if (steamAppIds.length === 0 || (steamAppIds.length === 1 && steamAppIds[0] === null)) {
            // All prices cached, no API call necessary
            callback(true, gamePrices);
            return;
        }

        let url = 'http://store.steampowered.com/api/appdetails/';
        const urlParameters = {
            filters: 'price_overview',
            appids: steamAppIds.join(','),
        };
        const urlQuery = $.param(urlParameters);
        if (urlQuery) {
            url += '?' + urlQuery;
        }

        const cb = function (success, response) {
            console.debug('Steam Result', response);
            if (success) {
                $.each(response.data, (key, datum) => {
                    if (!datum.success) {
                        console.debug('Getting prices for ' + key + ' failed!');
                        return;
                    }
                    // jscs:disable requireCamelCaseOrUpperCaseIdentifiers
                    gamePrices[key] = {
                        prices: datum.data.price_overview,
                    };

                    const cachedPrice = {
                        freshTime: new Date(),
                        prices: datum.data.price_overview,
                    };
                    // jscs:enable requireCamelCaseOrUpperCaseIdentifiers
                    Greasemonkey.setValue('priceCache.' + key, JSON.stringify(cachedPrice));
                });
                callback(true, gamePrices);
            } else {
                callback(false, null);
            }
        };
        console.debug('Steam URL', url);
        Http.get(url, cb);
    }
}
