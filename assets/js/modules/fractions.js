import $ from 'jquery';

function realToFraction(value, error) {
    

    if (error <= 0.0 || error >= 1.0) {
        throw 'Must be between 0 and 1 (exclusive).';
    }

    const sign = Math.sign(value);
    if (sign === -1) {
        value = Math.abs(value);
    }

    if (sign !== 0) {
        error *= value;
    }

    const n = Math.trunc(value);
    value -= n;

    if (value < error) {
        return {
            n: sign * n,
            d: 1,
        };
    }

    if (1 - error < value) {
        return {
            n: sign * (n + 1),
            d: 1,
        };
    }

    let lowerN = 0;
    let lowerD = 1;

    let upperN = 1;
    let upperD = 1;

    while (true) {
        const middleN = lowerN + upperN;
        const middleD = lowerD + upperD;

        if (middleD * (value + error) < middleN) {
            upperN = middleN;
            upperD = middleD;
        } else if (middleN < (value - error) * middleD) {
            lowerN = middleN;
            lowerD = middleD;
        } else {
            return {
                n: (n * middleD + middleN) * sign,
                d: middleD,
            };
        }
    }
}

function getApproximateSmallestFraction(fraction) {
    

    while (fraction.n >= 10 && fraction.d >= 10) {
        fraction.n = Math.round(fraction.n / 10.0);
        fraction.d = Math.round(fraction.d / 10.0);
    }
    return fraction;
}

export default class Fractions {
    static getFractions(ratio) {
        const realFraction = realToFraction(ratio, 0.000001);
        const smallFraction = getApproximateSmallestFraction($.extend({}, realFraction));
        const smallestFraction = { n: 1, d: Math.trunc(smallFraction.d / smallFraction.n) };
        const digits = Math.trunc(Math.log10(smallestFraction.d));
        let rounded;
        if (digits > 1) {
            rounded = Math.round(smallestFraction.d / Math.pow(10, digits)) * Math.pow(10, digits);
        } else {
            rounded = Math.round(smallestFraction.d / 10) * 10;
            if (rounded === 0) {
                rounded = 1;
            }
        }
        const roundedFraction = { n: 1, d: rounded };

        return {
            real: realFraction,
            small: smallFraction,
            smallest: smallestFraction,
            rounded: roundedFraction,
        };
    }
}
