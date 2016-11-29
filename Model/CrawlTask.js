
import { FeedObject, FeedItemObject } from './FeedObject.js';

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
