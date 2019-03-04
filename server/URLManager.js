
import { URLTask, ParseTask } from '../Model/CrawlTask';
import StoreManager from './StoreManager';

const Url = require('url');
const Async = require('async');
const Request = require('request');

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
                '/': {'Cookie':'IPLOC=US; SUID=F417E3A52208990A000000005C0D6384; SUV=1544381317507345; ABTEST=0|1544381408|v1; SNUID=B48D0C0ED3D6AF4882950FBBD3D87FD0'}
            }
        };

        const manager = this;
        StoreManager.instance().getCookies(null, null, (cookies) => {
            if (cookies) {
                cookies.forEach((cookie) => {
                    manager.updateCookies(cookie.host, cookie.path, cookie.cookies);
                });
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

    updateCookies(host, path, cookies) {
        this._setDefaultHeader(host, path, {'Cookie':cookies});
    }

    requestURL(url, callback) {
        const contentTask = new URLTask();
        contentTask.url = url;
        this._requestURL(contentTask, (newTask) => {
            callback(newTask.error, newTask.content);
        });
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

        const parseTask = new ParseTask();
        parseTask.url = task.url;
        parseTask.type = task.type;

        const options = {
            method: 'GET',
            url: task.url,
            headers: {
                ...headers,
                host: url.host,
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.13; rv:59.0) Gecko/20100101 Firefox/59.0',
            },
        };
        Request(options, (error, response, body) => {
            if (error) {
                parseTask.error = error;
                callback(parseTask);
            } else {
                parseTask.content = body;
                callback(parseTask);
            }
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

function handleZhihuZhuanlanArticleUrl(url) {
    const tasks = [];
    if (url) {
        const contentTask = new URLTask();
        // if (url.charAt(4) === ':') {
        //     url.replace(/^http/, 'https');
        // }
        contentTask.url = url;
        contentTask.type = 'zhihuArticle';
        tasks.push(contentTask);
    }
    return tasks;
}

function handleWeixinArticleUrl(url) {
    const tasks = [];
    if (url) {
        const contentTask = new URLTask();
        // if (url.charAt(4) === ':') {
        //     url.replace(/^http/, 'https');
        // }
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

function handleJikeUrl(url) {
    const tasks = [];
    if (url) {
        const contentTask = new URLTask();
        contentTask.url = url;
        contentTask.type = 'jike';
        tasks.push(contentTask);
    }
    return tasks;
}

function handleRssHub(url) {
    const tasks = [];
    if (url) {
        const contentTask = new URLTask();
        contentTask.url = url;
        contentTask.type = 'rsshub';
        tasks.push(contentTask);
    }
    return tasks;
}

URLManager.urlHandler = {
    'zhuanlan.zhihu.com': {
        '/': handleZhihuZhuanlanUrl,
        '/p': handleZhihuZhuanlanArticleUrl,
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
    'app.jike.ruguoapp.com': {
        '/1.0/messages/showDetail': handleJikeUrl,
    },
    'localhost:1200': {
        '/': handleRssHub,
    }
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
