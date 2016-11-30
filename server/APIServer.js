

import StoreManager from './StoreManager.js';
import { funcCheck, safeJSONParse, devLog } from '../utils/misc.js';
import Spider from './Spider.js';

const Url = require('url');
const Zlib = require('zlib');
const QS = require('querystring');

export default class APIServer {
    constructor() {
        this.apiMap = {
            feed: {
                zhihu: this.getZhihuFeed,
                weixin: this.getWeixinFeed,
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
        StoreManager.instance();
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
            apiFunction(params, (response, error) => {
                devLog(response);
                let newRes;
                if (error) {
                    newRes = JSON.stringify(newRes);
                } else {
                    newRes = response;
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


    getZhihuFeed(params, callback) {
        const back = funcCheck(callback);
        let url = params.url;
        url = decodeURIComponent(url);
        if (url) {
            StoreManager.instance().getRSSXML(url, (xml) => {
                if (xml) {
                    back(xml);
                } else {
                    this.generateZhihuFeed(params, (res, error) => {
                        if (error) {
                            back(null, error);
                        } else if (res) {
                            StoreManager.instance().setRSSSource(url, res);
                            back(res, null);
                        } else {
                            back(null, Error('unknown'));
                        }
                    });
                }
            });
        } else {
            back(null, Error('bad url'));
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
                    let data = null;
                    let error = null;
                    if (err) {
                        error = Object.assign({
                            error: {
                                msg: err.message,
                            },
                        }, this.commonErrorResponse);
                    } else if (feed) {
                        data = feed.generateRSSXML();
                    }
                    back(data, error);
                });
            } else {
                back(null, this.lackErrorResponse);
            }
        } else {
            back(null, this.lackErrorResponse);
        }
    }

    getWeixinFeed(params, callback) {
        const back = funcCheck(callback);
        let url = params.url;
        url = decodeURIComponent(url);
        if (url) {
            StoreManager.instance().getRSSXML(url, (xml) => {
                if (xml) {
                    back(xml);
                } else {
                    this.generateWeixinFeed(params, (res, error) => {
                        if (error) {
                            back(null, error);
                        } else if (res) {
                            StoreManager.instance().setRSSSource(url, res);
                            back(res, null);
                        } else {
                            back(null, Error('unknown'));
                        }
                    });
                }
            });
        } else {
            back(null, Error('bad url'));
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
                let error = null;
                if (err) {
                    error = generateErrorData(err);
                } else {
                    data = feedObject.generateRSSXML();
                    if (!data) {
                        error = generateErrorData(err);
                    }
                }
                back(data, error);
            });
        }
    }
}
