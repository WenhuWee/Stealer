

import StoreManager from './StoreManager';
import { funcCheck, safeJSONParse, devLog } from '../utils/misc';
import Spider from './Spider';
import { FeedStoreModel } from '../model/FeedStoreModel';

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
            info: {
                status: this.getCurrentStatus,
            },
            del: {
                zhihu: this.delZhihuFeed,
                weixin: this.delWeixinFeed,
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
                message: '缺少必要参数',
            },
        };

        this.spider = new Spider();
        StoreManager.instance();
        // this// this.generateZhihuFeed({ url: 'https://zhuanlan.zhihu.com/spatialeconomics' }, (res) => {
        //     console.log(res);
        // });
    }

    commonErrorWithMsg(msg) {
        return { success: false,
            error: {
                message: msg,
            } };
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
            devLog(apiFunction);
            let params = this.getParamas(req);
            if (!params) {
                params = {};
            }
            devLog(params);
            apiFunction(params, (response) => {
                let newRes = '';
                if (response.xml) {
                    newRes = response.xml;
                    res.writeHead(200, {
                        'Content-Type': 'text/xml; charset=UTF-8',
                    });
                } else {
                    devLog(response);
                    newRes = JSON.stringify(response);
                    res.writeHead(200, {
                        'Content-Type': 'application/json; charset=UTF-8',
                    });
                }
                res.end(newRes);
            });
        } else {
            res.end(JSON.stringify(this.commonErrorResponse));
        }
    }

    getCurrentStatus(params, callback) {
        const res = {};

        const timers = [];
        const keys = Object.keys(this.spider.crawlTimers);
        keys.forEach((key) => {
            const timer = {};
            timer.url = this.spider.crawlTimers[key].url;
            const time = this.spider.crawlTimers[key].interval / (1000 * 60);
            timer.interval = `${time.toFixed(1)}min`;
            timers.push(timer);
        });
        res.timers = timers;
        StoreManager.instance().getAllDocs((docs) => {
            if (Array.isArray(docs)) {
                res.dbDocs = [];
                docs.forEach((ele) => {
                    const doc = {};
                    if (ele.url) {
                        doc.url = ele.url;
                    }
                    if (ele.errMsg) {
                        doc.errMsg = ele.errMsg;
                    }
                    if (ele.errTime) {
                        doc.errTime = ele.errTime;
                    }
                    res.dbDocs.push(doc);
                });
            }
            callback(res);
        });
    }

    getFeed(url, generateFunc, callback) {
        if (typeof callback !== 'function') {
            return;
        }
        if (!url || typeof generateFunc !== 'function') {
            callback(null, null);
        }
        StoreManager.instance().getRSSSource(url, (feedObj) => {

            // TODO:有点乱，以后改吧
            const currentDate = new Date();
            let generateInterval = 60 * 15 * 1000;
            if (process.env.NODE_ENV !== 'production') {
                generateInterval = 10 * 1000;
            }
            if (feedObj && feedObj.xml) {
                // from db
                devLog('From DB');
                callback({ xml: feedObj.xml });
            } else if (!feedObj || (feedObj.errTime && currentDate - feedObj.errTime > generateInterval)) {
                // generate
                const feedSource = new FeedStoreModel();
                feedSource.id = url;
                feedSource.url = url;

                generateFunc(url, (res, error) => {
                    if (res) {
                        devLog('From Real Time');
                        feedSource.xml = res;
                        StoreManager.instance().setRSSSource(feedSource);
                        this.spider.startTimerWithUrl(url);
                        callback({ xml: res });
                    } else if (error) {
                        feedSource.errTime = new Date();
                        feedSource.errMsg = error.error.message;
                        StoreManager.instance().setRSSSource(feedSource);
                        devLog('insert error');
                        devLog(feedSource);
                        devLog(error);
                        callback(error);
                    } else {
                        callback(this.commonErrorWithMsg('unknown'));
                    }
                });
            } else {
                // error
                callback(this.commonErrorWithMsg('too frequent!'));
            }
        });
    }

    getZhihuFeed(params, callback) {
        const back = funcCheck(callback);
        let url = params.url;
        url = decodeURIComponent(url);
        if (url) {
            this.getFeed(url, this.generateZhihuFeed.bind(this), back);
        } else {
            back(this.commonErrorWithMsg('bad url'));
        }
    }

    getWeixinFeed(params, callback) {
        const back = funcCheck(callback);
        const name = params.name;
        if (name) {
            const url = `http://weixin.sogou.com/weixin?type=1&query=${name}`;
            this.getFeed(url, this.generateWeixinFeed.bind(this), back);
        } else {
            back(this.commonErrorWithMsg('bad url'));
        }
    }

    generateZhihuFeed(url, callback) {
        const back = funcCheck(callback);
        if (url) {
            const urlObject = Url.parse(url);
            if (urlObject.host === 'zhuanlan.zhihu.com') {
                this.spider.crawlUrl(url, (feed, err) => {
                    let data = null;
                    let error = null;
                    if (err) {
                        error = this.commonErrorWithMsg(err.message);
                    } else if (feed) {
                        data = feed.generateRSSXML();
                        if (!data) {
                            error = this.commonErrorWithMsg('generate failed');
                        }
                    }
                    if (error) {
                        back(error);
                    } else {
                        back(data);
                    }
                });
            } else {
                back(this.lackErrorResponse);
            }
        } else {
            back(this.lackErrorResponse);
        }
    }


    generateWeixinFeed(url, callback) {
        const back = funcCheck(callback);
        if (url) {
            // sougou搜索
            this.spider.crawlUrl(url, (feedObject, err) => {
                let data = null;
                let error = null;
                if (err) {
                    error = this.commonErrorWithMsg(err.message);
                } else {
                    data = feedObject.generateRSSXML();
                    if (!data) {
                        error = this.commonErrorWithMsg('generate failed');
                    }
                }
                if (error) {
                    back(error);
                } else {
                    back(data);
                }
            });
        }
    }

// DEL

    delZhihuFeed(params, callback) {
        const back = funcCheck(callback);
        let url = params.url;
        url = decodeURIComponent(url);
        if (url) {
            this.delFeed(url, back);
        } else {
            back(this.commonErrorWithMsg('bad url'));
        }
    }

    delWeixinFeed(params, callback) {
        const back = funcCheck(callback);
        const name = params.name;
        if (name) {
            const url = `http://weixin.sogou.com/weixin?type=1&query=${name}`;
            this.delFeed(url, back);
        } else {
            back(this.commonErrorWithMsg('bad url'));
        }
    }

    delFeed(url, callback) {
        const back = funcCheck(callback);
        if (url) {
            StoreManager.instance().delRSSSource(url, (err) => {
                if (!err) {
                    this.spider.stopTimerWithUrl(url);
                    callback(this.commonSuccessResponse);
                } else {
                    callback(this.commonErrorResponse);
                }
            });
        } else {
            back(this.commonErrorWithMsg('bad url'));
        }
    }
}
