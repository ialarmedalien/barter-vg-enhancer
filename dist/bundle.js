// ==UserScript==
// @name        barter-vg-enhancer
// @description Summarizes and compares all attributes in an offer for easy comparison of offer value
// @namespace   github.com/ialarmedalien
// @match       https://barter.vg/*
// @run-at      document-body
// @connect     barter.vg
// @connect     store.steampowered.com
// @connect     api.isthereanydeal.com
// @require     https://code.jquery.com/jquery-3.6.3.min.js
// @resource    0
// @noframes
// @version     0.6.0
// @homepage    https://github.com/ialarmedalien/barter-vg-enhancer#readme
// @author      ialarmedalien; Alexander Krivács Schrøder
// @license     GPL-3.0
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_deleteValue
// @grant       GM_listValues
// @grant       GM_xmlhttpRequest
// @grant       GM_getResourceText
// ==/UserScript==
(function () {
    'use strict';

    class Router {
        constructor() {
            this.routes = [];
        }

        registerRoutes(routes) {
            const self = this;
            routes.forEach((route) => {
                self.routes.push(route);
            });
        }

        route() {
            let chosenRoute = null;
            this.routes.forEach((route) => {
                if (chosenRoute !== null) {
                    // Route has already been chosen, skip checking the rest
                    return;
                }

                if (route.regex.test(window.location.href)) {
                    if (!route.hasPredicate) {
                        chosenRoute = route;
                        return;
                    }

                    if (route.predicate()) {
                        chosenRoute = route;
                    }
                }
            });

            if (chosenRoute !== null) {
                const controller = new chosenRoute.controller();
                chosenRoute.action.call(controller);
                return true;
            }

            return false;
        }
    }

    class Route {
        constructor(regex, controller, action, predicate) {
            this._regex = regex;
            this._controller = controller;
            this._action = action;
            this._predicate = predicate;
        }

        get regex() {
            return this._regex;
        }

        get controller() {
            return this._controller;
        }

        get action() {
            return this._action;
        }

        get predicate() {
            return this._predicate;
        }

        get hasPredicate() {
            return this._predicate !== null && this._predicate !== undefined;
        }
    }

    const APPLICATION_JSON = 'application/json';
    const JSON_PROTECTION_PREFIX = /^\)\]\}',?\n/;
    const JSON_START = /^\[|^\{(?!\{)/;
    const JSON_ENDS = {
        '[': /]$/,
        '{': /}$/,
    };

    function isJsonLike(str) {
        const jsonStart = str.match(JSON_START);
        return jsonStart && JSON_ENDS[jsonStart[0]].test(str);
    }

    function isString(value) {
        return typeof value === 'string';
    }

    function fromJson(json) {
        return isString(json) ? JSON.parse(json) : json;
    }

    function getHeaderFunction(headers) {
        const keyedHeaders = {};
        headers.forEach((value) => {
            const splitValue = value.trim().split(':', 2);
            if (splitValue.length < 2) {
                return;
            }
            keyedHeaders[splitValue[0].trim()] = splitValue[1].trim();
        });
        return function (key) {
            return keyedHeaders[key] || null;
        };
    }

    function defaultHttpResponseTransform(data, headers) {
        if (!isString(data)) {
            return data;
        }
        const tempData = data.replace(JSON_PROTECTION_PREFIX, '').trim();
        if (!tempData) {
            return data;
        }
        const contentType = headers('Content-Type');
        if ((contentType && contentType.indexOf(APPLICATION_JSON) === 0) || isJsonLike(tempData)) {
            data = fromJson(tempData);
        }
        return data;
    }

    class Http {
        static getPromise(url) {
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: url,
                    onload: function (gmResponse) {
                        const headers = getHeaderFunction(gmResponse.responseHeaders.split('\n'));
                        const responseData = defaultHttpResponseTransform(gmResponse.response, headers);
                        const response = {
                            data: responseData,
                            status: gmResponse.status,
                            headers: headers,
                            statusText: gmResponse.statusText,
                        };
                        resolve(response);
                    },
                    onerror: function (error) {
                        reject(error);
                    },
                });
            });
        }
    }

    function parseHTML(str) {
        const tmp = document.implementation.createHTMLDocument('');
        tmp.body.innerHTML = str;
        return [...tmp.body.childNodes];
    }

    function objectToString(obj) {
        const type = Object.prototype.toString.call(obj);
        return type.substring(8, type.length - 1);
    }

    class Ratios {
        static getTradeRatios(gameData) {
            if (objectToString(gameData) !== 'Object') {
                console.error('Invalid input to getTradeRatios:');
                console.error(gameData);
                return null;
            }

            if (!('tradable' in gameData)) {
                gameData.tradable = 0;
            }
            if (!('wishlist' in gameData)) {
                gameData.wishlist = 0;
            }

            if (
                objectToString(gameData.tradable) !== 'Number' ||
                objectToString(gameData.wishlist) !== 'Number' ||
                gameData.tradable < 0 ||
                gameData.wishlist < 0
            ) {
                console.error('Invalid input to getTradeRatios:');
                console.error(gameData);
                return null;
            }

            if (gameData.tradable === 0 && gameData.wishlist === 0) {
                return {
                    real: '0 : 0',
                    index: '0.0',
                    summary: '0.0',
                    relativeValue: 0,
                };
            }

            const ratioTradableToWishlist = gameData.tradable / gameData.wishlist;

            return {
                real: `${gameData.tradable} : ${gameData.wishlist}`,
                index: (gameData.wishlist / gameData.tradable).toFixed(1),
                ratio_to_one: ratioTradableToWishlist.toFixed(1),
                // Value = Real-World Price x (1 + (Demand - Supply) / (Demand + Supply))
                relativeValue:
                    'price' in gameData
                        ? (gameData.price / 100) *
                          (1 +
                              (gameData.wishlist - gameData.tradable) /
                                  (gameData.wishlist + gameData.tradable))
                        : null,
            };
        }
    }

    const GAME_STAT_TEMPLATE_OBJECT = {
        games: 0,
        totalTradable: 0,
        totalWishlist: 0,
        averageReviewScore: 'N/A',
        averageWeightedReviewScore: 'N/A',
        zeroReviewGames: 0,
        voteCount: 0,
        positiveVoteCount: 0,
        weightedScoreAccumulator: 0,
        gamesInBundles: 0,
        totalBundles: 0,
    };

    function gameStatReducer(previousValue, currentValue) {
        previousValue.totalTradable += currentValue.tradable;
        previousValue.totalWishlist += currentValue.wishlist;
        if (currentValue.user_reviews_total === 0) {
            previousValue.zeroReviewGames++;
        } else {
            previousValue.weightedScoreAccumulator +=
                currentValue.user_reviews_positive * currentValue.user_reviews_total;
            previousValue.positiveVoteCount += currentValue.user_reviews_positive;
            previousValue.voteCount += currentValue.user_reviews_total;
        }
        previousValue.gamesInBundles += currentValue.bundles_all > 0 ? 1 : 0;
        previousValue.totalBundles += currentValue.bundles_all;
        previousValue.games += 1;
        return previousValue;
    }

    /**
     *
     * @param {array} gameList array of game objects
     * @returns
     */
    function calculateGameStats(gameList) {
        const gameStats = gameList.reduce(gameStatReducer, { ...GAME_STAT_TEMPLATE_OBJECT });

        if (gameStats.voteCount > 0) {
            gameStats.averageReviewScore = Number(
                (gameStats.positiveVoteCount / (gameStats.games - gameStats.zeroReviewGames)).toFixed(0)
            );
            gameStats.averageWeightedReviewScore = Number(
                (gameStats.weightedScoreAccumulator / gameStats.voteCount).toFixed(0)
            );
        }

        gameStats.ratios = Ratios.getTradeRatios({
            tradable: gameStats.totalTradable,
            wishlist: gameStats.totalWishlist,
        });
        return gameStats;
    }

    function format(string, argsObject) {
        return string.replace(/{(\d+)}/g, (match, number) => {
            return typeof argsObject[number] !== 'undefined' ? argsObject[number] : match;
        });
    }

    class Greasemonkey {
        static getValue(name, defaultValue) {
            return GM_getValue(name, defaultValue);
        }

        static setValue(name, value) {
            return GM_setValue(name, value);
        }

        static listValues() {
            return GM_listValues();
        }

        static deleteValue(name) {
            return GM_deleteValue(name);
        }
    }

    // 1 day expiry time
    const PRICE_EXPIRY_TIME = 24 * 3600 * 1000;
    // 1 week expiry time for null plains values
    const PLAIN_EXPIRY_TIME = 7 * 24 * 3600 * 1000;

    class Cache {
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

    const STEAM_URL = 'http://store.steampowered.com/api/appdetails/';

    class SteamClient {
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

    const variables = {
        css: {
            style: `
.small, span {
    font-size: 0.8rem;
}
.bve-game-details {
    display: flex;
    flex-direction: column;
    text-align: right;
    font-size: 0.8rem;
    line-height: 1.35;
    margin: 0.25rem 0.5rem;
}
.bve-trade-summary {
    width: 100%;
}
.bve-information-highlight {
    border-bottom: dotted 1px;
    cursor: help;
    font-size: 16px;
}
.ratio, .bundled {
    font-size: 1rem;
    padding: 0.25rem;
}
.matchcol li {
    padding: 0.4rem 0;
}
.tradables {
    padding: 0;
}
.tradables li {
    display: flex;
    border-bottom: 1px dotted dodgerblue;
}
.tradables tr[data-item-id] {
    border-bottom: 1px dotted dodgerblue;
}
.tradables .r_p span, .tradables .r_m span, .tradables .r_n span {
    line-height: .25em;
    line-height: 0.8rem;
}
.tradables .r_p, .tradables .r_p a {
    font-size: 1rem;
    line-height: 1rem;
}
.tradables_info {
    max-width: unset;
    flex: 380px 1;
    display: block;
}
.bve-game-details img, .price-details img {
    max-height: 0.8rem;
    max-width: 0.8rem;
}
.matchcol {
    padding-top: 0;
}
.matchcol li {
    border-top: 1px solid #f60;
}
.matchcol.matcht li {
    border-color: #09f;
}
.game-details {
    display: inline-block;
}
.steam_price, .itad_price, .lowest_price {
    padding: 0.2rem;
    margin: 0.2rem;
}
.tradables li:last-child {
    border-bottom: 0;
}
`,
        },
        html: {
            gameDetails:
                `<div class="bve-game-details">` +
                `    <div>Tradability: <span class="bve-game-details__trade-ratio">{0}</span></div>` +
                `    <div>Bundles: <span class="bve-game-details__trade-ratio">{1}</span></div>` +
                `    <div><span class="bve-game-details__steam-price">Loading...</span></div>` +
                `    <div><span class="bve-game-details__itad-price">Loading...</span></div>` +
                `    <div><span class="bve-game-details__lowest-price">Loading...</span></div>` +
                `</div>`,
            tradeSummary:
                `<table class="bve-trade-summary">` +
                `    <caption>Trade summary:</caption>` +
                `    <tr>` +
                `        <th>Games that have been bundled</th>` +
                `        <td>{1}</td>` +
                `    </tr>` +
                `    <tr>` +
                `        <th>Total bundles</th>` +
                `        <td>{2}</td>` +
                `    </tr>` +
                `    <tr>` +
                `        <th>Average review score` +
                `            <span title="The more reviews it has, the proportionally larger that game's impact on the score" ` +
                `            class="bve-information-highlight">(weighted)</span>` +
                `        </th>` +
                `        <td>{4}% ({5}%)</td>` +
                `    </tr>` +
                `    <tr>` +
                `        <th>Number of reviews` +
                `            <span title="The binary logarithm of the number of reviews. A difference of +1 means ` +
                `            &quot;twice as popular&quot;, and -1 means &quot;half as popular&quot;."` +
                `             class="bve-information-highlight">(log<sub>2</sub>)</span>` +
                `        </th>` +
                `        <td>{6} ({7})</td>` +
                `    </tr>` +
                `    <tr>` +
                `        <th>Tradability (H : W)</th>` +
                `        <td>{8} ({9})</td>` +
                `    </tr>` +
                `    <tr>` +
                `        <th>Total price on Steam (ignoring any active discounts)</th>` +
                `        <td id="{0}_total_steam">Loading...</td>` +
                `    </tr>` +
                `    <tr class="average">` +
                `        <th>Average price per game on Steam (ignoring any active discounts)</th>` +
                `        <td id="{0}_average_steam">Loading...</td>` +
                `    </tr>` +
                `    <tr>` +
                `        <th>Best price on ITAD</th>` +
                `        <td id="{0}_total_itad">Loading...</td>` +
                `    </tr>` +
                `    <tr class="average">` +
                `        <th>Average price on ITAD</th>` +
                `        <td id="{0}_average_itad">Loading...</td>` +
                `    </tr>` +
                `</table>`,
        },
    };

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

    class ItadClient {
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

    const itadStores = {
            game2: {
                id: 'game2',
                title: '2game',
                barter_vg_id: 73,
            },
            allyouplay: {
                id: 'allyouplay',
                title: 'AllYouPlay',
                barter_vg_id: 141,
            },
            amazonus: {
                id: 'amazonus',
                title: 'Amazon',
                barter_vg_id: 12,
            },
            battlenet: {
                id: 'battlenet',

                title: 'Blizzard',
                barter_vg_id: 80,
            },
            dlgamer: {
                id: 'dlgamer',

                title: 'DLGamer',
                barter_vg_id: 42,
            },
            direct2drive: {
                id: 'direct2drive',

                title: 'Direct2Drive',
                barter_vg_id: 74,
            },
            dreamgame: {
                id: 'dreamgame',

                title: 'Dreamgame',
                barter_vg_id: 75, // ? dreamgate?
            },
            epic: {
                id: 'epic',

                title: 'Epic Game Store',
                barter_vg_id: 66,
            },
            bundlestars: {
                id: 'bundlestars',

                title: 'Fanatical',
                barter_vg_id: 8,
            },
            fireflower: {
                id: 'fireflower',

                title: 'FireFlower',
                barter_vg_id: 0,
            },
            gog: {
                id: 'gog',

                title: 'GOG',
                barter_vg_id: 4,
            },
            gamejolt: {
                id: 'gamejolt',

                title: 'Game Jolt',
                barter_vg_id: 0,
            },
            gamebillet: {
                id: 'gamebillet',

                title: 'GameBillet',
                barter_vg_id: 144,
            },
            impulse: {
                id: 'impulse',

                title: 'GameStop PC',
                barter_vg_id: 145,
            },
            gamersgate: {
                id: 'gamersgate',

                title: 'GamersGate',
                barter_vg_id: 11,
            },
            gamesplanetde: {
                id: 'gamesplanetde',

                title: 'GamesPlanet DE',
                barter_vg_id: 43,
            },
            gamesplanetfr: {
                id: 'gamesplanetfr',

                title: 'GamesPlanet FR',
                barter_vg_id: 43,
            },
            gamesplanet: {
                id: 'gamesplanet',

                title: 'GamesPlanet UK',
                barter_vg_id: 43,
            },
            gamesplanetus: {
                id: 'gamesplanetus',

                title: 'GamesPlanet US',
                barter_vg_id: 43,
            },
            gamesrepublic: {
                id: 'gamesrepublic',

                title: 'GamesRepublic',
                barter_vg_id: 72,
            },
            gamesload: {
                id: 'gamesload',

                title: 'Gamesload',
                barter_vg_id: 207,
            },
            greenmangaming: {
                id: 'greenmangaming',

                title: 'GreenManGaming',
                barter_vg_id: 20,
            },
            humblestore: {
                id: 'humblestore',

                title: 'Humble Store',
                barter_vg_id: 13,
            },
            humblewidgets: {
                id: 'humblewidgets',

                title: 'Humble Widgets',
                barter_vg_id: 13,
            },
            indiegalastore: {
                id: 'indiegalastore',

                title: 'IndieGala Store',
                barter_vg_id: 7,
            },
            itchio: {
                id: 'itchio',

                title: 'Itch.io',
                barter_vg_id: 28,
            },
            joybuggy: {
                id: 'joybuggy',

                title: 'JoyBuggy',
                barter_vg_id: 0,
            },
            macgamestore: {
                id: 'macgamestore',

                title: 'MacGameStore',
                barter_vg_id: 22,
            },
            microsoft: {
                id: 'microsoft',

                title: 'Microsoft Store',
                barter_vg_id: 133,
            },
            newegg: {
                id: 'newegg',

                title: 'Newegg',
                barter_vg_id: 76,
            },
            noctre: {
                id: 'noctre',

                title: 'Noctre',
                barter_vg_id: 0, // no match
            },
            nuuvem: {
                id: 'nuuvem',

                title: 'Nuuvem',
                barter_vg_id: 21,
            },
            origin: {
                id: 'origin',

                title: 'Origin',
                barter_vg_id: 0,
            },
            squenix: {
                id: 'squenix',

                title: 'Square Enix',
                barter_vg_id: 37,
            },
            steam: {
                id: 'steam',

                title: 'Steam',
                barter_vg_id: 1,
            },
            uplay: {
                id: 'uplay',

                title: 'Ubisoft Store',
                barter_vg_id: 14,
            },
            voidu: {
                id: 'voidu',

                title: 'Voidu',
                barter_vg_id: 122,
            },
            wingamestore: {
                id: 'wingamestore',

                title: 'WinGameStore',
                barter_vg_id: 34,
            },
            etailmarket: {
                id: 'etailmarket',

                title: 'eTail.Market',
                barter_vg_id: 0,
            },
        },
        bartervg = {
            0: { name: '', icon: 'unspecified2.png' },
            73: { name: '2game', icon: '2game.png' },
            211: { name: '3Kropki.pl', icon: '3kropki.png' },
            48: { name: '99 Cent Bundle', icon: '99cent.png' },
            124: { name: 'akens.ru', icon: 'akens.png' },
            131: { name: 'Alienware', icon: 'alienware.png' },
            141: { name: 'Allyouplay', icon: 'allyouplay.png' },
            134: { name: 'Alpha Bundle', icon: 'alphabundle.png' },
            12: { name: 'Amazon', icon: 'amazon.png' },
            184: { name: 'AMD Rewards', icon: 'amd.png' },
            176: { name: 'Apple', icon: 'apple.png' },
            147: { name: 'ArenaNet', icon: 'arenanet.png' },
            165: { name: 'Bananagiveaway.com', icon: 'bananag.png' },
            194: { name: 'BANDAI NAMCO', icon: 'bandai.png' },
            57: { name: 'Barter.vg', icon: 'barter.png' },
            80: { name: 'battle.net', icon: 'battlenet.png' },
            142: { name: 'Best Buy', icon: 'bestbuy.png' },
            148: { name: 'Bethesda.net', icon: 'bethesda.png' },
            120: { name: 'Bitcoin Bundle', icon: 'bitcoin.png' },
            87: { name: 'Blink Bundle', icon: 'blinkbundle.png' },
            50: { name: 'Bread Box Bundle', icon: 'breadbox.png' },
            137: { name: 'BrightLocker', icon: 'brightlocker.png' },
            45: { name: 'Bunch of Keys', icon: 'bunchkeys.png' },
            89: { name: 'Bundle Bandits', icon: 'bbandits.png' },
            90: { name: 'Bundle Central', icon: 'bcentral.png' },
            91: { name: 'Bundle Dragon', icon: 'bdragon.png' },
            92: { name: 'Bundle In A Box', icon: 'biab.png' },
            39: { name: 'Bundle Kings', icon: 'bundlekings.png' },
            118: { name: 'Buy Games Not Socks', icon: 'socks.png' },
            59: { name: 'CDKeys.com', icon: 'cdkeys.png' },
            193: { name: 'ChampionFlow', icon: 'championflow.png' },
            117: { name: "Charlie's Games", icon: 'charlies.png' },
            41: { name: 'Chrono.gg', icon: 'chronogg.png' },
            167: { name: 'Chubkeys', icon: 'chubkeys.png' },
            224: { name: 'CJS-CDKeys', icon: 'blank.png' },
            27: { name: 'Coinplay.io', icon: 'coinplay.png' },
            222: { name: 'Corel', icon: 'corel.png' },
            226: { name: 'Crucial Games', icon: 'crucial.png' },
            31: { name: 'Cubic Bundle', icon: 'cubicbundle.png' },
            93: { name: 'Cult of Mac', icon: 'cultofmac.png' },
            109: { name: 'CY Bundle', icon: 'cybundle.png' },
            17: { name: 'DailyIndieGame', icon: 'dailyindie.png' },
            6: { name: 'Desura', icon: 'desura.png' },
            74: { name: 'Direct2Drive', icon: 'd2d.png' },
            110: { name: 'Discord', icon: 'discord.png' },
            42: { name: 'DLGamer', icon: 'dlgamer.png' },
            152: { name: 'Dlh.net', icon: 'dlhnet.png' },
            63: { name: 'DogeBundle', icon: 'dogebundle.png' },
            75: { name: 'Dreamgate', icon: 'dreamgate.png' },
            200: { name: 'dupedornot', icon: 'dupedornot.png' },
            5: { name: 'EA', icon: 'ea.png' },
            218: { name: 'Elkj&oslash;p / Elgiganten', icon: 'elgiganten.png' },
            79: { name: 'Embloo', icon: 'embloo.png' },
            210: { name: 'Eneba', icon: 'eneba.png' },
            66: { name: 'Epic Games Store', icon: 'epicgamesstore.png' },
            94: { name: 'Eurobundle', icon: 'eurobundle.png' },
            228: { name: 'F2P.com', icon: 'f2p.png' },
            8: { name: 'Fanatical', icon: 'fanatical.png' },
            84: { name: 'Fangamer', icon: 'fangamer.png' },
            125: { name: 'FarmKEYS', icon: 'farmkeys.png' },
            18: { name: 'Flying Bundle', icon: 'flyingbundle.png' },
            213: { name: 'FreeAnywhere.net', icon: 'freeanywhere2.png' },
            191: { name: 'FreeToGame.com', icon: 'freetogame.png' },
            113: { name: 'From boxed copy', icon: 'disc.png' },
            159: { name: 'From Dev / Pub', icon: 'devsource.png' },
            46: { name: 'G2A', icon: 'g2a.png' },
            83: { name: 'G2play', icon: 'g2play.png' },
            217: { name: 'Gamazavr.ru', icon: 'gamazavr.png' },
            173: { name: 'Game Junkie', icon: 'gamejunkie.png' },
            143: { name: 'GAME UK', icon: 'gameuk.png' },
            144: { name: 'Gamebillet', icon: 'gamebillet.png' },
            40: { name: 'GameBundle', icon: 'gamebundle.png' },
            162: { name: 'Gamecode.win', icon: 'gamecodewin.png' },
            177: { name: 'GameDev.tv', icon: 'gamedevtv.png' },
            221: { name: 'Gameflip', icon: 'gameflip.png' },
            227: { name: 'Gameflix.ru', icon: 'gameflixru.png' },
            149: { name: 'Gamehag', icon: 'gamehag.png' },
            155: { name: 'GAMEHUNT', icon: 'gamehunt.png' },
            103: { name: 'Gameolith', icon: 'gameolith.png' },
            233: { name: 'Gamerpower', icon: 'gamerpower.png' },
            11: { name: 'GamersGate', icon: 'gamersgate.png' },
            88: { name: 'Games Rage', icon: 'gamesrage.png' },
            72: { name: 'Games Republic', icon: 'grepublic.png' },
            201: { name: 'GamesBolt', icon: 'gamebolt.png' },
            207: { name: 'GAMESLOAD', icon: 'gamesload.png' },
            43: { name: 'Gamesplanet', icon: 'gamesplanet.png' },
            145: { name: 'GameStop', icon: 'gamestop.png' },
            164: { name: 'Gamezito', icon: 'gamezito.png' },
            216: { name: 'Gaming Dragons', icon: 'dragons.png' },
            81: { name: 'Gamivo', icon: 'gamivo.png' },
            123: { name: 'gemly', icon: 'gemly.png' },
            82: { name: 'Get Games Go', icon: 'getgames.png' },
            192: { name: 'Giveaway of the Day', icon: 'giveawayoftheday.png' },
            153: { name: 'GiveAway.su', icon: 'giveawaysu.png' },
            166: { name: 'GiveawayHopper', icon: 'ghopper.png' },
            231: { name: 'givee.club', icon: 'givee.png' },
            186: { name: 'Givekey.ru', icon: 'givekey.png' },
            154: { name: 'Gleam', icon: 'gleam.png' },
            212: { name: 'Godankey', icon: 'godankey.png' },
            4: { name: 'GOG', icon: 'gog.png' },
            58: { name: 'GoGoBundle', icon: 'gogobundles.png' },
            179: { name: 'Google', icon: 'google.png' },
            204: { name: 'Grab The Games', icon: 'grabthegame.png' },
            156: { name: 'GrabFreeGame', icon: 'grabfreegame.png' },
            95: { name: 'gram.pl', icon: 'gram.png' },
            16: { name: 'Green Light Bundle', icon: 'greenlight.png' },
            20: { name: 'Green Man Gaming', icon: 'gmg.png' },
            127: { name: 'Greenlight Arcade', icon: 'greenlighta.png' },
            9: { name: 'Groupees', icon: 'groupees3.png' },
            128: { name: 'H2O Bundle', icon: 'h2o.png' },
            232: { name: 'HitSquad Games', icon: 'hitsquad.png' },
            33: { name: 'HRK', icon: 'hrk.png' },
            3: { name: 'Humble Bundle', icon: 'humblebundle.png' },
            13: { name: 'Humble Store', icon: 'humblebundle.png' },
            85: { name: 'Humble Trove', icon: 'trove.png' },
            214: { name: 'Idle-Empire', icon: 'idle-empire.png' },
            229: { name: 'iGames.gg', icon: 'igames.png' },
            132: { name: 'IGN', icon: 'ign.png' },
            96: { name: 'Indie Ammo Box', icon: 'indieammo.png' },
            170: { name: 'Indie DB', icon: 'indiedb.png' },
            161: { name: 'Indie Face Kick', icon: 'indiefacekick.png' },
            10: { name: 'Indie Royale', icon: 'indieroyale.png' },
            115: { name: 'Indie-games pack', icon: 'igpack.png' },
            97: { name: 'IndieBundle', icon: 'iborg.png' },
            68: { name: 'IndieDeals.net', icon: 'indiedeals2.png' },
            121: { name: 'IndieFort', icon: 'gamersgate.png' },
            7: { name: 'Indiegala', icon: 'indiegala.png' },
            24: { name: 'IndieGameStand', icon: 'igamestand.png' },
            206: { name: 'Intel', icon: 'intel.png' },
            199: { name: 'io interactive', icon: 'ioi.png' },
            28: { name: 'itch.io', icon: 'itchio.png' },
            195: { name: 'Jackbox Games', icon: 'jackbox.png' },
            235: { name: 'K4G', icon: 'k4g.png' },
            220: { name: 'Kalypso Media', icon: 'kalypso.png' },
            150: { name: 'Kartridge', icon: 'kartridge.png' },
            202: { name: 'Keyhub', icon: 'keyhub.png' },
            158: { name: 'KeyJoker', icon: 'keyjoker.png' },
            223: { name: 'Keysora', icon: 'blank.png' },
            205: { name: 'Kickstarter', icon: 'kickstarter.png' },
            60: { name: 'Kinguin', icon: 'kinguin.png' },
            98: { name: 'KissMyBundles', icon: 'kissmb.png' },
            174: { name: 'Last Best Offer', icon: 'lbo.png' },
            15: { name: 'Lazy Guys Bundle', icon: 'lazyguys.png' },
            234: { name: 'Legacy Games', icon: 'legacygames.png' },
            111: { name: 'lequestore', icon: 'lequestore.png' },
            140: { name: 'Loot Crate', icon: 'lootcrate.png' },
            151: { name: 'LootBoy', icon: 'lootboy.png' },
            22: { name: 'MacGameStore', icon: 'macgamestore.png' },
            99: { name: 'MadOrc', icon: 'madorc.png' },
            56: { name: 'MarvelousCrate', icon: 'marvelous.png' },
            163: { name: 'MarvelousGA', icon: 'marvelousga.png' },
            133: { name: 'Microsoft Store', icon: 'microsoft.png' },
            187: { name: 'MMOBomb', icon: 'mmobomb.png' },
            208: { name: 'MMOGA', icon: 'mmoga.png' },
            190: { name: 'MMOGames.com', icon: 'mmogames2.png' },
            171: { name: 'MMORPG.com', icon: 'mmorpg.png' },
            76: { name: 'Newegg', icon: 'newegg.png' },
            25: { name: 'Nintendo 3DS', icon: '3ds.png' },
            183: { name: 'Nintendo Switch', icon: 'switch.png' },
            21: { name: 'Nuuvem', icon: 'nuuvem.png' },
            180: { name: 'NVIDIA', icon: 'nvidia.png' },
            185: { name: 'NVIDIA Rewards', icon: 'nvidia.png' },
            129: { name: 'Oculus', icon: 'oculus.png' },
            30: { name: 'one more bundle', icon: 'onemore.png' },
            135: { name: 'Opium Pulses', icon: 'opiumpulses.png' },
            230: { name: 'OPQuests', icon: 'opquests.png' },
            36: { name: 'Orlygift', icon: 'orlygift.png' },
            62: { name: 'Otaku Bundle', icon: 'otakubundle.png' },
            38: { name: 'OtakuMaker', icon: 'otakumaker.png' },
            197: { name: 'OVERKILL Software', icon: 'overkillsoftware.png' },
            138: { name: 'Oy Vey Keys', icon: 'oyvey2.png' },
            100: { name: 'Paddle', icon: 'paddle.png' },
            101: { name: 'PayWUW', icon: 'paywuw.png' },
            203: { name: 'PC Gamer', icon: 'pcgamer.png' },
            102: { name: 'Peon Bundle', icon: 'peonb.png' },
            64: { name: 'Plati', icon: 'plati.png' },
            23: { name: 'Playinjector', icon: 'playinjector.png' },
            225: { name: 'Playism', icon: 'playism.png' },
            52: { name: 'PlayStation 3', icon: 'ps3.png' },
            51: { name: 'PlayStation 4', icon: 'ps4.png' },
            219: { name: 'Playstation 5', icon: 'ps4.png' },
            169: { name: 'Project Z', icon: 'projectz.png' },
            188: { name: 'Prys', icon: 'prys.png' },
            78: { name: 'PSN', icon: 'ps4.png' },
            77: { name: 'PSVita', icon: 'ps3.png' },
            114: { name: 'PuppyGames', icon: 'puppygames.png' },
            130: { name: 'Razer', icon: 'razer.png' },
            49: { name: 'Redacted Network', icon: 'redacted.png' },
            112: { name: 'Rockstar Social Club', icon: 'rockstar.png' },
            198: { name: 'Running With Scissors', icon: 'rws.png' },
            104: { name: "Select n' Play", icon: 'selectnp.png' },
            105: { name: 'ShinyLoot', icon: 'shinyloot.png' },
            44: { name: 'Sila Games', icon: 'silagames.png' },
            209: { name: 'SONKWO', icon: 'sonkwo.png' },
            37: { name: 'Square Enix', icon: 'squareenix.png' },
            106: { name: 'StackSocial', icon: 'stacksocial.png' },
            139: { name: 'Stardock', icon: 'stardock.png' },
            1: { name: 'Steam', icon: 'steam.png' },
            35: { name: 'Steam Greenlight', icon: 'sgreenlight.png' },
            19: { name: 'Steam Item', icon: 'steam.png' },
            2: { name: 'Steam Package', icon: 'steam.png' },
            86: { name: 'Steam-tracker', icon: 'steam-tracker.png' },
            55: { name: 'Steamgifts.com', icon: 'steamgifts.png' },
            47: { name: 'Steamground', icon: 'steamground.png' },
            65: { name: 'Steamtrades.com', icon: 'streamtrades.png' },
            168: { name: 'SteelSeries', icon: 'steelseries.png' },
            119: { name: 'Subsoap', icon: 'subsoap.png' },
            116: { name: 'Super Shock Bundle', icon: 'supershock.png' },
            29: { name: 'Super-Duper Bundle', icon: 'superduper.png' },
            189: { name: 'Takekey.ru', icon: 'takekey.png' },
            32: { name: 'Telltale Games', icon: 'telltale.png' },
            69: { name: 'The Indie Games Bundle', icon: 'tigb.png' },
            70: { name: 'Tiltify', icon: 'tiltify.png' },
            126: { name: 'TKFG', icon: 'tkfg.png' },
            71: { name: 'Tremor Games', icon: 'tremorgames.png' },
            67: { name: 'Twitch', icon: 'twitch.png' },
            14: { name: 'Ubisoft Connect', icon: 'ubisoft.png' },
            175: { name: 'Unity Asset Store', icon: 'unity.png' },
            107: { name: 'Universala', icon: 'universala.png' },
            61: { name: 'Unspecified Platform', icon: 'unspecified2.png' },
            196: { name: 'Victorage Giveaways', icon: 'victorage.png' },
            108: { name: 'VODO', icon: 'vodo.png' },
            122: { name: 'Voidu', icon: 'voidu.png' },
            160: { name: 'WeGame X', icon: 'wegamex.png' },
            157: { name: "Who's Gaming Now?!", icon: 'wgn.png' },
            26: { name: 'WiiU', icon: 'wiiu.png' },
            34: { name: 'WinGameStore', icon: 'wingamestore.png' },
            53: { name: 'Xbox 360', icon: 'xb360.png' },
            146: { name: 'Xbox Live', icon: 'xbone.png' },
            54: { name: 'Xbox One', icon: 'xbone.png' },
            215: { name: 'Yuplay.ru', icon: 'yuplay.png' },
            172: { name: 'zeepond.com', icon: 'blank.png' },
            178: { name: 'Zenva Academy', icon: 'zenva.png' },
        };

    function getBarterStoreIcon(itadStoreId) {
        if (itadStoreId in itadStores && 'barter_vg_id' in itadStores[itadStoreId]) {
            return bartervg[itadStores[itadStoreId].barter_vg_id].icon;
        }
        return bartervg[0].icon;
    }

    function getGamesTradeSummaryHtml(gameStats, direction) {
        const tradeSummary = format(variables.html.tradeSummary, {
            0: direction,
            1: gameStats[direction].gamesInBundles,
            2: gameStats[direction].totalBundles,
            4: gameStats[direction].averageReviewScore,
            5: gameStats[direction].averageWeightedReviewScore,
            6: gameStats[direction].voteCount,
            7: (Math.log(gameStats[direction].voteCount) / Math.log(2)).toFixed(2),
            8: gameStats[direction].ratios.index,
            9: gameStats[direction].ratios.real,
        });
        return tradeSummary;
    }

    function addPageElements(allGames) {
        const tradables = document.querySelectorAll('.tradables');

        const gameType = {
            to: [],
            from: [],
        };
        for (const game of Object.values(allGames)) {
            gameType[game.trade_direction].push(game);
            addElementToGame(game);
        }
        const gameStats = {};
        for (const direction of ['to', 'from']) {
            gameStats[direction] = calculateGameStats(gameType[direction]);
            const tradeSummary = getGamesTradeSummaryHtml(gameStats, direction);
            const tableLi = document.createElement('li');
            tableLi.innerHTML = tradeSummary;
            if (gameStats[direction].games === 1) {
                // remove the average rows from the table
                tableLi.querySelectorAll('.average').forEach((el) => el.remove());
            }
            if (direction === 'from') {
                tradables[0].querySelector('.tradables_items_list').appendChild(tableLi);
            } else {
                tradables[1].querySelector('.tradables_items_list').prepend(tableLi);
            }
        }
        return addGameDetails(allGames);
    }

    function addElementToGame(game) {
        const domElement = document.querySelector(
            `.tradables_items_list li[data-item-id="${game.item_id}"]`
        );
        if (!domElement) {
            console.warn('Could not find HTML element for game', game.item_id);
        } else {
            game.element = domElement;
        }
    }

    function addGameDetails(allGames) {
        Object.values(allGames).forEach((game) => {
            const ratios = Ratios.getTradeRatios(game);
            const gameElement = game.element;
            const gameDetailHtml = parseHTML(
                format(variables.html.gameDetails, {
                    0: `${ratios.index} (${ratios.real})`,
                    1:
                        'bundles_all' in game
                            ? `${game.bundles_all} (${game.bundles_available} current)`
                            : 'none',
                })
            );
            gameElement.append(...gameDetailHtml);
            for (const store of ['steam', 'itad', 'lowest']) {
                game[`${store}PriceEl`] = gameElement.querySelector(
                    `.bve-game-details__${store}-price`
                );
            }
            game.tradeRatioEl = gameElement.querySelector('.bve-game-details__trade-ratio');
        });
        return new Promise((resolve) => resolve());
    }

    function iconImage$1(storeName, iconFile) {
        return `<img src="https://bartervg.com/imgs/ico/${iconFile}" alt="${storeName}" class="price-link" />`;
    }

    function calculateGamePriceStats(games) {
        const stats = {
            to: {
                nGames: games.to.length,
                steamTotal: 0,
                steamTotalOld: 0,
                itadTotal: 0,
                lowestTotal: 0,
            },
            from: {
                nGames: games.from.length,
                steamTotal: 0,
                steamTotalOld: 0,
                itadTotal: 0,
                lowestTotal: 0,
            },
        };

        let currency;
        for (const game of Object.values(games.all)) {
            // steam prices
            if ('steam_price' in game) {
                game.steamPriceEl.innerHTML = `${iconImage$1(
                'Steam',
                'steam.png'
            )}&nbsp;<abbr title="not available">N/A</abbr>`;
                try {
                    let priceString = `<a href="https://store.steampowered.com/app/${
                    game.sku
                }/" title="${game.title} on Steam">${iconImage$1('Steam', 'steam.png')}&nbsp;${
                    game.steam_price.price === 0 ? 'Free' : game.steam_price.price
                }&nbsp;${game.steam_price.currency}</a>`;

                    if (game.steam_price.cut !== 0) {
                        priceString += ` (${game.steam_price.cut}% off)`;
                    }
                    game.steamPriceEl.innerHTML = priceString;
                    stats[game.trade_direction].steamTotal += game.steam_price.price;
                    stats[game.trade_direction].steamTotalOld += game.steam_price.price_old;
                    if (!currency) {
                        currency = game.steam_price.currency;
                    }
                } catch (e) {
                    // eslint-disable-next-line no-console
                    console.log({ item_id: game.item_id, ...game[`steam_price`] });
                }
            }

            for (const type of ['itad', 'lowest']) {
                if (`${type}_price` in game) {
                    game[`${type}PriceEl`].innerHTML = `${
                    type === 'itad' ? 'ITAD' : 'Lowest'
                }: <a href="https://isthereanydeal.com/game/${game.itad_id}/info/">N/A</a>`;
                    try {
                        const storeIcon = getBarterStoreIcon(game[`${type}_price`].shop.id);
                        game[`${type}PriceEl`].innerHTML = `<a href="https://isthereanydeal.com/game/${
                        game.itad_id
                    }/info/" title="Best ${
                        type === 'itad' ? 'current' : 'historical'
                    } price: ${game[`${type}_price`].price.toFixed(2)} at ${
                        game[`${type}_price`].shop.name
                    }">${iconImage$1(game[`${type}_price`].shop.name, storeIcon)}&nbsp;${game[
                        `${type}_price`
                    ].price.toFixed(2)}&nbsp;${game[`${type}_price`].currency}</a>`;
                        stats[game.trade_direction][`${type}Total`] += game[`${type}_price`].price;
                        if (!currency) {
                            currency = game[`${type}_price`].currency;
                        }
                    } catch (e) {
                        // eslint-disable-next-line no-console
                        console.log({ item_id: game.item_id, ...game[`${type}_price`] });
                    }
                }
            }
        }
        stats.currency = currency;
        return stats;
    }

    function populateTotalStats(stats) {
        const { currency } = stats;
        for (const direction of ['to', 'from']) {
            document.querySelector(`#${direction}_total_steam`).innerHTML =
                `${stats[direction].steamTotal.toFixed(2)} ${currency} ` +
                `(${stats[direction].steamTotalOld.toFixed(2)}  ${currency})`;

            document.querySelector(`#${direction}_total_itad`).innerHTML = `${stats[
            direction
        ].itadTotal.toFixed(2)} ${currency}`;

            if (stats[direction].nGames !== 1) {
                // average price
                document.querySelector(`#${direction}_average_steam`).innerHTML =
                    `${(stats[direction].steamTotal / stats[direction].nGames).toFixed(
                    2
                )} ${currency} ` +
                    `(${(stats[direction].steamTotalOld / stats[direction].nGames).toFixed(
                    2
                )} ${currency})`;

                document.querySelector(`#${direction}_average_itad`).innerHTML = `${(
                stats[direction].itadTotal / stats[direction].nGames
            ).toFixed(2)} ${currency}`;
            }
        }
    }

    function initGameData(respData) {
        const offerData = respData;
        const games = {
            to: [],
            from: [],
            all: {},
        };
        for (const direction of ['to', 'from']) {
            for (const game of Object.values(offerData.items[direction])) {
                game.platform_id = game.platform;
                game.trade_direction = direction;
                games.all[game.item_id] = game;
                games[direction].push(game.item_id);
            }
        }
        return games;
    }

    class OffersPageController {
        static get routes() {
            return [
                new Route(
                    /^https:\/\/barter\.vg\/u\/.+\/o\/.+\/$/,
                    this,
                    this.prototype.index,
                    // don't run on deal creation pages
                    () =>
                        document.querySelector('.statusCurrent') &&
                        document.querySelector('.statusCurrent').textContent !== 'Creating...'
                ),
            ];
        }

        async index() {
            const response = await Http.getPromise(`${window.location.href}json`);
            if (response.status !== 200) {
                throw new Error('Could not retrieve JSON data for this offer');
            }
            if ('error' in response.data || ('success' in response.data && !response.data.success)) {
                throw new Error(response.data.error);
            }

            const games = initGameData(response.data);
            await Promise.all([
                addPageElements(games.all),
                SteamClient.getPrices(games.all),
                ItadClient.getPrices(games.all),
                ItadClient.getLowestPrices(games.all),
            ]);
            populateTotalStats(calculateGamePriceStats(games));
        }
    }

    const BUNDLE_SYMBOL = '&#x26C1;';

    function generatePriceRatioElements(game) {
        const linkTemplate =
            `<div class="game-details">` +
            `<span class="ratio" title="Game tradability index">{1}</span>` +
            `<span class="bundled" title="how many times the game has been bundled">{2}</span></div>` +
            `<div class="price-details">` +
            `<span class="steam_price"></span>` +
            `<span class="itad_price"></span>` +
            `<span class="lowest_price"></span>` +
            `</div>`;

        // does it have the ratios calculated?
        if (!('ratios' in game)) {
            game.ratios = Ratios.getTradeRatios(game);
        }

        const templateData = {
            1: game.ratios === null ? 'no data' : `${game.ratios.index} (${game.ratios.real})`,
            2: `${'bundles_all' in game ? game.bundles_all : 0}&nbsp;${BUNDLE_SYMBOL}`,
            3: game.item_id,
        };
        game.price_ratio_data = format(linkTemplate, templateData);
        return game.price_ratio_data;
    }

    function iconImage(storeName, iconFile) {
        return `<img src="https://bartervg.com/imgs/ico/${iconFile}" alt="${storeName}" class="price-link" />`;
    }

    function addSteamPrice(game) {
        game.steamPriceHtml = `${iconImage(
        'Steam',
        'steam.png'
    )}&nbsp;<abbr title="not available">N/A</abbr>`;
        if ('steam_price' in game && game.steam_price !== null) {
            try {
                game.steamPriceHtml = `<a href="https://store.steampowered.com/app/${
                game.sku
            }/" title="${game.title} ${game.steam_price.currency} on Steam">${iconImage(
                'Steam',
                'steam.png'
            )}&nbsp;${game.steam_price.price}&nbsp;${game.steam_price.currency}</a>`;
            } catch (e) {
                // eslint-disable-next-line no-console
                console.log({ item_id: game.item_id, steam: game.steam_price });
            }
        }
        addPriceToElement(game, 'steam');
    }

    function addItadPrice(game) {
        if ('itad_id' in game) {
            game.itadPriceHtml = `ITAD: <a href="https://isthereanydeal.com/game/${game.itad_id}/info/">N/A</a>`;
            if ('itad_price' in game && game.itad_price !== null) {
                try {
                    const storeIcon = getBarterStoreIcon(game.itad_price.shop.id);
                    game.itadPriceHtml = `<a href="https://isthereanydeal.com/game/${
                    game.itad_id
                }/info/" title="Best current price: ${game.itad_price.price.toFixed(2)} ${
                    game.itad_price.currency
                } at ${game.itad_price.shop.name}">${iconImage(
                    game.itad_price.shop.name,
                    storeIcon
                )}&nbsp;${game.itad_price.price.toFixed(2)}&nbsp;${game.itad_price.currency}</a>`;
                } catch (e) {
                    // eslint-disable-next-line no-console
                    console.log({ item_id: game.item_id, itad: game.itad_price });
                }
            }
            addPriceToElement(game, 'itad');
        }
    }

    function addLowestPrice(game) {
        if ('itad_id' in game) {
            game.lowestPriceHtml =
                'Best: <a href="https://isthereanydeal.com/game/' + game.itad_id + '/info/">N/A</a>';
            if ('lowest_price' in game && game.lowest_price !== null) {
                try {
                    const storeIcon = getBarterStoreIcon(game.lowest_price.shop.id);
                    game.lowestPriceHtml = `<a href="https://isthereanydeal.com/game/${
                    game.itad_id
                }/info/" title="Best historical price: ${game.lowest_price.price.toFixed(2)} ${
                    game.itad_price.currency
                } at ${game.lowest_price.shop.name}">${iconImage(
                    game.lowest_price.shop.name,
                    storeIcon
                )}&nbsp;${game.lowest_price.price.toFixed(2)}&nbsp;${game.itad_price.currency}</a>`;
                } catch (e) {
                    // eslint-disable-next-line no-console
                    console.log({ item_id: game.item_id, itad: game.lowest_price });
                }
            }
            addPriceToElement(game, 'lowest');
        }
    }

    function addPriceToElement(game, type) {
        for (const el of game.elArray) {
            el.querySelector(`.${type}_price`).innerHTML = game[`${type}PriceHtml`];
        }
    }

    function addPriceData(allGames, type) {
        const fnMap = {
            steam: addSteamPrice,
            itad: addItadPrice,
            lowest: addLowestPrice,
        };
        Object.values(allGames).forEach((game) => {
            fnMap[type](game);
        });
    }

    function addPriceElements(allGames) {
        Object.values(allGames).forEach((game) => {
            const priceRatioEls =
                'price_ratio_data' in game ? game.price_ratio_data : generatePriceRatioElements(game);
            const htmlString = priceRatioEls;
            for (const gameEl of game.elArray) {
                const newElements = parseHTML(htmlString);
                newElements.forEach((el) => {
                    const smt = gameEl.querySelector('.showMoreToggle');
                    if (smt) {
                        smt.parentNode.insertBefore(el, smt);
                    } else {
                        gameEl.appendChild(el);
                    }
                });
            }
        });
        return new Promise((resolve) => {
            resolve();
        });
    }

    /**
     * Retrieves wishlist and tradable games and merges that data
     * with existing game DOM element data
     *
     * @param {object} gameLinks DOM elements, indexed by item_id
     * @returns {object} allGames, indexed by item_id
     */
    async function retrieveWishlistTradelist$1(gameLinks) {
        // load the wishlist and the tradelist
        const userHref = window.location.href.replace(/\/o\/.*/, '');

        const [tradable, wishlist] = await Promise.all([
            Http.getPromise(`${userHref}/t/json`),
            Http.getPromise(`${userHref}/w/json`),
        ]).catch((error) => {
            // eslint-disable-next-line no-console
            console.log('oh shit, an error!');
            // eslint-disable-next-line no-console
            console.log(error);
        });

        // merge all the data, remap to be indexed by item_id
        // create a new object with merged game data and link data
        const allGames = {};
        Object.values(
            Object.assign(
                ...Object.values(tradable.data.by_platform),
                ...Object.values(wishlist.data.by_platform)
            )
        ).forEach((game) => {
            if (game.item_id in gameLinks.all) {
                allGames[game.item_id] = { ...game, ...gameLinks.all[game.item_id] };
            }
        });
        return allGames;
    }

    function scrapeGameRows() {
        // add a class to the 'filterUnowned' parent tr nodes to save faffing with the children
        document.querySelectorAll('.filterUnowned').forEach((f) => {
            f.parentNode.classList.add('noborder');
        });

        const games = {
            all: {},
            from: [],
            to: [],
        };

        const tradables = document.querySelectorAll('.tradables');
        const nMap = {
            0: 'from',
            1: 'to',
        };
        for (const n of [0, 1]) {
            tradables[n].querySelectorAll('tr').forEach((tr) => {
                if (tr.hasAttribute('data-item-id')) {
                    const item_id = Number(tr.getAttribute('data-item-id'));
                    const additionalData = document.createElement('div');
                    tr.querySelector('td').append(additionalData);
                    games.all[item_id] = {
                        item_id,
                        elArray: [additionalData],
                    };
                    games[nMap[n]].push(item_id);
                }
            });
        }
        // remove cols 2 and 3
        document.querySelectorAll('tr.noborder th[colspan]').forEach((th) => {
            th.setAttribute('colspan', 2);
        });
        document.querySelectorAll('tr[data-item-id] td:nth-child(2)').forEach((td) => td.remove());
        document.querySelectorAll('tr[data-item-id] td:nth-child(2)').forEach((td) => td.remove());
        return games;
    }

    class OfferCreationPageController {
        static get routes() {
            return [
                new Route(
                    // offer creation either occurs as a POST from the user offer page
                    // or on a page with an offer number after the 'o' in the URL
                    /^https:\/\/barter\.vg\/u\/.+\/o\/(\d+\/(#offer)?)?$/,
                    this,
                    this.prototype.index,
                    // only run on deal creation pages
                    () =>
                        document.querySelector('.statusCurrent') &&
                        document.querySelector('.statusCurrent').textContent === 'Creating...'
                ),
            ];
        }

        async index() {
            const gameLinks = scrapeGameRows();
            const allGames = await retrieveWishlistTradelist$1(gameLinks);

            await Promise.all([
                addPriceElements(allGames),
                ItadClient.getPrices(allGames).then(() => {
                    addPriceData(allGames, 'itad');
                }),
                ItadClient.getLowestPrices(allGames).then(() => {
                    addPriceData(allGames, 'lowest');
                }),
                SteamClient.getPrices(allGames).then(() => {
                    addPriceData(allGames, 'steam');
                }),
            ]);
        }
    }

    const GAME_LINK = /https:\/\/barter.vg\/i\/(\d+)\//;

    /**
     * Retrieves wishlist and tradable games and merges that data
     * with existing game DOM element data
     *
     * @param {object} gameLinks DOM elements, indexed by item_id
     * @returns {object} allGames, indexed by item_id
     */
    async function retrieveWishlistTradelist(gameLinks) {
        // load the wishlist and the tradelist
        const currentHref = window.location.href.replace(/[wt]\/m\/\??/, '');

        const [tradable, wishlist] = await Promise.all([
            Http.getPromise(`${currentHref}t/json`),
            Http.getPromise(`${currentHref}w/json`),
        ]).catch((error) => {
            // eslint-disable-next-line no-console
            console.log('oh shit, an error!');
            // eslint-disable-next-line no-console
            console.log(error);
        });

        // merge all the data, remap to be indexed by item_id
        // create a new object with merged game data and link data
        const allGames = {};
        Object.values(
            Object.assign(
                ...Object.values(tradable.data.by_platform),
                ...Object.values(wishlist.data.by_platform)
            )
        ).forEach((game) => {
            if (game.item_id in gameLinks) {
                allGames[game.item_id] = { ...game, elArray: gameLinks[game.item_id] };
            }
        });
        return allGames;
    }

    function scrapeGames() {
        // retrieve the games mentioned on this page
        const gameLinks = {};
        document.querySelectorAll('.matchcol li a[href^="https://barter.vg/i/"]').forEach((el) => {
            const matches = el.href.match(GAME_LINK);
            if (matches) {
                const gameId = matches[1];
                if (!(gameId in gameLinks)) {
                    gameLinks[gameId] = [];
                }
                gameLinks[gameId].push(el.parentElement);
            }
        });
        return gameLinks;
    }

    class MatchPage {
        ready() {
            if (document.readyState !== 'loading') {
                MatchPage.getData();
            } else {
                document.addEventListener('DOMContentLoaded', MatchPage.getData);
            }
        }
        static async getData() {
            // ensure it's a page with a match section
            if (document.querySelector('.matchcol') === null) {
                return;
            }
            const gameLinks = scrapeGames();
            const allGames = await retrieveWishlistTradelist(gameLinks);
            await Promise.all([
                addPriceElements(allGames),
                ItadClient.getPrices(allGames).then(() => {
                    addPriceData(allGames, 'itad');
                }),
                ItadClient.getLowestPrices(allGames).then(() => {
                    addPriceData(allGames, 'lowest');
                }),
                SteamClient.getPrices(allGames).then(() => {
                    addPriceData(allGames, 'steam');
                }),
            ]);
        }

        static get routes() {
            return [
                new Route(
                    // https://barter.vg/u/<user_id>/[wt]/m || /m/ || /m/?
                    /^https:\/\/barter\.vg\/u\/.+\/[wt]\/m(|\/|\?)$/,
                    this,
                    this.prototype.ready,
                    null
                ),
            ];
        }
    }

    var controllers = [OffersPageController, OfferCreationPageController, MatchPage];

    const style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.textContent = variables.css.style;
    document.querySelector('head').append(style);

    const router = new Router();
    controllers.forEach((controller) => {
        router.registerRoutes(controller.routes);
    });

    router.route();

})();
//# sourceMappingURL=bundle.js.map
