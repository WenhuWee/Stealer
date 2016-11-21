/* eslint max-len: 0, no-param-reassign: 0 */

export function createConstants(...constants) {
    return constants.reduce((acc, constant) => {
        acc[constant] = constant;
        return acc;
    }, {});
}

export function createReducer(initialState, reducerMap) {
    return (state = initialState, action) => {
        const reducer = reducerMap[action.type];


        return reducer
            ? reducer(state, action.payload)
            : state;
    };
}

export function safeJSONParse(json) {
    let parsed = null;
    try {
        parsed = JSON.parse(json);
    } catch (e) {
        // utils.devLog(e);
    }
    return parsed;
}

export function funcCheck(func) {
    let back = func;
    if (typeof back !== 'function') {
        back = () => {};
    }
    return back;
}


export function parseJSON(response) {
    return response.data;
}

export function purePath(path) {
    let value = path;
    for (let i = 0; i < path.length; i++) {
        const char = path.charAt(i);
        if (char === '?') {
            value = path.substring(0, i);
            break;
        }
    }
    return value;
}

export function queryObjectFromPath(path) {
    const params = {};
    let startIndex;
    let key = null;
    for (let i = 0; i < path.length; i++) {
        const char = path.charAt(i);
        if (char === '?') {
            startIndex = i + 1;
        } else if (char === '=') {
            key = path.substring(startIndex, i);
            startIndex = i + 1;
        } else if (char === '&') {
            const value = path.substring(startIndex, i);
            params[key] = value;
            key = null;
            startIndex = i + 1;
        } else if (i === path.length - 1) {
            if (key) {
                const value = path.substring(startIndex);
                params[key] = value;
            }
        }
    }
    return params;
}

export function validatePath(path) {
    const re = /^(\/(([a-z]+)+))+(\?([a-z]+=[a-z0-9]+)(&([a-z]+=[a-z0-9]+))*)*$/;
    return re.test(path);
}

export function validateEmail(email) {
    const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email);
}

export function devLog(...params) {
    if (process.env.NODE_ENV !== 'production') {
        console.log(...params);
    }
}
