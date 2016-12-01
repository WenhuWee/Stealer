
import { Map } from 'immutable';
import * as utils from '../utils/misc.js';

const Feed = require('feed');

export class FeedObject {
    title: string;
    description: string;
    id: string;
    link: string;
    items: Map;

    constructor() {
        this.items = new Map();
    }

    copy() {
        const feed = new FeedObject();
        const keys = Object.keys(this);
        keys.forEach((key) => {
            feed[key] = this[key];
        });
        return feed;
    }

    merge(newFeed:FeedObject, exceptProp:Object = {}) {
        if (newFeed instanceof FeedObject) {
            const mergedFeed = this.copy();
            const keys = Object.keys(newFeed);
            keys.forEach((key) => {
                if (!exceptProp[key]) {
                    if (key === 'items') {
                        if (newFeed.items.size) {
                            newFeed.items.forEach((value, itemKey) => {
                                if (mergedFeed.items.get(itemKey)) {
                                    const mergedItem = mergedFeed.items.get(itemKey).merge(value);
                                    mergedFeed.addItem(mergedItem);
                                } else {
                                    mergedFeed.addItem(value);
                                }
                            });
                        }
                    } else {
                        mergedFeed[key] = newFeed[key];
                    }
                }
            });
            return mergedFeed;
        } else {
            return this.copy();
        }
    }

    addItem(item) {
        if (item.id) {
            this.items = this.items.set(item.id, item);
        }
    }

    generateRSSXML() {
        const feed = new Feed({
            title: this.title,
            description: this.description,
            id: this.id,
            link: this.link,
        });

        const items = [];
        this.items.forEach((ele) => {
            items.push(ele);
        });
        items.sort((a, b) => 0 - (a.date - b.date));

        let feedUpdatedTime = new Date();
        items.forEach((ele, index) => {
            if (index === 0) {
                feedUpdatedTime = ele.date;
            }

            feed.addItem({
                title: ele.title,
                id: ele.date.getTime(),
                link: ele.link,
                date: ele.date,
                content: ele.content,
                author: [{
                    name: ele.authorName,
                    link: ele.authorLink,
                }],
            });
        });

        feed.updated = feedUpdatedTime;
        let xml = null;
        try {
            xml = feed.render('atom-1.0');
        } catch (e) {
            // console.log(e);
        }
        return xml;
    }
}

export class FeedItemObject {
    title: string;
    id: string;
    link: string;
    date: Date;
    content: string;
    authorName: string;
    authorLink: string;

    copy() {
        const feed = new FeedItemObject();
        const keys = Object.keys(this);
        keys.forEach((key) => {
            feed[key] = this[key];
        });
        return feed;
    }

    merge(newFeedItem:FeedItemObject, exceptProp:Object = {}) {
        if (newFeedItem instanceof FeedItemObject) {
            const mergedFeed = this.copy();
            const keys = Object.keys(newFeedItem);
            keys.forEach((key) => {
                if (!exceptProp[key]) {
                    mergedFeed[key] = newFeedItem[key];
                }
            });
            return mergedFeed;
        } else {
            return this.copy();
        }
    }
}
