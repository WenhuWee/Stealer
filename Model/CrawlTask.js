
import { FeedObject, FeedItemObject } from './FeedObject.js';

export class TimingCrawlTask {
    url:string;
    interval:number;
    nextTiming:Date;
    timer;

    constructor(url, interval,baseDate) {
        this.url = url;
        const gap = interval ? interval : 12;
        if (process.env.NODE_ENV === 'production') {
            const base = gap * 1000 * 60 * 60; // hour
            this.interval = base;
        } else {
            this.interval = 1 * gap * 1000; // second
        }
        if (baseDate) {
            this.nextTiming = baseDate;
        } else {
            this.nextTiming = new Date();
        }
    }

    update(interval) {
        if (interval) {
            this.interval = interval;
        }
    }

    start(callback) {
        if (!callback) {
            return;
        }
        const randomInterval = (Math.random() * (1.1 - 0.9) + 0.9) * this.interval;
        this.nextTiming = new Date(this.nextTiming.getTime() + randomInterval);

        this.timer = setTimeout(() => {
            callback(this.url);
            this.start(callback);
        },randomInterval)

        // this.timer = setInterval(() => {
        //     this.nextTiming = new Date(Date.now() + this.interval);
        //     callback(this.url);
        // }, this.interval);
    }

    stop() {
        if (this.timer) {
            clearTimeout(this.timer);
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
    feed:FeedObject;

    copy() {
        const task = new ParseTask();
        const keys = Object.keys(this);
        keys.forEach((key) => {
            task[key] = this[key];
        });
        return task;
    }
}
