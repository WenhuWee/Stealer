
import * as utils from '../utils/misc.js';
import { ParseTask, URLTask } from '../Model/CrawlTask.js';
import { FeedObject, FeedItemObject } from '../Model/FeedObject.js';

import ChuangsongHandler from './ContentHandler/ChuangsongHandler.js';
import ZhihuHandler from './ContentHandler/ZhihuHandler.js';
import SogouWeixinHandler from './ContentHandler/SogouWeixinHandler.js';

const Async = require('async');
const Cheerio = require('cheerio');
const QS = require('querystring');
const Url = require('url');

export default class ContentParser {
    constructor() {
        const chuangsongHandler = new ChuangsongHandler();
        const zhihuHandler = new ZhihuHandler();
        const weixinHandler = new SogouWeixinHandler();

        this.parserDistributor = {
            'zhuanlan.zhihu.com': zhihuHandler,
            'weixin.sogou.com': weixinHandler,
            'mp.weixin.qq.com': weixinHandler,
            'chuansong.me': chuangsongHandler,
        };
    }

    urlTasksFromURL(url){
        let tasks = [];
        const urlObject = Url.parse(task.url);
        const host = urlObject.host;
        const path = urlObject.pathname;
        const handler = this.parserDistributor[host];
        if (handler) {
            tasks = handler.urlTasksFromURL(url);
        }
        return tasks;
    }

    parse(tasks, callback) {
        if (Array.isArray(tasks)) {
            const funtions = [];
            let newURLTasks = [];
            let feed = new FeedObject();
            tasks.forEach((task) => {
                funtions.push((funBack) => {
                    const urlObject = Url.parse(task.url);
                    const host = urlObject.host;
                    const path = urlObject.pathname;
                    const handler = this.parserDistributor[host];
                    if (handler instanceof ContentHandler) {
                        handler.parserTask(task, (newTasks, parseTask, err) => {
                            if (newTasks.length) {
                                newURLTasks = newURLTasks.concat(newTasks);
                            }
                            if (parseTask instanceof ParseTask) {
                                feed = feed.merge(parseTask.feed);
                            }
                            funBack(null, newTasks);
                        });
                    }
                });
            });
            Async.parallel(funtions, (err) => {
                callback(newURLTasks, feed, err);
            });
        } else {
            callback([], null);
        }
    }
}
