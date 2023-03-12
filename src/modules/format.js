export default function format(string, argsObject) {
    return string.replace(/{(\d+)}/g, (match, number) => {
        return typeof argsObject[number] !== 'undefined' ? argsObject[number] : match;
    });
}

export function makeProjectedPlain(string) {
    return string
        .toLowerCase()
        .replace('&amp;', ' and ')
        .replace(/&[a-z]+;/g, '')
        .replace(/([1-9])/g, ($1) => {
            const n = Number($1);
            switch (n) {
                case 1:
                    return 'i';
                case 5:
                    return 'v';
                case 4:
                    return 'iv';
                case 9:
                    return 'ix';
                case (6, 7, 8):
                    return `v${'i'.repeat(n - 5)}`;
                case (2, 3):
                    return `${'i'.repeat(n)}`;
            }
        })
        .replace(/(^| )the /g, ' ')
        .replace(/[^a-z0-9]+/g, '');
}
