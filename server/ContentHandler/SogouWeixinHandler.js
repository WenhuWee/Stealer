
import ContentHandler from './ContentHandler.js';

const Async = require('async');
const Cheerio = require('cheerio');
const QS = require('querystring');
const Url = require('url');

export default class SogouWeixinHandler extends ContentHandler{

    constructor() {
        super();
        this.parserDistributor = {
            'weixin.sogou.com': {
                '/weixin': this.parseSougouWeixin,
            },
            'mp.weixin.qq.com': {
                '/profile': this.parseWeixinProfile,
                '/s': this.parseWeixinArticle,
            }
        };
        this.urlDistributor = {
            'weixin.sogou.com': {
                '/': this.handleSogouWeixinUrl,
                '/weixin': this.handleSogouWeixinUrl,
            },
            'mp.weixin.qq.com': {
                '/': this.handleWinxinProfileUrl,
                '/profile': this.handleWinxinProfileUrl,
                '/s': this.handleWeixinArticleUrl,
            }
        };
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
            urlTasks = this.urlTasksFromURL(url);
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
        item.mergeID = task.url;
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

        const lastItemDate = task.feed.lastItemDate;

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
                        const currentDate = new Date();

                        if (Array.isArray(msgList)) {
                            msgList.every((ele,index) => {
                                if (index > 10){
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
                                    const urlTask = this.urlTasksFromURL(msgurl);
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
                                                const urlTask = this.urlTasksFromURL(msgurl);
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

    handleWeixinArticleUrl(url) {
        const tasks = [];
        if (url) {
            const contentTask = new URLTask();
            contentTask.url = url;
            contentTask.type = 'weixinArticle';
            tasks.push(contentTask);
        }
        return tasks;
    }

    handleWinxinProfileUrl(url) {
        const tasks = [];
        if (url) {
            const contentTask = new URLTask();
            contentTask.url = url;
            contentTask.type = 'weixinProfile';
            tasks.push(contentTask);
        }
        return tasks;
    }

    handleSogouWeixinUrl(url) {
        const tasks = [];
        if (url) {
            const contentTask = new URLTask();
            contentTask.url = url;
            contentTask.type = 'sougouWeixin';
            tasks.push(contentTask);
        }
        return tasks;
    }
}
