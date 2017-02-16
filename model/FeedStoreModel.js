
export class FeedStoreModel {
    id: string;
    url: string;
    xml: string;
    errMsg:string;
    errTime:Date;
    createdTime:Date;

    constructor(obj) {
        if (typeof obj === 'object') {
            if (obj._id) {
                this.id = obj._id;
                this.url = obj.url;
                this.xml = obj.xml;
                this.errMsg = obj.errMsg;
                this.errTime = obj.errTime;
            }
        }
        this.createdTime = new Date();
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
            storeObj.xml = this.xml;
            storeObj.errMsg = this.errMsg;
            storeObj.errTime = this.errTime;
            storeObj.createdTime = this.createdTime;
            return storeObj;
        } else {
            return null;
        }
    }

    generateStoreObjectWithoutID() {
        if (this.id) {
            const storeObj = {};
            storeObj.url = this.url;
            storeObj.xml = this.xml;
            storeObj.errMsg = this.errMsg;
            storeObj.errTime = this.errTime;
            storeObj.createdTime = this.createdTime;
            return storeObj;
        } else {
            return null;
        }
    }
}
