import { objectToString } from './util.js';

export default class Ratios {
    static getTradeRatios(gameData) {
        if (
            objectToString(gameData) !== 'Object' ||
            !('tradable' in gameData) ||
            !('wishlist' in gameData) ||
            objectToString(gameData.tradable) !== 'Number' ||
            objectToString(gameData.wishlist) !== 'Number' ||
            gameData.tradable < 0 ||
            gameData.wishlist < 0
        ) {
            console.error('Invalid input to getTradeRatios:');
            console.error(gameData);
            return null;
        }

        const ratioTradableToWishlist = gameData.tradable / gameData.wishlist;
        return {
            real: `${gameData.tradable} : ${gameData.wishlist}`,
            index: (gameData.wishlist / gameData.tradable).toFixed(1),
            summary: `${ratioTradableToWishlist.toFixed(1)} : 1 (${gameData.tradable} : ${
                gameData.wishlist
            })`,
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
