
const Feed = require('feed');

export class FeedObject {
    title: string;
    description: string;
    id: string;
    link: string;
    updated: Date;
    items: Array;

    constructor() {
        this.items = [];
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
                        mergedFeed.items = newFeed.items.copyWithin();
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
        this.items.push(item);
    }

    generateRSSXML() {
        const feed = new Feed({
            title: this.title,
            description: this.description,
            id: this.id,
            link: this.link,
        });
        let feedUpdatedTime = new Date();
        this.items.forEach((ele, index) => {
            if (index === 0) {
                feedUpdatedTime = new Date(ele.publishedTime);
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
        return feed.render('atom-1.0');
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
}
