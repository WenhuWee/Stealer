
import { FeedObject, FeedItemObject } from './FeedObject.js';

export class TimingCrawlTask {
    url:string;
    interval:number;
    timer;

    constructor(url, interval) {
        this.url = url;
        if (process.env.NODE_ENV === 'production') {
            this.interval = interval * 1000 * 60 * 60; // hour
        } else {
            this.interval = 5 * interval * 1000; // second
        }
    }

    start(callback) {
        if (!callback) {
            return;
        }
        this.timer = setInterval(() => {
            callback(this.url);
        }, this.interval);
    }

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
}

export class URLTask {
    url:string;
    header:string;
    type:string;
    error:Object;
    feed: FeedObject;

    copy() {
        const task = new URLTask();
        const keys = Object.keys(this);
        keys.forEach((key) => {
            task[key] = this[key];
        });
        return task;
    }
}

export class ParseTask {
    url:string;
    type:string;
    content:Object;
    error:Object;
    feedObject: FeedObject;
    feedXML:string;

    copy() {
        const task = new ParseTask();
        const keys = Object.keys(this);
        keys.forEach((key) => {
            task[key] = this[key];
        });
        return task;
    }
}
