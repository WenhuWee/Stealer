
import { URLTask, ParseTask } from '../Model/CrawlTask.js';
import StoreManager from './StoreManager.js';

const Http = require('http');
const Https = require('https');
const Url = require('url');
const Async = require('async');

export default class URLManager {
    constructor() {
        this.initialOption = {
            asyncNum: 10,
        };

        this.currentOption = this.initialOption;

        this.defaultHeader = {
            'zhuanlan.zhihu.com': {
                '/': '',
            },
            'weixin.sogou.com':{
                '/': {'Cookie':'ABTEST=0|1501334532|v1; IPLOC=SG; SUID=08E1A6BC2930990A00000000597C8C04; PHPSESSID=8ktoa1f828jam7a58ntc18hg16; SUIR=1501334532; SUID=08E1A6BC2208990A00000000597C8C06; SUV=1501334540673968; SNUID=27D196932F35655B80CA7C70304366F0; JSESSIONID=aaaFONgTVzsfd8gKXz41v; sct=5; ld=DZllllllll2BKwCjlllllVOD0Uwllllls3bPjlllll9lllll4ylll5@@@@@@@@@@; weixinIndexVisited=1'}
            }
        };

        const manager = this;
        StoreManager.instance().getCookies(null,null,(cookies)=>{
            if (cookies){
                cookies.forEach((cookie) =>{
                    manager.updateCookies(cookie.host,cookie.path,cookie.cookies);
                })
            }
        });
    }

    start(option) {
        if (option) {
            this.currentOption = Object.assign({}, this.initial:Option, option);
        } else {
            this.currentOption = Object.assign({}, this.initialOption);
        }

        this.crawlerQueue = Async.queue((params, callback) => {
            const tasks = params.tasks;
            if (Array.isArray(tasks)) {
                const funtions = [];
                const parseTasks = [];
                tasks.forEach((task) => {
                    funtions.push((funBack) => {
                        this._requestURL(task, (newTask) => {
                            parseTasks.push(newTask);
                            funBack(newTask.error, newTask.content);
                        });
                    });
                });
                Async.parallel(funtions, (err) => {
                    callback(parseTasks, err);
                });
            } else {
                callback([], Error('No Tasks'));
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
            const handler = URLManager.getUrlHandler(url);
            if (handler) {
                tasks = handler(url);
            }
            this.crawlerQueue.push({
                tasks,
                header,
            }, callback);
        }
    }

    insertURLTasks(tasks, callback) {
        if (this.crawlerQueue) {
            this.crawlerQueue.push({
                tasks,
            }, callback);
        }
    }

    updateCookies(host,path,cookies){
        this._setDefaultHeader(host,path,{'Cookie':cookies});
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

    _setDefaultHeader(host, path, header) {
        if (!host || !path || !header) {
            return;
        }
        let hostRule = this.defaultHeader[host];
        if (!hostRule) {
            hostRule = {'/':''};
        }
        let newHeader = hostRule[path];
        if (newHeader) {
            newHeader = Object.assign(header, newHeader);
        } else {
            newHeader = header;
        }

        hostRule[path] = newHeader;
        this.defaultHeader[host] = hostRule;
    }

    _requestURL(task, callback) {
        const url = Url.parse(task.url);
        let headers = this._getDefaultHeader(url.host, url.pathname) || {};
        if (task.header) {
            headers = Object.assign(headers, task.header);
        }
        // console.log(headers);

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
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.12; rv:50.0) Gecko/20100101 Firefox/50.0',
            },
        };


        const parseTask = new ParseTask();
        parseTask.url = task.url;
        parseTask.type = task.type;

        const manager = this;

        const request = requestObject(options, (res) => {
            const body = [];
            // const setcookie = res.headers["set-cookie"];
            // if (setcookie) {
            //     const cookieString = setcookie.join(';');
            //     manager._setDefaultHeader(url.host,url.pathname,{'Cookie':cookieString});
            //     StoreManager.instance().setCookies(url.host,url.pathname, cookieString);
            // }
            res.on('data', (data) => {
                body.push(data);
            });
            res.on('end', () => {
                const buffer = Buffer.concat(body);
                parseTask.content = buffer.toString('utf-8');
                callback(parseTask);
            });
        });
        request.end();

        request.on('error', (error) => {
            parseTask.error = error;
            callback(parseTask);
        });
    }
}

