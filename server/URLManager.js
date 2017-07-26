
import { URLTask, ParseTask } from '../Model/CrawlTask.js';

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
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.12; rv:50.0) Gecko/20100101 Firefox/50.0',
            },
        };


        const parseTask = new ParseTask();
        parseTask.url = task.url;
        parseTask.type = task.type;

        const request = requestObject(options, (res) => {
            const body = [];
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
