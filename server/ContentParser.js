
import * as utils from '../utils/misc';
import { ParseTask, URLTask } from '../Model/CrawlTask';
import { FeedObject, FeedItemObject } from '../Model/FeedObject';
import URLManager from './URLManager';
import KerasCaptcha from '../captcha/kerasCaptcha';

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
                '/profile': this.parseWeixinProfile.bind(this),
                '/s': this.parseWeixinArticle,
            },
            'app.jike.ruguoapp.com': {
                '/1.0/messages/showDetail': this.parseJKProfile,
            },
        };
        this.captcha = new KerasCaptcha();
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
                    if (index > 0 && !parser) {
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

    parseJKProfile(task, callback) {

        const res = utils.safeJSONParse(task.content);

        const parseTask = task.copy();
        parseTask.feed = new FeedObject();
        parseTask.feed.title = `即刻 - ${res.topic.content}`;
        parseTask.feed.description = res.topic.briefIntro;
        parseTask.feed.id = res.topic.id;
        parseTask.feed.link = task.url;

        let feedUpdatedTime = new Date();

        let urlTasks = [];

        res.messages.forEach((item, index) => {
            let contentTemplate = item.content;
            if (item.linkUrl) {
                contentTemplate = `<a href="${item.linkUrl}">${item.content}</a>`;
            }
            if (item.personalUpdate && item.personalUpdate.linkUrl) {
                contentTemplate = `<a href="${item.personalUpdate.linkUrl}">${item.content}</a>`;
            }

            let imgTemplate = '';
            item.pictureUrls && item.pictureUrls.forEach((pic) => {
                imgTemplate += `<br><img referrerpolicy="no-referrer" src="${pic.picUrl}">`;
            });
            item.personalUpdate && item.personalUpdate.pictureUrls && item.personalUpdate.pictureUrls.forEach((pic) => {
                imgTemplate += `<br><img referrerpolicy="no-referrer" src="${pic.picUrl}">`;
            });

            let videoTemplate = '';
            if (item.video) {
                videoTemplate = `<br>视频: <img referrerpolicy="no-referrer" src="${item.video.image.picUrl}">`;
            }
            if (item.personalUpdate && item.personalUpdate.video) {
                videoTemplate = `<br>视频: <img referrerpolicy="no-referrer" src="${item.personalUpdate.video.image.picUrl}">`;
            }
            if (index === 0) {
                feedUpdatedTime = new Date(item.createdAt);
            }
            const feedItem = new FeedItemObject();
            feedItem.title = item.content;
            feedItem.id = item.id;
            feedItem.link = item.originalLinkUrl;
            feedItem.date = new Date(item.createdAt);
            feedItem.content = `${contentTemplate}${imgTemplate}${videoTemplate}`;
            feedItem.authorName = item.author;

            const tasks = URLManager.urlTasksFromURL(feedItem.link);
            urlTasks = urlTasks.concat(tasks);

            if (tasks.length) {
                feedItem.mergeID = tasks[0].url;
            } else {
                feedItem.mergeID = feedItem.link;
            }

            parseTask.feed.addItem(feedItem);
        });
        parseTask.feed.updated = feedUpdatedTime;

        callback(urlTasks, parseTask, null);
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
                    item.id = utils.MD5(`https://zhuanlan.zhihu.com${ele.url}`);
                    item.mergeID = `https://zhuanlan.zhihu.com${ele.url}`;
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
            feed.title = `知乎专栏-${res.name}`;
            feed.description = res.description;
            // feed.id = `https://zhuanlan.zhihu.com${res.url}`;
            feed.id = `zhihu_${res.slug}`;
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
        parseTask.feed.link = task.url;

        callback(urlTasks, parseTask, null);
    }

    parseWeixinArticle(task, callback) {
        const $ = Cheerio.load(task.content, {
            normalizeWhitespace: true,
        });
        let content = $('#js_content');
        if (!content.length) {
            content = $('#js_content', '.rich_media_content');
        }
        // console.log(task.url);
        // console.log(task.content);
        
        content.find('img').each((index, img) => {
            const src = $(img).attr('data-src');
            $(img).attr('src', src);
        });

        const parseTask = task.copy();
        parseTask.feed = new FeedObject();
        const item = new FeedItemObject();
        item.content = content.html();
        item.mergeID = task.url;
        parseTask.feed.addItem(item);
        callback([], parseTask, null);
    }

    parseWeixinProfile(task, callback) {
        const $ = Cheerio.load(task.content, {
            normalizeWhitespace: true,
        });

        const verifyCodeBox = $('#verify_result');

        const script = $('script').filter(function (i, el) {
            const text = $(this).text();
            return text.indexOf('var biz') !== -1;
        });

        const lastItemDate = task.feed.lastItemDate;

        const parseTask = task.copy();
        parseTask.feed = new FeedObject();
        // parseTask.feed.link = task.url;
        let urlTasks = [];

        if (verifyCodeBox.length) {
            this.captcha.autoPredict(8, (success, err) => {
                console.log(success, err);
            });
            callback(urlTasks, parseTask, null);
            return;
        }

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
                        const currentDate = new Date();

                        if (Array.isArray(msgList)) {
                            msgList.every((ele,index) => {
                                if (index > 10) {
                                    return false;
                                }

                                const feedDate = new Date(ele.comm_msg_info.datetime * 1000);
                                if (feedDate) {
                                    if (lastItemDate && lastItemDate >= feedDate) {
                                        return false;
                                    } else {
                                        const gap = currentDate.getTime() - feedDate.getTime();
                                        if (gap > 3 * 24 * 60 * 60 * 1000) {
                                            return false;
                                        }
                                    }
                                }

                                const feedItem = new FeedItemObject();
                                feedItem.authorName = ele.app_msg_ext_info.author;
                                feedItem.title = ele.app_msg_ext_info.title;
                                feedItem.date = feedDate;

                                if (ele.app_msg_ext_info.content_url) {
                                    const decodeURL = ele.app_msg_ext_info.content_url.replace(/&amp;/g, '&');
                                    const msgurl = `http://mp.weixin.qq.com${decodeURL}`;
                                    const urlTask = URLManager.urlTasksFromURL(msgurl);
                                    urlTasks = urlTasks.concat(urlTask);

                                    feedItem.mergeID = msgurl;
                                    feedItem.link = `http://weixin.sogou.com/weixin?type=2&query=${feedItem.title}`;
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

                                                multifeedItem.mergeID = msgurl;
                                                multifeedItem.link = `http://weixin.sogou.com/weixin?type=2&query=${multifeedItem.title}`;
                                            }
                                            parseTask.feed.addItem(multifeedItem);
                                        });
                                    }
                                }
                                return true;
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
}
