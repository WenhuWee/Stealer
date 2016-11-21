

import * as netUtils from './netUtils.js';

// export const CRAWL_WIKI = 'CRAWL_WIKI';
// export const CRAWL_WIKI_SUCCESS = 'CRAWL_WIKI_SUCCESS';
// export const CRAWL_WIKI_ERROR = 'CRAWL_WIKI_ERROR';
//

// export function crawlWiki(url:string) {
//     return (dispatch) => {
//         dispatch({
//             type: CRAWL_WIKI,
//         });
//         return netUtils.crawlWiki({ url }).then((response) => {
//             dispatch({
//                 type: CRAWL_WIKI_SUCCESS,
//                 payload: {
//                     data: response.data,
//                 },
//             });
//         }).catch((error) => {
//             dispatch({
//                 type: CRAWL_WIKI_ERROR,
//                 payload: {
//                     error,
//                 },
//             });
//         });
//     };
// }
