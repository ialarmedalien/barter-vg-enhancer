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

function iconImage(storeName, iconFile) {
    return `<img src="https://bartervg.com/imgs/ico/${iconFile}" alt="${storeName}" class="price-link" />`;
}

export function calculateGamePriceStats(games) {
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
                    }">${iconImage(game[`${type}_price`].shop.name, storeIcon)}&nbsp;${game[
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

export default class OffersPageController {
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
