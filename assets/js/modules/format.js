export default function (string) {
    

    const args = Array.prototype.slice.call(arguments, 1);
    return string.replace(/{(\d+)}/g, (match, number) => {
        return typeof args[number] !== 'undefined' ? args[number] : match;
    });
}
