
import * as utils from '../utils/misc.js';
import { ParseTask, URLTask } from '../Model/CrawlTask.js';
import { FeedObject, FeedItemObject } from '../Model/FeedObject.js';
import URLManager from './URLManager.js';

const Async = require('async');
const Cheerio = require('cheerio');
const QS = require('querystring');
const Url = require('url');

export default class ContentParser {
    constructor() {
        this.parserDistributor = {
            'zhuanlan.zhihu.com': {
                '/': this.parseZhihuZhuanlan,
            },
            'weixin.sogou.com': {
                '/weixin': this.parseSougouWeixin,
            },
            'mp.weixin.qq.com': {
                '/profile': this.parseWeixinProfile,
                '/s': this.parseWeixinArticle,
            },
        };
    }

    distibuteParser(host, path) {
        let parser = null;
        const parserSet = this.parserDistributor[host];
        if (parserSet) {
            parser = parserSet[path];
            if (!parser) {
                parser = parserSet['/'];
            }
        }
        if (!parser) {
            parser = (task, callback) => { callback(null); };
        }
        return parser;
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
                    const parser = this.distibuteParser(host, path);
                    parser(task, (newTasks, parseTask, err) => {
                        if (newTasks.length) {
                            newURLTasks = newURLTasks.concat(newTasks);
                        }
                        if (parseTask instanceof ParseTask) {
                            feed = feed.merge(parseTask.feed);
                        }
                        funBack(null, newTasks);
                    });
                });
            });
            Async.parallel(funtions, (err) => {
                callback(newURLTasks, feed, err);
            });
        } else {
            callback([], null);
        }
    }

    parseZhihuZhuanlan(task, callback) {
        const parseTask = new ParseTask();
        parseTask.url = task.url;
        parseTask.type = task.type;
        const res = utils.safeJSONParse(task.content);
        if (parseTask.type === 'content') {
            if (Array.isArray(res)) {
                res.forEach((ele) => {
                    if (typeof (ele.content) === 'string') {
                        const $ = Cheerio.load(ele.content, {
                            normalizeWhitespace: true,
                        });
                        $('img').each((index, img) => {
                            let src = $(img).attr('src');
                            const urlObject = Url.parse(src);
                            if (!urlObject.host) {
                                src = `http://pic3.zhimg.com/${src}_b.jpg`;
                                $(img).attr('src', src);
                            }
                        });
                        ele.content = $.html();
                    }
                });

                parseTask.feed = new FeedObject();

                let feedUpdatedTime = new Date();
                res.forEach((ele, index) => {
                    if (index === 0) {
                        feedUpdatedTime = new Date(ele.publishedTime);
                    }
                    const item = new FeedItemObject();
                    item.title = ele.title;
                    item.id = `https://zhuanlan.zhihu.com${ele.url}`;
                    item.link = `https://zhuanlan.zhihu.com${ele.url}`;
                    item.date = new Date(ele.publishedTime);
                    item.content = ele.content;
                    item.authorName = ele.author.name;
                    item.authorLink = ele.author.profileUrl;

                    parseTask.feed.addItem(item);
                });
                parseTask.feed.updated = feedUpdatedTime;
            }
        } else if (parseTask.type === 'author') {
            const feed = new FeedObject();
            feed.title = `知乎专栏 - ${res.name}`;
            feed.description = res.description;
            feed.id = `https://zhuanlan.zhihu.com${res.url}`;
            feed.link = `https://zhuanlan.zhihu.com${res.url}`;
            parseTask.feed = feed;
        }
        parseTask.content = res;
        callback([], parseTask, null);
    }

    parseSougouWeixin(task, callback) {
        const $ = Cheerio.load(task.content, {
            normalizeWhitespace: true,
        });
        const firstItem = $('#sogou_vr_11002301_box_0');
        const aTag = firstItem.find('.gzh-box2 .img-box a');
        const url = aTag.attr('href');

        const nameTag = firstItem.find('.gzh-box2 .txt-box a');
        const name = nameTag.text();
        const description = firstItem.find('dl dd').first().text();
        let id = '';

        const taskUrlObject = Url.parse(task.url);
        if (taskUrlObject) {
            const params = QS.parse(taskUrlObject.query);
            id = params.query;
        }

        const urlTasks = URLManager.urlTasksFromURL(url);

        const parseTask = task.copy();
        parseTask.feed = new FeedObject();
        parseTask.feed.title = `公众号 - ${name}`;
        parseTask.feed.description = description;
        parseTask.feed.id = id;

        callback(urlTasks, parseTask, null);
    }

    parseWeixinArticle(task, callback) {
        const $ = Cheerio.load(task.content, {
            normalizeWhitespace: true,
        });
        const content = $('#img-content .rich_media_content');
        content.find('img').each((index, img) => {
            const src = $(img).attr('data-src');
            $(img).attr('src', src);
        });

        const parseTask = task.copy();
        parseTask.feed = new FeedObject();
        const item = new FeedItemObject();
        item.content = content.html();
        item.id = task.url;
        parseTask.feed.addItem(item);
        callback([], parseTask, null);
    }

    parseWeixinProfile(task, callback) {
        const $ = Cheerio.load(task.content, {
            normalizeWhitespace: true,
        });
        const script = $('script').filter(function (i, el) {
            const text = $(this).text();
            return text.indexOf('var biz') !== -1;
        });

        const parseTask = task.copy();
        parseTask.feed = new FeedObject();
        parseTask.feed.link = task.url;
        let urlTasks = [];

        if (script) {
            const text = script.text();
            if (text) {
                const startString = 'var msgList';
                const endString = '};';
                const msgListStartIndex = text.indexOf(startString) + startString.length + 2;
                const msgListEndIndex = text.indexOf(endString) + 1;
                if (msgListStartIndex !== -1 && msgListEndIndex !== -1) {
                    const msgs = text.substring(msgListStartIndex, msgListEndIndex);
                    if (msgs) {
                        const obj = utils.safeJSONParse(msgs);
                        const msgList = obj.list;
                        if (Array.isArray(msgList)) {
                            msgList.forEach((ele) => {
                                const feedItem = new FeedItemObject();
                                feedItem.authorName = ele.app_msg_ext_info.author;
                                feedItem.title = ele.app_msg_ext_info.title;
                                feedItem.date = new Date(ele.comm_msg_info.datetime);
                                if (ele.app_msg_ext_info.content_url) {
                                    const decodeURL = ele.app_msg_ext_info.content_url.replace(/&amp;/g, '&');
                                    const msgurl = `http://mp.weixin.qq.com${decodeURL}`;
                                    const urlTask = URLManager.urlTasksFromURL(msgurl);
                                    urlTasks = urlTasks.concat(urlTask);

                                    feedItem.link = msgurl;
                                    feedItem.id = msgurl;
                                }
                                parseTask.feed.addItem(feedItem);
                            });
                        }
                    }
                }
            }
        }
        callback(urlTasks, parseTask, null);
    }
}
