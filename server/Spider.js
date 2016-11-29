
import URLManager from './URLManager.js';
import ContentParser from './ContentParser.js';
import { URLTask, ParseTask } from '../Model/CrawlTask.js';
import { FeedObject, FeedItemObject } from '../Model/FeedObject.js';

const Url = require('url');
const FS = require('fs');
const Path = require('path');

export default class Spider {
    constructor() {
        this.URLManager = new URLManager();
        this.URLManager.start();
        this.contentParser = new ContentParser();

        this.errorURL = {};

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

    crawlUrl(target, callback) {
        const urlTasks = this.URLManager.urlTasksFromURL(target);
        this.crawlURLTasks(urlTasks, callback);
    }

    crawlURLTasks(tasks, callback, prevFeed = null) {
        this.URLManager.insertURLTasks(tasks, (parseTasks, error) => {
            if (error) {
                callback(null, error);
            } else {
                this.contentParser.parse(parseTasks, (urlTasks, feed, err) => {
                    if (err) {
                        callback(null, err);
                    } else if (urlTasks && urlTasks.length) {
                        this.crawlURLTasks(urlTasks, callback, prevFeed);
                    } else if (feed) {
                        let newFeed = prevFeed;
                        if (!newFeed) {
                            newFeed = new FeedObject();
                        }
                        newFeed = newFeed.merge(feed);
                        callback(newFeed, null);
                    } else {
                        callback(prevFeed, null);
                    }
                });
            }
        });
    }

    logErrorURL(url) {
        const decodeURL = decodeURIComponent(url);
        const urlObject = Url.parse(decodeURL);
        if (urlObject && urlObject.host) {
            const hostObject = this.errorURL[urlObject.host];
            if (hostObject) {
                const errorCount = hostObject[decodeURL];
                if (typeof errorCount === 'number') {
                    hostObject[decodeURL] = errorCount + 1;
                } else {
                    hostObject[decodeURL] = 1;
                }
            } else {
                const host = {};
                host[decodeURL] = 1;
                this.errorURL[urlObject.host] = host;
            }
            console.log(this.errorURL);
            const name = 'spider_crawl_fail.log';
            const path = Path.join(this.logPath, name);
            const value = JSON.stringify(this.errorURL);
            FS.writeFile(path, value, (err) => {
                // err
            });
        }
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
