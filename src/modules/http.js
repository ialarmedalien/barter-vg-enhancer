const APPLICATION_JSON = 'application/json';
const JSON_PROTECTION_PREFIX = /^\)\]\}',?\n/;
const JSON_START = /^\[|^\{(?!\{)/;
const JSON_ENDS = {
    '[': /]$/,
    '{': /}$/,
};

function isJsonLike(str) {
    const jsonStart = str.match(JSON_START);
    return jsonStart && JSON_ENDS[jsonStart[0]].test(str);
}

function isString(value) {
    return typeof value === 'string';
}

function fromJson(json) {
    return isString(json) ? JSON.parse(json) : json;
}

function getHeaderFunction(headers) {
    const keyedHeaders = {};
    headers.forEach((value) => {
        const splitValue = value.trim().split(':', 2);
        if (splitValue.length < 2) {
            return;
        }
        keyedHeaders[splitValue[0].trim()] = splitValue[1].trim();
    });
    return function (key) {
        return keyedHeaders[key] || null;
    };
}

function defaultHttpResponseTransform(data, headers) {
    if (!isString(data)) {
        return data;
    }
    const tempData = data.replace(JSON_PROTECTION_PREFIX, '').trim();
    if (!tempData) {
        return data;
    }
    const contentType = headers('Content-Type');
    if ((contentType && contentType.indexOf(APPLICATION_JSON) === 0) || isJsonLike(tempData)) {
        data = fromJson(tempData);
    }
    return data;
}

export default class Http {
    static getPromise(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                onload: function (gmResponse) {
                    const headers = getHeaderFunction(gmResponse.responseHeaders.split('\n'));
                    const responseData = defaultHttpResponseTransform(gmResponse.response, headers);
                    const response = {
                        data: responseData,
                        status: gmResponse.status,
                        headers: headers,
                        statusText: gmResponse.statusText,
                    };
                    resolve(response);
                },
                onerror: function (error) {
                    reject(error);
                },
            });
        });
    }
}
