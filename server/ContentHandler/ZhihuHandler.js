
import ContentHandler from './ContentHandler.js';

const Async = require('async');
const Cheerio = require('cheerio');
const QS = require('querystring');
const Url = require('url');

export default class ZhihuHandler extends ContentHandler{

    constructor() {
        super();
        this.parserDistributor = {
            'zhuanlan.zhihu.com': {
                '/': this.parseZhihuZhuanlan,
            }
        };
        this.urlDistributor = {
            'zhuanlan.zhihu.com': {
                '/': this.handleZhihuZhuanlanUrl,
            }
        };
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
            feed.title = `${res.name}-知乎专栏`;
            feed.description = res.description;
            feed.id = `https://zhuanlan.zhihu.com${res.url}`;
            feed.link = `https://zhuanlan.zhihu.com${res.url}`;
            parseTask.feed = feed;
        }
        parseTask.content = res;
        callback([], parseTask, null);
    }

    handleZhihuZhuanlanUrl(url) {
        const tasks = [];
        if (url) {
            const urlObject = Url.parse(url);
            const paths = urlObject.pathname.split('/');
            const zhuanlanName = paths[1];
            if (zhuanlanName) {
                const contentTask = new URLTask();
                contentTask.url = `https://zhuanlan.zhihu.com/api/columns/${zhuanlanName}/posts?limit=20`;
                contentTask.type = 'content';

                const authorTask = new URLTask();
                authorTask.url = `https://zhuanlan.zhihu.com/api/columns/${zhuanlanName}`;
                authorTask.type = 'author';

                tasks.push(contentTask);
                tasks.push(authorTask);
            }
        }
        return tasks;
    }
}
