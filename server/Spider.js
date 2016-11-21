
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
                if (urlObject.path) {
                    handler = handlerSet[urlObject.path];
                }
                if (!handler) {
                    handler = handlerSet['/'];
                }
            }
        }
        return handler;
    }

    _getDefaultHeader(host, path) {
        let header = null;
        const hostRule = this.defaultHeader[host];
        if (hostRule) {
            header = hostRule[path];
        }
        if (!header) {
            header = hostRule['/'];
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

class ContentParser {
    constructor() {
        this.parserDistributor = {
            'zhuanlan.zhihu.com': {
                '/': this.parseZhihuZhuanlan,
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
            parser = () => {};
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
                    const path = urlObject.path;
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
        if (task.contentHanlder) {
            res = task.contentHanlder(task.content);
        } else {
            res = utils.safeJSONParse(task.content);
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
