
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
        this.interval = 12;
        if (typeof obj === 'object') {
            if (obj._id) {
                this.id = obj._id;
                this.title = obj.title;
                this.url = obj.url;
                this.xml = obj.xml;
                this.lastItemDate = obj.lastItemDate;
                this.errMsg = obj.errMsg;
                this.errTime = obj.errTime;
                this.lastVisitedDate = obj.lastVisitedDate;
                this.updatedTime = obj.updatedTime;
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
            const storeObj = { _id: this.id };
            storeObj.url = this.url;
            storeObj.title = this.title;
            storeObj.xml = this.xml;
            storeObj.lastItemDate = this.lastItemDate;
            storeObj.errMsg = this.errMsg;
            storeObj.errTime = this.errTime;
            storeObj.lastVisitedDate = this.lastVisitedDate;
            storeObj.updatedTime = this.updatedTime;
            storeObj.interval = this.interval;
            return storeObj;
        } else {
            return null;
        }
    }

    generateStoreObjectWithoutID() {
        if (this.id) {
            const storeObj = {};
            storeObj.url = this.url;
            storeObj.title = this.title;
            storeObj.xml = this.xml;
            storeObj.lastItemDate = this.lastItemDate;
            storeObj.errMsg = this.errMsg;
            storeObj.errTime = this.errTime;
            storeObj.lastVisitedDate = this.lastVisitedDate;
            storeObj.updatedTime = this.updatedTime;
            storeObj.interval = this.interval;
            return storeObj;
        } else {
            return null;
        }
    }
}