function handleZhihuZhuanlanUrl(url) {
    const tasks = [];
    if (url) {
        const urlObject = Url.parse(url);
        const paths = urlObject.pathname.split('/');
        const zhuanlanName = paths[1];
        if (zhuanlanName) {
            const contentTask = new URLTask();
            contentTask.url = `https://zhuanlan.zhihu.com/api/columns/${zhuanlanName}/posts?limit=10`;
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

function handleWeixinArticleUrl(url) {
    const tasks = [];
    if (url) {
        const contentTask = new URLTask();
        contentTask.url = url;
        contentTask.type = 'weixinArticle';
        tasks.push(contentTask);
    }
    return tasks;
}

function handleWinxinProfileUrl(url) {
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
function handleSogouWeixinUrl(url) {
    const tasks = [];
    if (url) {
        const contentTask = new URLTask();
        contentTask.url = url;
        contentTask.type = 'sougouWeixin';
        tasks.push(contentTask);
    }
    return tasks;
}

// chuansong
function handleChuansongSearchUrl(url) {
    const tasks = [];
    if (url) {
        const contentTask = new URLTask();
        contentTask.url = url;
        contentTask.type = 'chuansongSearch';
        tasks.push(contentTask);
    }
    return tasks;
}

function handleChuansongProfileUrl(url) {
    const tasks = [];
    if (url) {
        const contentTask = new URLTask();
        contentTask.url = url;
        contentTask.type = 'chuansongProfile';
        tasks.push(contentTask);
    }
    return tasks;
}

function handleChuansongArticalUrl(url) {
    const tasks = [];
    if (url) {
        const contentTask = new URLTask();
        contentTask.url = url;
        contentTask.type = 'chuansongArticle';
        tasks.push(contentTask);
    }
    return tasks;
}


URLManager.urlHandler = {
    'zhuanlan.zhihu.com': {
        '/': handleZhihuZhuanlanUrl,
    },
    'weixin.sogou.com': {
        '/': handleSogouWeixinUrl,
        '/weixin': handleSogouWeixinUrl,
    },
    'mp.weixin.qq.com': {
        '/': handleWinxinProfileUrl,
        '/profile': handleWinxinProfileUrl,
        '/s': handleWeixinArticleUrl,
    },
    'chuansong.me': {
        '/search': handleChuansongSearchUrl,
        '/account': {
            '/': handleChuansongProfileUrl,
        },
        '/n': {
            '/': handleChuansongArticalUrl,
        },
    },
};

function getUrlHandler(url) {
    const urlObject = Url.parse(url);
    let handler = null;
    if (urlObject && urlObject.host) {
        let handlerSet = URLManager.urlHandler[urlObject.host];

        if (handlerSet) {
            if (urlObject.pathname) {
                handler = handlerSet[urlObject.pathname];
            }
            if (!handler) {
                const paths = urlObject.pathname.split('/');
                paths.forEach((ele, index) => {
                    if (index > 0 && !handler) {
                        const temp = handlerSet[`/${ele}`];
                        if (typeof temp === 'function') {
                            handler = temp;
                        }
                        if (!handler) {
                            handler = handlerSet['/'];
                        }
                        handlerSet = handlerSet[`/${ele}`];
                    }
                });
            }
        }

    }
    return handler;
}

URLManager.urlTasksFromURL = (url) => {
    let tasks = [];
    const handler = getUrlHandler(url);
    if (handler) {
        tasks = handler(url);
    }
    return tasks;
};
