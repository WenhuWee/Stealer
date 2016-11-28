
import * as utils from '../utils/misc.js';

const Http = require('http');
const Https = require('https');
const Url = require('url');
const Async = require('async');
const Cheerio = require('cheerio');
const FS = require('fs');
const Path = require('path');
const QS = require('querystring');


// -----------------------------------
// ----------------URLManager---------
// -----------------------------------

class URLTask {
    url:string;
    header:string;
    type:string;
    content:Object;
    contentHanlder:Function;
    error:Object;

    copy() {
        const task = new URLTask();
        const keys = Object.keys(this);
        keys.forEach((key) => {
            task[key] = this[key];
        });
        return task;
    }
}

class URLManager {
    constructor() {
        this.initialOption = {
            asyncNum: 10,
        };

        this.currentOption = this.initialOption;

        this.defaultHeader = {
            'zhuanlan.zhihu.com': {
                '/': '',
            },
        };
        this.urlHandler = {
            'zhuanlan.zhihu.com': {
                '/': this.handleZhihuZhuanlanUrl,
            },
            'weixin.sogou.com': {
                '/': this.handleSogouWeixinUrl,
                '/weixin': this.handleSogouWeixinUrl,
            },
            'mp.weixin.qq.com': {
                '/': this.handleWinxinProfileUrl,
                '/profile': this.handleWinxinProfileUrl,
                '/s': this.handleWeixinArticleUrl,
            },
        };
    }

    start(option) {
        if (option) {
            this.currentOption = Object.assign({}, this.initialOption, option);
        } else {
            this.currentOption = Object.assign({}, this.initialOption);
        }

        this.crawlerQueue = Async.queue((params, callback) => {
            const tasks = params.tasks;
            if (Array.isArray(tasks)) {
                const funtions = [];
                const newTasks = [];
                tasks.forEach((task) => {
                    funtions.push((funBack) => {
                        this._requestURL(task, (newTask) => {
                            newTasks.push(newTask);
                            funBack(newTask.error, newTask.content);
                        });
                    });
                });
                Async.parallel(funtions, (err) => {
                    callback(newTasks, err);
                });
            } else {
                callback(tasks, null);
            }

        }, this.currentOption.asyncNum);
    }

    stop() {
        this.crawlerQueue.kill();
        this.crawlerQueue = null;
    }

    insertURL(url, header, callback) {
        if (this.crawlerQueue) {
            let tasks = [];
            const handler = this._getUrlHandler(url);
            if (handler) {
                tasks = handler(url);
            }
            this.crawlerQueue.push({
                tasks,
                header,
            }, callback);
        }
    }

    _getUrlHandler(url) {
        const urlObject = Url.parse(url);
        let handler = null;
        if (urlObject && urlObject.host) {
            const handlerSet = this.urlHandler[urlObject.host];
            if (handlerSet) {
                if (urlObject.pathname) {
                    handler = handlerSet[urlObject.pathname];
                }
                if (!handler) {
                    handler = handlerSet['/'];
                }
            }
        }
        return handler.bind(this);
    }

    _getDefaultHeader(host, path) {
        let header = null;
        const hostRule = this.defaultHeader[host];
        if (hostRule) {
            header = hostRule[path];
            if (!header) {
                header = hostRule['/'];
            }
        }
        return header;
    }

    _requestURL(task, callback) {
        const url = Url.parse(task.url);
        let headers = this._getDefaultHeader(url.host, url.path) || {};
        if (task.header) {
            headers = Object.assign(headers, task.header);
        }

        let requestObject = Http.request;
        let port = url.port || 80;
        if (url.protocol === 'https:') {
            requestObject = Https.request;
            port = url.port || 443;
        }
        const options = {
            hostname: url.host,
            port,
            path: url.path,
            headers: {
                ...headers,
                host: url.host,
            },
        };


        const newTask = task.copy();

        const request = requestObject(options, (res) => {
            const body = [];
            res.on('data', (data) => {
                body.push(data);
            });
            res.on('end', () => {
                const buffer = Buffer.concat(body);
                newTask.content = buffer.toString('utf-8');
                callback(newTask);
            });
        });
        request.end();

        request.on('error', (error) => {
            newTask.error = error;
            callback();
        });
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

// Sougou Weixin
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

    // zhihu专栏
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
                contentTask.contentHanlder = this.zhihuZhuanlanContentHanlder;

                const authorTask = new URLTask();
                authorTask.url = `https://zhuanlan.zhihu.com/api/columns/${zhuanlanName}`;
                authorTask.type = 'author';

                tasks.push(contentTask);
                tasks.push(authorTask);
            }
        }
        return tasks;
    }

    zhihuZhuanlanContentHanlder(content:Object) {
        if (Array.isArray(content)) {
            content.forEach((ele) => {
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
                    console.log($.html());
                }
            });
        }
        return content;
    }
}

