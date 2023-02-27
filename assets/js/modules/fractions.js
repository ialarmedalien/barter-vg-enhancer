export default class Fractions {
    static getTradeRatios(have, want) {
        let fraction;
        if (have === want) {
            fraction = { h: 1, w: 1 };
        } else if (have > want) {
            fraction = { h: have / want, w: 1 };
        } else {
            fraction = { w: want / have, h: 1 };
        }

        return {
            real: `${have} : ${want}`,
            summary: `${fraction.h.toFixed(1)} : ${fraction.w.toFixed(1)} (${have} : ${want})`,
            rounded: `${fraction.h.toFixed(1)} : ${fraction.w.toFixed(1)}`,
        };
    }
}
