
import URLManager from './URLManager.js';
import ContentParser from './ContentParser.js';
import StoreManager from './StoreManager.js';
import { TimingCrawlTask } from '../Model/CrawlTask.js';
import { FeedObject } from '../Model/FeedObject.js';
import { devLog } from '../utils/misc.js';
import { FeedStoreModel } from '../model/FeedStoreModel';

const FS = require('fs');
const Path = require('path');

const firstTry = true;

export default class Spider {
    constructor() {
        this.URLManager = new URLManager();
        this.URLManager.start();
        this.contentParser = new ContentParser();

        this.errorURL = {};

        this.crawlTimers = {};
        this.timeOutTimes = {};

        StoreManager.instance().getAllDocs((feeds) => {
            if (Array.isArray(feeds) && feeds.length) {
                feeds.forEach((ele, index) => {
                    const timer = setTimeout((feed) => {
                        this.startTimerWithUrl(feed.id,feed.url,feed.interval,feed.updatedTime);
                        if (this.timeOutTimes[feed.url]) {
                            delete this.timeOutTimes[feed.url];
                        }
                    }, this.getTimeOutTime(Math.random() * 10), ele);
                    this.timeOutTimes[ele] = timer;
                });
            }
        });

        const appPath = Path.resolve('./');
        this.logPath = Path.join(appPath, 'log');
        try {
            FS.accessSync(this.logPath, FS.F_OK);
        } catch (err) {
            try {
                FS.mkdirSync(this.logPath);
            } catch (e) {
                throw Error('Can not Find "./log" Dir');
            }
        }
        // this.fakeCrawler();
    }

    getTimeOutTime(base) {
        if (process.env.NODE_ENV === 'production') {
            return 60 * 1000 * base * Math.random() * 2;
        } else {
            return 1000 * base;
        }
    }

    stopTimerWithUrl(url) {
        if (url) {
            const timer = this.crawlTimers[url];
            if (timer) {
                timer.stop();
                delete this.crawlTimers[url];
            }
            if (this.timeOutTimes[url]) {
                clearTimeout(this.timeOutTimes[url]);
                delete this.timeOutTimes[url];
            }
        }
    }

    startTimerWithUrl(id,url,interval,baseDate) {
        if (url && this.crawlTimers[url])
        {
            const crawlTimer = this.crawlTimers[url];
            crawlTimer.update(interval);
        }

        if (url && !this.crawlTimers[url]) {
            const timer = new TimingCrawlTask(id,url, interval, baseDate);
            this.crawlTimers[url] = timer;
            timer.start((id,crawlUrl) => {
                StoreManager.instance().getRSSSource(id,crawlUrl, (feedObj) => {
                    const currentDateTime = Date.now();
                    const gap = 1 * 24 * 60 * 60 * 1000;
                    // const gap = 30 * 1000;
                    if (feedObj && feedObj.lastVisitedDate && currentDateTime - feedObj.lastVisitedDate.getTime() > gap) {
                        StoreManager.instance().delRSSSource(feedObj.id,null, (err,feed) => {
                            if (!err && feed.url) {
                                this.stopTimerWithUrl(feed.url);
                            }
                        });
                    } else {
                        devLog('------timer--------');
                        devLog(crawlUrl);
                        const feedObject = new FeedObject();
                        feedObject.lastItemDate = feedObj.lastItemDate;
                        this.crawlUrl(crawlUrl,feedObject,(feed, error) => {
                            devLog(error);
                            if (feed) {
                                const xml = feed.generateRSSXML();
                                if (xml) {
                                    const feedModel = new FeedStoreModel();
                                    feedModel.id = feed.id;
                                    feedModel.url = crawlUrl;
                                    feedModel.title = feed.title;
                                    feedModel.xml = xml;
                                    feedModel.updatedTime = new Date();
                                    feedModel.lastItemDate = feed.lastItemDate;
                                    StoreManager.instance().setRSSSource(feedModel);
                                } else {
                                    StoreManager.instance().getRSSSource(id,crawlUrl, (feedObj) => {
                                        if (feedObj) {
                                            const feedSource = feedObj.copy();
                                            feedSource.errTime = new Date();
                                            feedSource.errMsg = 'timer crawl generateRSSXML error';
                                            StoreManager.instance().setRSSSource(feedSource);
                                        }
                                    });
                                }
                            } else {
                                StoreManager.instance().getRSSSource(id,crawlUrl, (feedObj) => {
                                    if (feedObj) {
                                        const feedSource = feedObj.copy();
                                        feedSource.errTime = new Date();
                                        if (error) {
                                            feedSource.errMsg = error;
                                        } else {
                                            feedSource.errMsg = 'unkonwn';
                                        }
                                        StoreManager.instance().setRSSSource(feedSource);
                                    }
                                });
                            }
                        });
                    }
                });
            });
        }
    }