class ContentParser {
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
            const resObj = {};
            tasks.forEach((task) => {
                funtions.push((funBack) => {
                    const urlObject = Url.parse(task.url);
                    const host = urlObject.host;
                    const path = urlObject.pathname;
                    const parser = this.distibuteParser(host, path);
                    parser(task, (res) => {
                        resObj[task.type] = res;
                        funBack(null, res);
                    });
                });
            });
            Async.parallel(funtions, (err) => {
                callback(resObj, err);
            });
        } else {
            callback([], null);
        }
    }

    parseZhihuZhuanlan(task, callback) {
        let res = {};
        res = utils.safeJSONParse(task.content);
        if (task.contentHanlder) {
            res = task.contentHanlder(res);
        }
        callback(res);
    }

    parseSougouWeixin(task, callback) {
        let res = {};
        if (task.contentHanlder) {
            res = task.contentHanlder(utils.safeJSONParse(task.content));
        } else {
            const $ = Cheerio.load(task.content, {
                normalizeWhitespace: true,
            });
            const firstItem = $('#sogou_vr_11002301_box_0');
            const aTag = firstItem.find('.gzh-box2 .img-box a');
            const url = aTag.attr('href');

            const nameTag = firstItem.find('.gzh-box2 .txt-box a');
            const name = nameTag.text();

            const description = firstItem.find('dl dd').first().text();

            res.url = url;
            res.name = name;
            res.description = description;

            const taskUrlObject = Url.parse(task.url);
            if (taskUrlObject) {
                const params = QS.parse(taskUrlObject.query);
                res.id = params.query;
            }
        }
        callback(res);
    }

    parseWeixinArticle(task, callback) {
        let res = {};
        if (task.contentHanlder) {
            res = task.contentHanlder(utils.safeJSONParse(task.content));
        } else {
            const $ = Cheerio.load(task.content, {
                normalizeWhitespace: true,
            });
            const content = $('#img-content .rich_media_content');
            content.find('img').each((index, img) => {
                const src = $(img).attr('data-src');
                $(img).attr('src', src);
            });
            res.content = content.html();
        }
        callback(res);
    }

    parseWeixinProfile(task, callback) {
        let res = {};
        if (task.contentHanlder) {
            res = task.contentHanlder(utils.safeJSONParse(task.content));
        } else {
            const $ = Cheerio.load(task.content, {
                normalizeWhitespace: true,
            });
            const script = $('script').filter(function (i, el) {
                const text = $(this).text();
                return text.indexOf('var biz') !== -1;
            });
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
                            const contents = [];
                            if (Array.isArray(msgList)) {
                                msgList.forEach((ele) => {
                                    const msg = {};
                                    msg.author = ele.app_msg_ext_info.author;
                                    msg.title = ele.app_msg_ext_info.title;
                                    if (ele.app_msg_ext_info.content_url) {
                                        const decodeURL = ele.app_msg_ext_info.content_url.replace(/&amp;/g, '&');
                                        msg.url = `http://mp.weixin.qq.com${decodeURL}`;
                                    }
                                    msg.date = ele.comm_msg_info.datetime;
                                    contents.push(msg);
                                });
                            }

                            if (obj) {
                                res.content = contents;
                            }
                        }
                    }
                }
            }
        }
        callback(res);
    }
}

class StoreKeeper {

    _browserUA(browser) {

    }
}

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
        this.URLManager.insertURL(target, null, (url, content, error) => {
            if (error) {
                callback(null, error);
            } else {
                this.contentParser.parse(url, (res) => {
                    callback(res, null);
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
