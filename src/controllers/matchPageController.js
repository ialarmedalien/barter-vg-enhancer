import Http from '../modules/http.js';
import { Route } from '../modules/router.js';
import Ratios from '../modules/ratios.js';
import ItadClient from '../modules/itad.js';
import SteamClient from '../modules/steam.js';
import format from '../modules/format.js';
import parseHTML from '../modules/util.js';
import getBarterStoreIcon from '../modules/shops.js';
const GAME_LINK = /https:\/\/barter.vg\/i\/(\d+)\//;
const BUNDLE_SYMBOL = '&#x26C1;';

function generatePriceRatioElements(game) {
    const linkTemplate =
        `<div class="game-details">` +
        `<span class="ratio" title="Game tradability index">{1}</span>` +
        `<span class="bundled" title="how many times the game has been bundled">{2}</span></div>` +
        `<div class="price-details"><span class="steam_price"></span>` +
        `<span class="itad_price"></span>` +
        `<span class="lowest_price"></span>` +
        `</div>`;

    // does it have the ratios calculated?
    if (!('ratios' in game)) {
        game.ratios = Ratios.getTradeRatios(game);
    }

    const templateData = {
        1: game.ratios.index,
        2: `${game.bundles_all}${BUNDLE_SYMBOL}`,
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
            }/" title="${game.title} on Steam">${iconImage('Steam', 'steam.png')}&nbsp;${
                game.steam_price.price
            }</a>`;
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
                }/info/" title="Best current price: ${game.itad_price.price.toFixed(2)} at ${
                    game.itad_price.shop.name
                }">${iconImage(
                    game.itad_price.shop.name,
                    storeIcon
                )}&nbsp;${game.itad_price.price.toFixed(2)}</a>`;
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
                }/info/" title="Best historical price: ${game.lowest_price.price.toFixed(2)} at ${
                    game.lowest_price.shop.name
                }">${iconImage(
                    game.lowest_price.shop.name,
                    storeIcon
                )}&nbsp;${game.lowest_price.price.toFixed(2)}</a>`;
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
                const smt = el.querySelector('.showMoreToggle');
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

export class MatchPage {
    ready() {
        if (document.readyState !== 'loading') {
            MatchPage.getData();
        } else {
            document.addEventListener('DOMContentLoaded', MatchPage.getData);
        }
    }
    static async getData() {
        // ensure it's a page with a mutual match section
        if (document.querySelector('#mutualmatches') === null) {
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
                // https://barter.vg/u/<user_id>/[wt]/m/??
                /^https:\/\/barter\.vg\/u\/.+\/[wt]\/m\/\??$/,
                this,
                this.prototype.ready,
                null
            ),
        ];
    }
}
