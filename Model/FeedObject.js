
import { Map } from 'immutable';

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
                                    mergedFeed.items = mergedFeed.items.set(itemKey, mergedItem);
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
        let feedUpdatedTime = new Date(1989 - 12 - 12);
        this.items.forEach((ele, key) => {
            if (feedUpdatedTime < ele.updated) {
                feedUpdatedTime = ele.updated;
            }
            feed.addItem({
                title: ele.title,
                id: ele.id,
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
            console.log(e);
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
