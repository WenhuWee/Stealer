

import StoreManager from './StoreManager';
import { funcCheck, safeJSONParse, devLog } from '../utils/misc';
import Spider from './Spider';
import { FeedObject } from '../Model/FeedObject';
import { FeedStoreModel } from '../model/FeedStoreModel';

const Url = require('url');
const Zlib = require('zlib');
const QS = require('querystring');
const FS = require('fs');

export default class APIServer {
    constructor() {
        this.apiMap = {
            feed: {
                zhihu: this.getZhihuFeed,
                weixin: this.getWeixinFeed,
                jike: this.getJikeFeed,
                rsshub: this.getRssHub,
            },
            info: {
                status: this.getCurrentStatus,
            },
            update: {
                interval: this.updateInterval,
                cookies: this.updateCookies,
            },
            del: {
                zhihu: this.delFeed,
                weixin: this.delFeed,
                jike: this.delFeed,
            },
            verify: {
                code: this.verifyCode,
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

    matchAPIPattern(path, query) {
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
                } else if (response.html) {
                    newRes = response.html;
                    res.writeHead(200, {
                        'Content-Type': 'text/html; charset=UTF-8',
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
            timer.id = crawlTimer.id;

            if (process.env.NODE_ENV === 'production') {
                const time = crawlTimer.interval / (1000 * 60);
                timer.interval = `${time.toFixed(1)}min`;
            } else {
                const time = crawlTimer.interval / (1000);
                timer.interval = `${time.toFixed(1)}second`;
            }
            timer.next = crawlTimer.nextTiming.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' });
            timers.push(timer);
        });
        timers.sort((a, b) => {
            const aTimer = this.spider.crawlTimers[a.id];
            const bTimer = this.spider.crawlTimers[b.id];
            if (aTimer.nextTiming > bTimer.nextTiming) {
                return 1;
            } else if (aTimer.nextTiming < bTimer.nextTiming) {
                return -1;
            }
            return 0;
        });

        res.timers = timers;
        StoreManager.instance().getAllDocs((docs) => {
            if (Array.isArray(docs)) {
                docs.sort((a, b) => {
                    if (a.lastItemDate > b.lastItemDate) {
                        return -1;
                    } else if (a.lastItemDate < b.lastItemDate) {
                        return 1;
                    }
                    return 0;
                });
                res.dbDocs = [];
                docs.forEach((ele) => {
                    const doc = ele.generateStoreObjectWithoutXML();

                    if (ele.lastItemDate) {
                        doc.lastItemDate = ele.lastItemDate.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' });
                    }

                    if (ele.errTime) {
                        doc.errTime = ele.errTime.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' });
                    }
                    if (ele.lastVisitedDate) {
                        doc.lastVisitedDate = ele.lastVisitedDate.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' });
                    }
                    if (ele.updatedTime) {
                        doc.updatedTime = ele.updatedTime.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' });
                    }
                    res.dbDocs.push(doc);
                });
            }
            callback(res);
        });
    }

    getFeed(id, url, isForced, callback) {
        if (typeof callback !== 'function') {
            return;
        }
        if (!url || !id) {
            callback(this.lackErrorResponse);
        }

        let currentDate = new Date();

        StoreManager.instance().updateLastVisitedDate(id, url, currentDate);

        StoreManager.instance().getRSSSource(id, url, (feedObj) => {

            let shouldLoadFeed = isForced;
            if (!shouldLoadFeed) {
                currentDate = new Date();
                let generateInterval = 60 * 60 * 1000;
                if (process.env.NODE_ENV !== 'production') {
                    generateInterval = 10 * 1000;
                }
                shouldLoadFeed = !feedObj || (!feedObj.xml && feedObj.errTime && currentDate - feedObj.errTime > generateInterval);
            }

            if (shouldLoadFeed) {
                // generate
                this.generateFeed(id, url, feedObj, (res, error) => {
                    if (res) {
                        callback({ xml: res });
                    } else {
                        callback(error);
                    }
                });
            } else if (feedObj && feedObj.xml) {
                // from db
                devLog('From DB');
                callback({ xml: feedObj.xml });
            } else {
                // error
                callback(this.commonErrorWithMsg('too frequent!'));
            }
        });
    }

    getZhihuFeed(params, callback) {
        const back = funcCheck(callback);
        const name = params.name;
        const isForced = params.forced;
        const interval = params.interval;
        if (name) {
            const id = `zhihu_${name}`;
            const url = `https://zhuanlan.zhihu.com/${name}`;
            this.getFeed(id, url, isForced, (args) => {
                if (interval && interval > 1) {
                    this.updateInterval((id, url, interval));
                }
                back(args);
            });
        } else {
            back(this.commonErrorWithMsg('bad name'));
        }
    }

    getJikeFeed(params, callback) {
        const back = funcCheck(callback);
        const name = params.name;
        const isForced = params.forced;
        const interval = params.interval;
        if (name) {
            const id = `jike_${name}`;
            const url = `https://app.jike.ruguoapp.com/1.0/messages/showDetail?topicId=${name}`;
            this.getFeed(id, url, isForced, (args) => {
                if (interval && interval > 1) {
                    this.updateInterval((id, url, interval));
                }
                back(args);
            });
        } else {
            back(this.commonErrorWithMsg('bad name'));
        }
    }

    getWeixinFeed(params, callback) {
        const back = funcCheck(callback);
        const name = params.name;
        const isForced = params.forced;
        const interval = params.interval;
        if (name) {
            const url = `http://weixin.sogou.com/weixin?type=1&query=${name}`;
            this.getFeed(name, url, isForced, (args) => {
                if (interval && interval > 1) {
                    this.updateInterval((name, url, interval));
                }
                back(args);
            });
        } else {
            back(this.commonErrorWithMsg('bad url'));
        }
    }

    generateFeed(id, url, storeFeed, callback) {
        const back = funcCheck(callback);
        if (url && id) {
            const feedObj = new FeedObject();
            feedObj.lastItemDate = storeFeed ? storeFeed.lastItemDate : null;
            this.spider.crawlUrl(url, feedObj, (feed, err) => {
                let data = null;
                let error = null;
                if (err) {
                    error = this.commonErrorWithMsg(err.message);
                } else if (feed) {
                    if (feed.xmlContent) {
                        data = feed.xmlContent; 
                    } else {
                        data = feed.generateRSSXML();
                    }
                    if (!data) {
                        error = this.commonErrorWithMsg('generate failed');
                    }
                }

                const feedSource = new FeedStoreModel();
                feedSource.id = id;
                feedSource.url = url;
                if (data) {
                    devLog('From Real Time');
                    feedSource.title = feed.title;
                    feedSource.lastItemDate = feed.lastItemDate;
                    feedSource.xml = data;
                    feedSource.updatedTime = new Date();

                    const spider = this.spider;
                    StoreManager.instance().setRSSSource(feedSource, (setErr, newSource) => {
                        if (newSource) {
                            spider.startTimerWithUrl(id, url, newSource.interval, feedSource.updatedTime);
                        }
                    });
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

    updateInterval(params, callback) {
        const back = funcCheck(callback);
        let url = params.url;
        const id = params.id;
        const interval = params.interval;
        if (url) {
            url = decodeURIComponent(url);
        }
        if ((url || id) && interval) {
            StoreManager.instance().updateTimerInterval(id, url, interval, (err, feed) => {
                if (!err) {
                    if (feed && feed.id) {
                        this.spider.startTimerWithUrl(feed.id, feed.url, interval, null);
                    } else if (id || url) {
                        this.spider.startTimerWithUrl(id, url, interval, null);
                    }
                    callback(this.commonSuccessResponse);
                } else {
                    callback(this.commonErrorResponse);
                }
            });
        } else {
            back(this.commonErrorWithMsg('bad url'));
        }
    }

    updateCookies(params, callback) {
        let host = params.host;
        let path = params.path;
        let cookies = params.cookies;
        if (host && path && cookies) {
            this.spider.updateCookies(host, path, cookies);
            StoreManager.instance().setCookies(host, path, cookies);
            callback(this.commonSuccessResponse);
        } else {
            callback(this.commonErrorResponse);
        }
    }

// DEL
    delFeed(params, callback) {
        const back = funcCheck(callback);
        let url = params.url;
        let id = params.id;
        if (url) {
            url = decodeURIComponent(url);
        }
        if (url || id) {
            StoreManager.instance().delRSSSource(id, url, (err, feed) => {
                if (!err) {
                    this.spider.stopTimerWithUrl(id, url);
                    callback(this.commonSuccessResponse);
                } else {
                    callback(this.commonErrorResponse);
                }
            });
        } else {
            back(this.commonErrorWithMsg('bad url'));
        }
    }

// verify
    verifyCode(params, callback) {
        const back = funcCheck(callback);

        let last = params.num;
        if (!last) {
            last = 30;
        }

        FS.readdir('./captchaSample/', (err, files) => {
            const res = {};
            res.count = files.length;
            const countFiles = files.length > last ? files.slice(-last) : files;
            res.last = countFiles.map((file)=> {
                const fileObj = {};
                fileObj[file] = `http://rss.wenmino.com:8080/captchaSample/${file}`;
                return fileObj;
            });
            back(res, null);
        });
    }

    getRssHub(params, callback) {
        const back = funcCheck(callback);
        const path = params.path;
        const isForced = params.forced;
        const interval = params.interval;
        if (path) {
            const id = `rsshub_${path}`;
            const url = `http://localhost:1200/${path}`;
            this.getFeed(id, url, isForced, (args) => {
                if (interval && interval > 1) {
                    this.updateInterval((id, url, interval));
                }
                back(args);
            });
        } else {
            back(this.commonErrorWithMsg('bad path'));
        }
    }
}
