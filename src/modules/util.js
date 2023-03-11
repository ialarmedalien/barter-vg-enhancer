export default function parseHTML(str) {
    const tmp = document.implementation.createHTMLDocument('');
    tmp.body.innerHTML = str;
    return [...tmp.body.childNodes];
}

export function objectToString(obj) {
    const type = Object.prototype.toString.call(obj);
    return type.substring(8, type.length - 1);
}
