
import ContentHandler from './ContentHandler.js';

const Async = require('async');
const Cheerio = require('cheerio');
const QS = require('querystring');
const Url = require('url');

export default class ChuangsongHandler extends ContentHandler{
    constructor() {
        super();
        this.parserDistributor = {
            'chuansong.me': {
                '/search': this.parseChuansongSearch,
                '/account': this.parseChuansongProfile,
                '/n': this.parseChuansongArticle,
            }
        };

        this.urlDistributor = {
            'chuansong.me': {
                '/search': this.handleChuansongSearchUrl,
                '/account': {
                    '/': this.handleChuansongProfileUrl,
                },
                '/n': {
                    '/': this.handleChuansongArticalUrl,
                },
            }
        };
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
            urlTasks = this.urlTasksFromURL(url);
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
            if (i < 6) {
                const feedItem = new FeedItemObject();
                const article = $(item).find('a[class=question_link]');
                feedItem.title = article.text();

                const time = $(item).find('span[class=timestamp]').text();
                feedItem.date = new Date(time);

                const msgurl = `http://chuansong.me${article.attr('href')}`;
                const urlTask = this.urlTasksFromURL(msgurl);
                urlTasks = urlTasks.concat(urlTask);

                feedItem.link = msgurl;
                feedItem.id = msgurl;

                parseTask.feed.addItem(feedItem);
            }
        });

        callback(urlTasks, parseTask, null);
    }

    parseChuansongArticle(task:ParseTask, callback) {
        const $ = Cheerio.load(task.content, {
            normalizeWhitespace: true,
        });
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


    handleChuansongSearchUrl(url) {
        const tasks = [];
        if (url) {
            const contentTask = new URLTask();
            contentTask.url = url;
            contentTask.type = 'chuansongSearch';
            tasks.push(contentTask);
        }
        return tasks;
    }

    handleChuansongProfileUrl(url) {
        const tasks = [];
        if (url) {
            const contentTask = new URLTask();
            contentTask.url = url;
            contentTask.type = 'chuansongProfile';
            tasks.push(contentTask);
        }
        return tasks;
    }

    handleChuansongArticalUrl(url) {
        const tasks = [];
        if (url) {
            const contentTask = new URLTask();
            contentTask.url = url;
            contentTask.type = 'chuansongArticle';
            tasks.push(contentTask);
        }
        return tasks;
    }
}
