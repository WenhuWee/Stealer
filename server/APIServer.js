

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
                chuansong: this.getChuansongFeed,
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
            const crawlTimer = this.spider.crawlTimers[key];
            timer.url = crawlTimer.url;
            const time = crawlTimer.interval / (1000 * 60);
            timer.interval = `${time.toFixed(1)}min`;
            timer.next = crawlTimer.nextTiming.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' });
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

    getFeed(url, callback) {
        if (typeof callback !== 'function') {
            return;
        }
        if (!url) {
            callback(this.lackErrorResponse);
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

                this.generateFeed(url, (res, error) => {
                    if (res) {
                        callback({ xml: res });
                    } else {
                        callback(error);
                    }
                });
            } else {
                // error
                callback(this.commonErrorWithMsg('too frequent!'));
            }
        });
    }

    getChuansongFeed(params, callback) {
        const back = funcCheck(callback);
        const name = params.name;
        const isForced = params.forced;
        if (name) {
            const url = `http://chuansong.me/search?q=${name}`;
            if (isForced) {
                this.generateFeed(url, (res, error) => {
                    if (res) {
                        callback({ xml: res });
                    } else {
                        callback(error);
                    }
                });
            } else {
                this.getFeed(url, back);
            }
        } else {
            back(this.commonErrorWithMsg('bad url'));
        }
    }

    getZhihuFeed(params, callback) {
        const back = funcCheck(callback);
        const name = params.name;
        const isForced = params.forced;
        if (name) {
            const url = `https://zhuanlan.zhihu.com/${name}`;
            if (isForced) {
                this.generateFeed(url, (res, error) => {
                    if (res) {
                        callback({ xml: res });
                    } else {
                        callback(error);
                    }
                });
            } else {
                this.getFeed(url, back);
            }
        } else {
            back(this.commonErrorWithMsg('bad name'));
        }
    }

    getWeixinFeed(params, callback) {
        const back = funcCheck(callback);
        const name = params.name;
        const isForced = params.forced;
        if (name) {
            const url = `http://weixin.sogou.com/weixin?type=1&query=${name}`;
            if (isForced) {
                this.generateFeed(url, (res, error) => {
                    if (res) {
                        callback({ xml: res });
                    } else {
                        callback(error);
                    }
                });
            } else {
                this.getFeed(url, back);
            }
        } else {
            back(this.commonErrorWithMsg('bad url'));
        }
    }

    generateFeed(url, callback) {
        const back = funcCheck(callback);
        if (url) {
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

                const feedSource = new FeedStoreModel();
                feedSource.id = url;
                feedSource.url = url;
                if (data) {
                    devLog('From Real Time');
                    feedSource.xml = data;
                    StoreManager.instance().setRSSSource(feedSource);
                    this.spider.startTimerWithUrl(url);
                    callback(data, null);
                } else if (error) {
                    feedSource.errTime = new Date();
                    feedSource.errMsg = error.error.message;
                    StoreManager.instance().setRSSSource(feedSource);
                    devLog('insert error');
                    devLog(feedSource);
                    devLog(error);
                    callback(null, error);
                } else {
                    callback(null, this.commonErrorWithMsg('unknown'));
                }
            });
        } else {
            back(null, this.lackErrorResponse);
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
