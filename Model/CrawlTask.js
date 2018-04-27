
import { FeedObject, FeedItemObject } from './FeedObject.js';

export class TimingCrawlTask {

    constructor(id,url, interval,baseDate) {
        this.id = id;
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
            if (process.env.NODE_ENV === 'production') {
                const base = interval * 1000 * 60 * 60; // hour
                this.interval = base;
            } else {
                this.interval = 1 * interval * 1000; // second
            }
        }
    }

    start(callback) {
        if (!callback) {
            return;
        }
        const randomInterval = (Math.random() * (1.1 - 0.9) + 0.9) * this.interval;
        let nextTiming = this.nextTiming.getTime() + randomInterval;
        const nowTiming = Date.now();

        while (nextTiming < nowTiming) {
            nextTiming += randomInterval;
        }

        const timeOutInterval = nextTiming - nowTiming;
        this.nextTiming = new Date(nextTiming);

        this.timer = setTimeout(() => {
            callback(this.id,this.url);
            this.start(callback);
        },timeOutInterval);

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

    copy() {
        const task = new ParseTask();
        const keys = Object.keys(this);
        keys.forEach((key) => {
            task[key] = this[key];
        });
        return task;
    }
}
