
import URLManager from './URLManager.js';
import ContentParser from './ContentParser.js';
import StoreManager from './StoreManager.js';
import { TimingCrawlTask } from '../Model/CrawlTask.js';
import { FeedObject } from '../Model/FeedObject.js';

const Url = require('url');
const FS = require('fs');
const Path = require('path');

export default class Spider {
    constructor() {
        this.URLManager = new URLManager();
        this.URLManager.start();
        this.contentParser = new ContentParser();

        this.errorURL = {};

        this.crawlTimers = {};

        StoreManager.instance().getAllURL((urls) => {
            if (Array.isArray(urls) && urls.length) {
                urls.forEach((ele, index) => {
                    setTimeout((url) => {
                        this.startTimerWithUrl(url);
                    }, 2 * 1000 * index, ele);
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
    }

    startTimerWithUrl(url) {
        if (url && !this.crawlTimers[url]) {
            const timer = new TimingCrawlTask(url, 8);
            this.crawlTimers[url] = timer;
            timer.start((crawlUrl) => {
                this.crawlUrl(crawlUrl, (feed) => {
                    if (feed) {
                        const xml = feed.generateRSSXML();
                        if (xml) {
                            StoreManager.instance().setRSSSource(crawlUrl, xml);
                        }
                    }
                });
            });
        }
    }

    crawlUrl(target, callback) {
        const urlTasks = URLManager.urlTasksFromURL(target);
        this.crawlURLTasks(urlTasks, callback);
    }

    crawlURLTasks(tasks, callback, prevFeed = null) {
        this.URLManager.insertURLTasks(tasks, (parseTasks, error) => {
            if (error) {
                this.logWithTasks(parseTasks);
                callback(null, error);
            } else {
                this.contentParser.parse(parseTasks, (urlTasks, feed, err) => {
                    if (err) {
                        callback(null, err);
                    } else if (urlTasks && urlTasks.length) {
                        let mergedFeed = prevFeed;
                        if (!mergedFeed) {
                            mergedFeed = new FeedObject();
                        }
                        mergedFeed = mergedFeed.merge(feed);
                        this.crawlURLTasks(urlTasks, callback, mergedFeed);
                    } else if (feed) {
                        let mergedFeed2 = prevFeed;
                        if (!mergedFeed2) {
                            mergedFeed2 = new FeedObject();
                        }
                        mergedFeed2 = mergedFeed2.merge(feed);
                        if (mergedFeed2.items && mergedFeed2.items.size) {
                            callback(mergedFeed2, null);
                        } else {
                            callback(null, Error('Unkonw'));
                        }
                    } else {
                        callback(prevFeed, null);
                    }
                });
            }
        });
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
        this.URLManager.insertURL('https://zhuanlan.zhihu.com/spatialeconomics', null, this.contentHanlder.bind(this));
    }

    contentHanlder(tasks, error) {
        if (error) {
            // utils.devLog(error);
        } else {
            this.contentParser.parse(tasks, () => {});
        }
    }
}
