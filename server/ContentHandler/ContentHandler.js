
import * as utils from '../../utils/misc.js';
import { ParseTask, URLTask } from '../../Model/CrawlTask.js';
import { FeedObject, FeedItemObject } from '../../Model/FeedObject.js';

const Async = require('async');
const Cheerio = require('cheerio');
const QS = require('querystring');
const Url = require('url');

export default class ContentHandler {
    constructor() {
        this.parserDistributor = {
        };
        this.urlDistributor = {

        };
    }

    parseTask(task:ParseTask,callback){
        const urlObject = Url.parse(task.url);
        const host = urlObject.host;
        const path = urlObject.pathname;
        const parser = this.distibuteParser(host, path);
        parser(task, callback);
    }

    urlTasksFromURL(url){
        let tasks = [];
        const urlObject = Url.parse(task.url);
        const host = urlObject.host;
        const path = urlObject.pathname;
        const handler = this.distibuteUrlHandler(host,path);
        if (handler) {
            tasks = handler(url);
        }
        return tasks;
    }

    getHandler(host,path,set) {
        let parser = null;

        if (set instanceof Object) {
            let parserSet = set[host];
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
        }

        if (!parser) {
            parser = (task, callback) => { callback(null); };
        }
        return parser;
    }

    distibuteParser(host, path) {
        return this.getHandler(host,path,this.parserDistributor);
    }

    distibuteUrlHandler(host, path){
        return this.getHandler(host,path,this.urlDistributor);
    }
}
