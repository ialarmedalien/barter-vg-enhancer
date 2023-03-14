import { objectToString } from './util.js';

export default class Ratios {
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
