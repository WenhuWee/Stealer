
import axios from 'axios';

function errorHandler(response) {
    let error = null;
    if (response && response.data) {
        const data = response.data;
        if ({}.hasOwnProperty.call(data, 'success') && !data.success) {
            if (data.error && data.error.msg) {
                error = Error(data.error.msg);
            } else {
                error = Error('操作失败');
            }
        }
    } else {
        error = Error('数据错误');
    }
    return error;
}

// axios.defaults.baseURL = 'http://localhost:3000';
axios.defaults.headers.common['Content-Type'] = 'application/json';

axios.interceptors.response.use((response) => {
    const error = errorHandler(response);
    if (error) {
        return Promise.reject(error);
    }
    return response;
}, (error) => Promise.reject(error)
);

export function setBaseURL(url) {
    axios.defaults.baseURL = url;
}

// export function crawlWiki(params:Object) {
//     const url = encodeURIComponent(params.url);
//     return axios.get('/api/crawl/lianjiawiki', {
//         params: {
//             ...params,
//             url,
//         },
//     });
// }
