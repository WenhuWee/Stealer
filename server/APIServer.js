

import StoreManager from './StoreManager.js';
import { funcCheck, safeJSONParse, devLog } from '../utils/misc.js';
import Spider from './Spider.js';

const Url = require('url');
const Feed = require('feed');
const Zlib = require('zlib');
const QS = require('querystring');
const Async = require('async');

export default class APIServer {
    constructor() {
        this.apiMap = {
            feed: {
                zhihu: this.generateZhihuFeed,
                weixin: this.generateWeixinFeed,
            },
        };

        this.commonErrorResponse = {
            success: false,
        };
        this.commonSuccessResponse = {
            success: true,
        };
        this.lackErrorResponse = {
            success: false,
            error: {
                msg: '缺少必要参数',
            },
        };

        this.spider = new Spider();
        // this// this.generateZhihuFeed({ url: 'https://zhuanlan.zhihu.com/spatialeconomics' }, (res) => {
        //     console.log(res);
        // });
    }

    matchAPIPattern(path:string, query:Object) {
        if (path && path.startsWith('/api/')) {
            return true;
        }
        return false;
    }

    parseBody(req) {
        const rawBody = req.body;
        let parsedBody = {};
        if (rawBody instanceof Buffer) {
            const headers = req.headers;
            const encoding = (req.headers['content-encoding'] || 'identity').toLowerCase();

            let unzipBody = rawBody;
            if (encoding === 'gzip') {
                unzipBody = Zlib.gunzipSync(rawBody);
            } else if (encoding === 'deflate') {
                unzipBody = Zlib.inflateSync();
            }

            const contentType = headers['content-type'];
            const bodyString = unzipBody.toString('utf-8');

            if (contentType.indexOf('application/x-www-form-urlencoded') >= 0) {
                parsedBody = QS.parse(bodyString);
            } else if (contentType.indexOf('application/json') >= 0) {
                parsedBody = safeJSONParse(bodyString);
                if (!parsedBody) {
                    parsedBody = {};
                }
            }
        }
        return parsedBody;
    }

    getParamas(req) {
        const method = req.method;
        let params = {};
        if (method === 'GET' || method === 'get') {
            params = Object.assign(req.query, {});
        } else if (method === 'POST' || method === 'post') {
            params = this.parseBody(req);
        }
        return params;
    }

    handleRequest(req, res) {
        const path = req.path;
        const paths = path.split('/');

        let currentAPIObject = this.apiMap;

        paths.every((route) => {
            if (route.length === 0 || route === 'api') {
                return true;
            }
            if (!{}.hasOwnProperty.call(currentAPIObject, route)) {
                return false;
            }

            currentAPIObject = currentAPIObject[route];
            devLog(currentAPIObject);
            if (!currentAPIObject) {
                return false;
            } else if (typeof (currentAPIObject) === 'object') {
                return true;
            } else if (typeof (currentAPIObject) === 'function') {
                return false;
            }
            return false;
        });

        if (typeof (currentAPIObject) === 'function') {
            const apiFunction = currentAPIObject.bind(this);
            let params = this.getParamas(req);
            if (!params) {
                params = {};
            }
            devLog(params);
            apiFunction(params, (response) => {
                devLog(response);
                let newRes = response;
                if (typeof response === 'object') {
                    newRes = JSON.stringify(newRes);
                }
                res.writeHead(200, {
                    'Content-Type': 'text/xml; charset=UTF-8',
                });
                res.end(newRes);
            });
        } else {
            res.end(JSON.stringify(this.commonErrorResponse));
        }
    }

    generateZhihuFeed(params, callback) {
        const back = funcCheck(callback);
        let url = params.url;
        url = decodeURIComponent(url);
        if (url) {
            const urlObject = Url.parse(url);
            if (urlObject.host === 'zhuanlan.zhihu.com') {
                this.spider.crawlUrl(url, (feed, err) => {
                    let data;
                    if (err) {
                        data = Object.assign({
                            error: {
                                msg: err.message,
                            },
                        }, this.commonErrorResponse);
                    } else if (feed) {
                        data = feed.generateRSSXML();
                    }
                    back(data);
                });
            } else {
                back(this.lackErrorResponse);
            }
        } else {
            back(this.lackErrorResponse);
        }
    }

    generateWeixinFeed(params, callback) {
        const back = funcCheck(callback);
        const name = params.name;
        const generateErrorData = (err) => {
            let data = {};
            if (err) {
                data = Object.assign({
                    error: {
                        msg: err.message,
                    },
                }, this.commonErrorResponse);
            }
            return data;
        };

        if (name) {
            const url = `http://weixin.sogou.com/weixin?type=1&query=${name}`;
            // sougou搜索
            this.spider.crawlUrl(url, (feedObject, err) => {
                let data = null;
                if (err) {
                    data = generateErrorData(err);
                } else {
                    data = feedObject.generateRSSXML();
                    if (!data) {
                        data = generateErrorData(err);
                    }
                }
                back(data);
            });
        }
    }
}
