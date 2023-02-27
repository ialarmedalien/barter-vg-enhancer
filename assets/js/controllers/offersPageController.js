import $ from 'jquery';

import { Route } from '../modules/router';
import Http from '../modules/http';
import Fractions from '../modules/fractions';
import format from '../modules/format';
import Steam from '../modules/steam';

import variables from '../modules/templates';

const GAME_STAT_TEMPLATE_OBJECT = {
    totalTradeable: 0,
    totalWishlist: 0,
    averageReviewScore: 0,
    averageWeightedReviewScore: 0,
    voteCount: 0,
    gamesInBundles: 0,
    games: 0,
    totalBundles: 0,
};

function gameStatReducer(previousValue, currentValue) {
    previousValue.totalTradeable += currentValue.tradeable;
    previousValue.totalWishlist += currentValue.wishlist;
    previousValue.averageReviewScore += currentValue.positiveUserReviewPercentage;
    previousValue.averageWeightedReviewScore +=
        currentValue.positiveUserReviewPercentage * currentValue.totalUserReviews;
    previousValue.voteCount += currentValue.totalUserReviews;
    previousValue.gamesInBundles += currentValue.allBundleCount > 0 ? 1 : 0;
    previousValue.totalBundles += currentValue.allBundleCount;
    previousValue.games += 1;
    return previousValue;
}

function calculateGameStats(games) {
    const gameStats = games.reduce(gameStatReducer, $.extend({}, GAME_STAT_TEMPLATE_OBJECT));

    gameStats.averageReviewScore = Number(
        (gameStats.averageReviewScore / gameStats.games).toFixed(0)
    );
    gameStats.averageWeightedReviewScore = Number(
        (gameStats.averageWeightedReviewScore / gameStats.voteCount).toFixed(0)
    );
    const ratios = Fractions.getTradeRatios(gameStats.totalTradeable, gameStats.totalWishlist);
    gameStats.tradeRatioRounded = ratios.rounded;
    gameStats.summary = ratios.summary;
    gameStats.tradeRatioActual = ratios.real;

    return gameStats;
}

function getGamesTradeSummary(games, idPrefix) {
    const gameStats = calculateGameStats(games);
    const tradeSummary = format(
        variables.html.tradeSummary,
        gameStats.games,
        gameStats.gamesInBundles,
        gameStats.totalTradeable,
        gameStats.totalWishlist,
        gameStats.averageReviewScore,
        gameStats.averageWeightedReviewScore,
        gameStats.tradeRatioRounded,
        gameStats.summary,
        gameStats.totalBundles,
        gameStats.tradeRatioActual,
        gameStats.voteCount,
        (Math.log(gameStats.voteCount) / Math.log(2)).toFixed(2),
        idPrefix
    );
    return tradeSummary;
}

class GameOfferModel {
    constructor(gameItem) {
        this._gameItem = gameItem;
    }

    get itemId() {
        return this._gameItem.item_id;
    }

    get steamId() {
        return this._gameItem.sku;
    }

    get tradeable() {
        return this._gameItem.tradeable;
    }

    get wishlist() {
        return this._gameItem.wishlist;
    }

    get positiveUserReviewPercentage() {
        return this._gameItem.user_reviews_positive;
    }

    get totalUserReviews() {
        return this._gameItem.user_reviews_total;
    }

    get allBundleCount() {
        return this._gameItem.bundles_all;
    }

    get prices() {
        return this._prices;
    }

    set prices(value) {
        this._prices = value;
    }

    get type() {
        return this._type;
    }

    set type(value) {
        this._type = value;
    }

    get element() {
        return this._element;
    }

    set element(value) {
        this._element = value;
    }

    get steamStorePriceElement() {
        return this._steamStorePriceElement;
    }

    set steamStorePriceElement(value) {
        this._steamStorePriceElement = value;
    }

    get tradeRatioElement() {
        return this._tradeRatioElement;
    }

    set tradeRatioElement(value) {
        this._tradeRatioElement = value;
    }
}

function addElementToGameOffers(tradeables, gameOffers) {
    const urlRegex = /https:\/\/barter.vg\/i\/(\d+)\//;
    const tradablesItemsList = tradeables.find('.tradables_items_list li:not(.bold)');
    $.each(tradablesItemsList, (_, tradablesItems) => {
        const gameUrl = $(tradablesItems).find('.tradables_info > strong > a').attr('href');
        const match = urlRegex.exec(gameUrl);
        if (match !== null) {
            const gameOffer = gameOffers.find((go) => {
                const matchItemId = Number(match[1]);
                return go.itemId === matchItemId;
            });
            if (gameOffer) {
                gameOffer.element = tradablesItems;
            } else {
                console.warn('Could not find HTML element for game', gameOffer.itemId);
            }
        }
    });
}

function createGameOffersFromOfferData(offerData, games) {
    const gameOffers = [];

    ['to', 'from'].forEach(type => {
        for (const gameKey in offerData.items[type]) {
            if (gameKey in offerData.items[type]) {
                const gameOffer = new GameOfferModel(offerData.items[type][gameKey]);
                gameOffer.type = type;
                gameOffers.push(gameOffer);
                games[type].push(gameOffer);
            }
        }
    })

    return gameOffers;
}

