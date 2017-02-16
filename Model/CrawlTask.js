
import { FeedObject, FeedItemObject } from './FeedObject.js';

export class TimingCrawlTask {
    url:string;
    interval:number;
    nextTiming:Date;
    timer;

    constructor(url, interval) {
        this.url = url;
        if (process.env.NODE_ENV === 'production') {
            const base = interval * 1000 * 60 * 60; // hour
            const randomInterval = (Math.random() * (1.2 - 0.8) + 0.8) * base;
            this.interval = randomInterval;
        } else {
            this.interval = 5 * 60 * interval * 1000; // second
        }
    }

    start(callback) {
        if (!callback) {
            return;
        }
        const currentDate = new Date();
        this.nextTiming = new Date(currentDate.getTime() + this.interval);

        this.timer = setInterval(() => {
            const currentDate2 = new Date();
            this.nextTiming = new Date(currentDate2.getTime() + this.interval);
            callback(this.url);
        }, this.interval);
    }

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.nextTiming = null;
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
