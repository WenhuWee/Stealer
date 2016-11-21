
import * as utils from '../utils/misc.js';

const Http = require('http');
const Https = require('https');
const Url = require('url');
const Async = require('async');
const Cheerio = require('cheerio');
const Nedb = require('nedb');
const FS = require('fs');
const Path = require('path');
const QS = require('querystring');


// -----------------------------------
// ----------------URLManager---------
// -----------------------------------

class URLManager {
    constructor() {
        this.initialOption = {
            asyncNum: 10,
        };

        this.currentOption = this.initialOption;

        this.defaultHeader = {

        };
        this.urlHandler = {

        };
    }

    start(option) {
        if (option) {
            this.currentOption = Object.assign({}, this.initialOption, option);
        } else {
            this.currentOption = Object.assign({}, this.initialOption);
        }

        this.crawlerQueue = Async.queue((task, callback) => {
            this._requestURL(task, (content, err) => {
                callback(task.url, content, err);
            });
        }, this.currentOption.asyncNum);
    }

    stop() {
        this.crawlerQueue.kill();
        this.crawlerQueue = null;
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

    insertURL(url, header, callback) {
        if (this.crawlerQueue) {
            let target = url;
            const handler = this._getUrlHandler(url);
            if (handler) {
                target = handler(url);
            }
            this.crawlerQueue.push({
                url: target,
                header,
            }, callback);
        }
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

    _requestURL(params, callback) {
        const url = Url.parse(params.url);
        let headers = this._getDefaultHeader(url.host, url.path) || {};
        if (params.header) {
            headers = Object.assign(headers, params.header);
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

        const request = requestObject(options, (res) => {
            const body = [];
            res.on('data', (data) => {
                body.push(data);
            });
            res.on('end', () => {
                const buffer = Buffer.concat(body);
                callback(buffer.toString('utf-8'), null);
            });
        });
        request.end();

        request.on('error', (error) => {
            callback(null, error);
        });
    }
}

class ContentParser {
    constructor() {
        this.parserDistributor = {

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

    parse(url, content, callback) {
        const urlObject = Url.parse(url);
        const host = urlObject.host;
        const path = urlObject.path;
        const parser = this.distibuteParser(host, path);
        parser(content, (res) => {
            callback(res);
        });
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
                this.contentParser.parse(url, content, (res) => {
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
        // this.URLManager.insertURL('http://wiki.lianjia.com/pages/viewpage.action?pageId=12486259', null, this.contentHanlder.bind(this));
    }

    contentHanlder(url, content, error) {
        if (error) {
            // utils.devLog(error);
        } else {
            this.contentParser.parse(url, content, () => {});
        }
    }
}