function addGameDetails(gameOffers) {
    gameOffers.forEach((gameOffer) => {
        const ratios = Fractions.getTradeRatios(gameOffer.tradeable, gameOffer.wishlist);
        const gameElement = gameOffer.element;
        $(gameElement).css('position', 'relative');
        $(gameElement).find('.tradables_info').css('max-width', '380px');
        $(gameElement).append(format(variables.html.gameDetails, ratios.summary));
        const steamStorePriceElement = $(gameElement).find('.bve-game-details__steam-store-price');
        const tradeRatioElement = $(gameElement).find('.bve-game-details__trade-ratio');
        gameOffer.steamStorePriceElement = steamStorePriceElement.get(0);
        gameOffer.tradeRatioElement = tradeRatioElement.get(0);
    });
}

export default class OffersPageController {
    static get routes() {
        return [
            new Route(
                /^https:\/\/barter\.vg\/u\/.+\/o\/.+\/$/,
                this,
                this.prototype.index,
                () => $('.statusCurrent').text() !== 'Creating...'
            ),
        ];
    }

    index() {
        Http.get(`${window.location.href}json`, (result, response) => {
            if (!result) {
                console.error('Failed getting offer data from barter.vg');
                return;
            }

            const offerData = response.data;
            const games = {
                to: [],
                from: [],
            };
            const gameOffers = createGameOffersFromOfferData(offerData, games);

            const tradeables = $('.tradables');
            addElementToGameOffers(tradeables, gameOffers);

            const fromIdPrefix = 'offered';
            const fromTradeSummary = getGamesTradeSummary(games.from, fromIdPrefix);
            tradeables.eq(0).after(fromTradeSummary);

            const toIdPrefix = 'requested';
            const toTradeSummary = getGamesTradeSummary(games.to, toIdPrefix);
            tradeables.eq(1).before(toTradeSummary);

            addGameDetails(gameOffers);

            const fromTotalValue = $(`#${fromIdPrefix}_total_value`);
            const toTotalValue = $(`#${toIdPrefix}_total_value`);
            const fromAverageValue = $(`#${fromIdPrefix}_average_value`);
            const toAverageValue = $(`#${toIdPrefix}_average_value`);
            const allValues = fromTotalValue
                .add(toTotalValue)
                .add(fromAverageValue)
                .add(toAverageValue);

            let fromTotal = 0;
            let fromDiscountedTotal = 0;
            let toTotal = 0;
            let toDiscountedTotal = 0;
            let currency = null;
            const steamIds = gameOffers
                .map((go) => go.steamId)
                .filter((steamId) => steamId !== null);
            Steam.getPricesFor(steamIds, (priceResult, gamePrices) => {
                if (!priceResult) {
                    console.error('Error fetching game prices from Steam');
                    allValues.html('Fetching prices failed!').css('color', 'red');
                } else {
                    for (const gpi in gamePrices) {
                        const gamePriceIndex = parseInt(gpi);
                        if (gamePriceIndex in gamePrices) {
                            if (!currency) {
                                currency = gamePrices[gamePriceIndex].prices.currency;
                            }

                            const gameOffer = gameOffers.find(
                                (go) => go.steamId === gamePriceIndex
                            );
                            const gamePricesInfo = gamePrices[gamePriceIndex].prices;
                            gameOffer.prices = gamePricesInfo;

                            if (gamePricesInfo.final === 0) {
                                $(gameOffer.steamStorePriceElement)
                                    .html('Free')
                                    .css('color', 'green');
                            } else if (gamePricesInfo.discount_percent === 0) {
                                $(gameOffer.steamStorePriceElement).html(
                                    format('{0} {1}', gamePricesInfo.final / 100.0, currency)
                                );
                            } else {
                                $(gameOffer.steamStorePriceElement).html(
                                    format(
                                        '{0} {1} ({2}% off)',
                                        gamePricesInfo.final / 100.0,
                                        currency,
                                        gamePricesInfo.discount_percent
                                    )
                                );
                            }

                            if (gameOffer.type === 'from') {
                                fromTotal += gamePricesInfo.initial;
                                fromDiscountedTotal += gamePricesInfo.final;
                            } else {
                                toTotal += gamePricesInfo.initial;
                                toDiscountedTotal += gamePricesInfo.final;
                            }
                        }
                    }
                }

                gameOffers
                    .filter((go) => go.steamId === null)
                    .forEach((go) => {
                        if (priceResult) {
                            $(go.steamStorePriceElement).html('N/A').css('color', 'darkgray');
                        } else {
                            $(go.steamStorePriceElement)
                                .html('Fetching prices failed!')
                                .css('color', 'red');
                        }
                    });

                fromTotalValue.html(
                    format(
                        '{0} {2} ({1} {2})',
                        (fromDiscountedTotal / 100.0).toFixed(2),
                        (fromTotal / 100.0).toFixed(2),
                        currency
                    )
                );
                fromAverageValue.html(
                    format(
                        '{0} {2} ({1} {2})',
                        (fromDiscountedTotal / games.from.length / 100.0).toFixed(2),
                        (fromTotal / games.from.length / 100.0).toFixed(2),
                        currency
                    )
                );
                toTotalValue.html(
                    format(
                        '{0} {2} ({1} {2})',
                        (toDiscountedTotal / 100.0).toFixed(2),
                        (toTotal / 100.0).toFixed(2),
                        currency
                    )
                );
                toAverageValue.html(
                    format(
                        '{0} {2} ({1} {2})',
                        (toDiscountedTotal / games.to.length / 100.0).toFixed(2),
                        (toTotal / games.to.length / 100.0).toFixed(2),
                        currency
                    )
                );
            });
        });
    }
}
