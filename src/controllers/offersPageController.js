import { Route } from '../modules/router';
import Http from '../modules/http';
import Ratios from '../modules/ratios';
import { calculateGameStats } from '../modules/stats';
import format from '../modules/format';
import SteamClient from '../modules/steam';
import variables from '../modules/templates';
import ItadClient from '../modules/itad';
import parseHTML from '../modules/util';
import getBarterStoreIcon from '../modules/shops';

function getGamesTradeSummaryHtml(gameStats, idPrefix) {
    const tradeSummary = format(variables.html.tradeSummary, {
        1: gameStats.gamesInBundles,
        4: gameStats.averageReviewScore,
        5: gameStats.averageWeightedReviewScore,
        6: gameStats.ratios.index,
        8: gameStats.totalBundles,
        9: gameStats.ratios.real,
        10: gameStats.voteCount,
        11: (Math.log(gameStats.voteCount) / Math.log(2)).toFixed(2),
        12: idPrefix,
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
    for (const type of ['from', 'to']) {
        gameStats[type] = calculateGameStats(gameType[type]);
    }

    const fromTradeSummary = getGamesTradeSummaryHtml(gameStats.from, 'offered');
    tradables[0].appendChild(parseHTML(fromTradeSummary)[0]);

    const toTradeSummary = getGamesTradeSummaryHtml(gameStats.to, 'requested');
    tradables[1].prepend(parseHTML(toTradeSummary)[0]);
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
                0: ratios.summary,
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

function iconImage(storeName, iconFile) {
    return `<img src="https://bartervg.com/imgs/ico/${iconFile}" alt="${storeName}" class="price-link" />`;
}

export function calculateGamePriceStats(games) {
    const stats = {
        to: {
            nGames: 0,
            steamTotal: 0,
            steamTotalOld: 0,
            itadTotal: 0,
            lowestTotal: 0,
        },
        from: {
            nGames: 0,
            steamTotal: 0,
            steamTotalOld: 0,
            itadTotal: 0,
            lowestTotal: 0,
        },
    };

    let currency;
    for (const game of Object.values(games.all)) {
        stats[game.trade_direction].nGames++;
        if ('steam_price' in game) {
            game.steamPriceEl.innerHTML = `${iconImage(
                'Steam',
                'steam.png'
            )}&nbsp;<abbr title="not available">N/A</abbr>`;
            try {
                let priceString = `<a href="https://store.steampowered.com/app/${
                    game.sku
                }/" title="${game.title} on Steam">${iconImage('Steam', 'steam.png')}&nbsp;${
                    game.steam_price.price === 0 ? 'Free' : game.steam_price.price
                }&nbsp;${game.steam_price.currency}</a>`;

                // `${game.steam_price.price} ${game.steam_price.currency}`;
                // if (game.steam_price.price === 0) {
                //     priceString = 'Free';
                //     game.steamPriceEl.setAttribute('style', 'color: green');
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
            game[
                `${type}PriceEl`
            ].innerHTML = `ITAD: <a href="https://isthereanydeal.com/game/${game.itad_id}/info/">N/A</a>`;
            try {
                const storeIcon = getBarterStoreIcon(game[`${type}_price`].shop.id);
                game[`${type}PriceEl`].innerHTML = `<a href="https://isthereanydeal.com/game/${
                    game.itad_id
                }/info/" title="Best ${type === 'itad' ? 'current' : 'historical'} price: ${game[
                    `${type}_price`
                ].price.toFixed(2)} at ${game[`${type}_price`].shop.name}">${iconImage(
                    game[`${type}_price`].shop.name,
                    storeIcon
                )}&nbsp;${game[`${type}_price`].price.toFixed(2)}&nbsp;${
                    game[`${type}_price`].currency
                }</a>`;

                // `${game[`${type}_price`].shop.name}: ` +
                // `${game[`${type}_price`].price.toFixed(2)} ${game[`${type}_price`].currency}`;
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
    stats.currency = currency;
    return stats;
}

function populateTotalStats(stats) {
    const { currency } = stats;
    const el = {
        to: {
            total: '#requested_total_steam',
            itad: '#requested_total_itad',
            average: '#requested_average_steam',
        },
        from: {
            total: '#offered_total_steam',
            itad: '#offered_total_itad',
            average: '#offered_average_steam',
        },
    };
    for (const type of ['to', 'from']) {
        document.querySelector(el[type].total).innerHTML =
            `${stats[type].steamTotal.toFixed(2)} ${currency} ` +
            `(${stats[type].steamTotalOld.toFixed(2)}  ${currency})`;

        document.querySelector(el[type].itad).innerHTML = `${stats[type].itadTotal.toFixed(
            2
        )} ${currency}`;

        document.querySelector(el[type].average).innerHTML =
            `${(stats[type].steamTotal / stats[type].nGames).toFixed(2)} ${currency} ` +
            `(${(stats[type].steamTotalOld / stats[type].nGames).toFixed(2)} ${currency})`;
    }
}

function initGameData(respData) {
    const offerData = respData;
    const games = {
        to: [],
        from: [],
        all: {},
    };
    for (const type of ['to', 'from']) {
        for (const game of Object.values(offerData.items[type])) {
            game.platform_id = game.platform;
            game.trade_direction = type;
            games.all[game.item_id] = game;
            games[type].push(game.item_id);
        }
    }
    return games;
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

    async index() {
        const response = await Http.getPromise(`${window.location.href}json`);
        if (response.status !== 200) {
            throw new Error('Oh shit!');
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
