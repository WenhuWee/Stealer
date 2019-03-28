
export class FeedStoreModel {
    id: string;
    title: String;
    url: string;
    xml: string;
    lastItemDate:Date;
    updatedTime:Date;
    lastVisitedDate:Date;
    interval:Number;

    errMsg:string;
    errTime:Date;

    constructor(obj) {
        if (typeof obj === 'object') {
            if (obj.id) {
                this.id = obj.id;
                this.title = obj.title;
                this.url = obj.url;
                this.xml = obj.xml;
                if (obj.lastItemDate) {
                    this.lastItemDate = new Date(obj.lastItemDate);
                }
                this.errMsg = obj.errMsg;
                if (obj.errTime) {
                    this.errTime = new Date(obj.errTime);
                }
                if (obj.lastVisitedDate) {
                    this.lastVisitedDate = new Date(obj.lastVisitedDate);
                }
                if (obj.updatedTime) {
                    this.updatedTime = new Date(obj.updatedTime);
                }
                if (obj.interval) {
                    this.interval = obj.interval;
                }
            }
        }
    }

    isValid() {
        return Boolean(this.id);
    }

    copy() {
        const feed = new FeedStoreModel();
        const keys = Object.keys(this);
        keys.forEach((key) => {
            feed[key] = this[key];
        });
        return feed;
    }

    generateStoreObjectWithID() {
        if (this.id) {
            const feed = {};
            const keys = Object.keys(this);
            keys.forEach((key) => {
                feed[key] = this[key];
            });
            return feed;
        } else {
            return null;
        }
    }

    generateStoreObjectWithoutXML() {
        if (this.id) {
            const feed = {};
            const keys = Object.keys(this);
            keys.forEach((key) => {
                if (key !== 'xml') {
                    feed[key] = this[key];
                }
            });
            return feed;
        } else {
            return null;
        }
    }

    merge(newFeed:FeedStoreModel, exceptProp:Object = {}) {
        if (newFeed instanceof FeedStoreModel && this.id === newFeed.id) {
            const mergedFeed = this.copy();
            const keys = Object.keys(newFeed);
            keys.forEach((key) => {
                if (!exceptProp[key]) {
                    mergedFeed[key] = newFeed[key];
                }
            });
            return mergedFeed;
        } else {
            return this.copy();
        }
    }
}