    crawlUrl(target, prevFeed, callback) {
        const urlTasks = URLManager.urlTasksFromURL(target);
        this.crawlURLTasks(urlTasks, prevFeed, callback);
    }


    crawlURLTasks(tasks, prevFeed, callback) {
        // if (firstTry) {
        //     firstTry = false;
        //     callback(null, Error('random error'));
        //     return;
        // }

        this.URLManager.insertURLTasks(tasks, (parseTasks, error) => {
            if (error) {
                this.logWithTasks(parseTasks);
                callback(null, error);
            } else {
                if (prevFeed) {
                    parseTasks.forEach((ele)=>{
                        if (ele.feed) {
                            ele.feed = ele.feed.merge(prevFeed);
                        } else {
                            ele.feed = prevFeed;
                        }
                    });
                }
                this.contentParser.parse(parseTasks, (urlTasks, feed, err) => {
                    if (err) {
                        callback(null, err);
                    } else if (urlTasks && urlTasks.length) {
                        let mergedFeed = prevFeed;
                        if (!mergedFeed) {
                            mergedFeed = new FeedObject();
                        }
                        mergedFeed = mergedFeed.merge(feed);
                        this.crawlURLTasks(urlTasks, mergedFeed, callback);
                    } else if (feed) {
                        let mergedFeed2 = prevFeed;
                        if (!mergedFeed2) {
                            mergedFeed2 = new FeedObject();
                        }
                        mergedFeed2 = mergedFeed2.merge(feed);
                        if (mergedFeed2.items && mergedFeed2.items.size) {
                            callback(mergedFeed2, null);
                        } else {
                            callback(null, Error('no article'));
                        }
                    } else {
                        callback(prevFeed, null);
                    }
                });
            }
        });
    }

    updateCookies(host,path,cookies){
        this.URLManager.updateCookies(host,path,cookies);
    }

    logWithTasks(tasks) {
        if (Array.isArray(tasks)) {
            tasks.forEach((ele) => {
                if (ele.error) {
                    this.logError(ele.url, ele.error.message);
                }
            });
            this.dumpToFile();
        }
    }

    logError(url, reason) {
        if (!url || !reason) {
            return;
        }
        const decodeURL = decodeURIComponent(url);

        const currentDate = new Date();
        const currentDateString = currentDate.toString();

        let errorArray = this.errorURL[decodeURL];
        if (!errorArray) {
            errorArray = [];
            this.errorURL[url] = errorArray;
        }
        if (errorArray.length > 10) {
            errorArray = errorArray.slice(5);
        }
        errorArray.push(reason + currentDateString);
    }

    dumpToFile() {
        const name = 'spider_crawl_fail.log';
        const path = Path.join(this.logPath, name);
        const value = JSON.stringify(this.errorURL);
        FS.writeFile(path, value, (err) => {
            // err
        });
    }

    fakeCrawler() {
        const feedObject = new FeedObject();
        feedObject.lastItemDate = null;
        // const url = 'https://mp.weixin.qq.com/s?timestamp=1525447847&src=3&ver=1&signature=kMXr8*-y2MNXcuH*90FfeLdxEJOZZCoS6ZidNe0Z2yyGADbxyozdekGrcCLFpN-oQ1bZ2iOf3gZ9jnHvNIXtryAku1IorTpgJ*zk2hvz14XQbf094Uwmgixzf9yvAngAZ6bqtOUd3B08TKnexUiR8itIrEvCxCFTGuG8nvOBba0=';
        const url = 'https://mp.weixin.qq.com/profile?src=3&timestamp=1525446001&ver=1&signature=hQDpZ3Kj-jSImow1GKOSD9k5HYbv0VER36-NMwH5s07irTZWxIcRhPTgKLk8skE3Kg-s0SJU5tI9OFpFAEglEg==';
        this.crawlUrl(url, feedObject, (feed, err) => {
            if (feed) {
                
            }
        });
    }
}
