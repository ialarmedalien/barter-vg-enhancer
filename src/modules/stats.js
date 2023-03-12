import Ratios from './ratios.js';

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
export function calculateGameStats(gameList) {
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
            game.steamPriceEl.innerHTML = 'Not available';
            try {
                stats[game.trade_direction].steamTotal += game.steam_price.price;
                stats[game.trade_direction].steamTotalOld += game.steam_price.price_old;
                let priceString = `${game.steam_price.price} ${game.steam_price.currency}`;
                if (!currency) {
                    currency = game.steam_price.currency;
                }
                if (game.steam_price.price === 0) {
                    priceString = 'Free';
                    $(game.steamPriceEl).css('color', 'green');
                } else if (game.steam_price.cut !== 0) {
                    priceString += ` (${game.steam_price.cut}% off)`;
                }
                game.steamPriceEl.innerHTML = priceString;
            } catch (e) {
                // eslint-disable-next-line no-console
                console.log({ item_id: game.item_id, ...game[`steam_price`] });
            }
        }

        for (const type of ['itad', 'lowest']) {
            game[`${type}PriceEl`].innerHTML = 'Not available';
            try {
                game[`${type}PriceEl`].innerHTML =
                    `${game[`${type}_price`].shop.name}: ` +
                    `${game[`${type}_price`].price.toFixed(2)} ${game[`${type}_price`].currency}`;
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
