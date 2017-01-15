
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
            'chuansong.me': {
                '/search': this.parseChuansongSearch,
                '/account': this.parseChuansongProfile,
                '/n': this.parseChuansongArticle,
            },
        };
    }

    distibuteParser(host, path) {
        let parser = null;
        let parserSet = this.parserDistributor[host];
        if (parserSet) {
            parser = parserSet[path];
            if (!parser) {
                parser = parserSet['/'];
                const paths = path.split('/');
                paths.forEach((ele, index) => {
                    if (index > 0 || parser) {
                        const temp = parserSet[`/${ele}`];
                        if (typeof temp === 'function') {
                            parser = temp;
                        }
                        if (!parser) {
                            parser = parserSet['/'];
                        }
                        parserSet = parserSet[`/${ele}`];
                    }
                });
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
                                src = `http://pic3.zhimg.com/${src}`;
                                if (!src.endsWith('png') && !src.endsWith('jpg')) {
                                    src = `${src}_b.jpg`;
                                }
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

        let urlTasks = [];
        utils.devLog(`sougou:${url}`);
        if (url) {
            urlTasks = URLManager.urlTasksFromURL(url);
        }

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
                        let msgList = null;
                        if (obj) {
                            msgList = obj.list;
                        }
                        if (Array.isArray(msgList)) {
                            msgList.forEach((ele) => {
                                const feedItem = new FeedItemObject();
                                feedItem.authorName = ele.app_msg_ext_info.author;
                                feedItem.title = ele.app_msg_ext_info.title;
                                feedItem.date = new Date(ele.comm_msg_info.datetime * 1000);

                                if (ele.app_msg_ext_info.content_url) {
                                    const decodeURL = ele.app_msg_ext_info.content_url.replace(/&amp;/g, '&');
                                    const msgurl = `http://mp.weixin.qq.com${decodeURL}`;
                                    const urlTask = URLManager.urlTasksFromURL(msgurl);
                                    urlTasks = urlTasks.concat(urlTask);

                                    feedItem.link = msgurl;
                                    feedItem.id = msgurl;
                                }
                                parseTask.feed.addItem(feedItem);

                                if (ele.app_msg_ext_info.multi_app_msg_item_list) {
                                    const multiList = ele.app_msg_ext_info.multi_app_msg_item_list;
                                    if (Array.isArray(multiList)) {
                                        multiList.forEach((multiEle) => {
                                            const multifeedItem = new FeedItemObject();
                                            multifeedItem.authorName = multiEle.author;
                                            multifeedItem.title = multiEle.title;
                                            multifeedItem.date = new Date(ele.comm_msg_info.datetime * 1000);

                                            if (multiEle.content_url) {
                                                const decodeURL = multiEle.content_url.replace(/&amp;/g, '&');
                                                const msgurl = `http://mp.weixin.qq.com${decodeURL}`;
                                                const urlTask = URLManager.urlTasksFromURL(msgurl);
                                                urlTasks = urlTasks.concat(urlTask);

                                                multifeedItem.link = msgurl;
                                                multifeedItem.id = msgurl;
                                            }
                                            parseTask.feed.addItem(multifeedItem);
                                        });
                                    }
                                }
                            });
                        }
                    }
                }
            }
        } else {
            devLog('No Script,Maybe Auth Code');
        }
        callback(urlTasks, parseTask, null);
    }

    parseChuansongSearch(task, callback) {
        const $ = Cheerio.load(task.content, {
            normalizeWhitespace: true,
        });

        const feedBody = $('.feed_body');
        const firstItem = feedBody.children().first();

        const user = firstItem.find('a[class=user]');
        const url = `http://chuansong.me${user.attr('href')}`;
        const name = user.text();

        const description = user.parent().next().text();
        let id = '';

        const taskUrlObject = Url.parse(task.url);
        if (taskUrlObject) {
            const params = QS.parse(taskUrlObject.query);
            id = params.query;
        }

        let urlTasks = [];
        utils.devLog(`chuansong:${url}`);
        if (url) {
            urlTasks = URLManager.urlTasksFromURL(url);
        }

        const parseTask = task.copy();
        parseTask.feed = new FeedObject();
        parseTask.feed.title = `公众号 - ${name}`;
        parseTask.feed.description = description;
        parseTask.feed.id = id;

        callback(urlTasks, parseTask, null);
    }

    parseChuansongProfile(task, callback) {
        const $ = Cheerio.load(task.content, {
            normalizeWhitespace: true,
        });

        const parseTask = task.copy();
        parseTask.feed = new FeedObject();
        parseTask.feed.link = task.url;
        let urlTasks = [];

        utils.devLog(`chuansong:${task.url}`);

        const feedBody = $('.feed_body');
        feedBody.children().each((i, item) => {
            if (i < 10) {
                const feedItem = new FeedItemObject();
                const article = $(item).find('a[class=question_link]');
                feedItem.title = article.text();

                const time = $(item).find('span[class=timestamp]').text();
                feedItem.date = new Date(time);

                const msgurl = `http://chuansong.me${article.attr('href')}`;
                const urlTask = URLManager.urlTasksFromURL(msgurl);
                urlTasks = urlTasks.concat(urlTask);

                feedItem.link = msgurl;
                feedItem.id = msgurl;

                parseTask.feed.addItem(feedItem);
            }
        });

        callback(urlTasks, parseTask, null);
    }

    parseChuansongArticle(task, callback) {
        const $ = Cheerio.load(task.content, {
            normalizeWhitespace: true,
        });
        console.log(task.content);
        const content = $('#js_content');
        // content.find('img').each((index, img) => {
        //     const src = $(img).attr('data-src');
        //     $(img).attr('src', src);
        // });

        const parseTask = task.copy();
        parseTask.feed = new FeedObject();
        const item = new FeedItemObject();
        item.content = content.html();
        item.id = task.url;
        parseTask.feed.addItem(item);
        callback([], parseTask, null);
    }
}
