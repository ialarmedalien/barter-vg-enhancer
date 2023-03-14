import Http from '../modules/http.js';
import { Route } from '../modules/router.js';
import ItadClient from '../modules/itad.js';
import SteamClient from '../modules/steam.js';
import { addPriceElements, addPriceData } from '../modules/dom.js';
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

export class MatchPage {
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
