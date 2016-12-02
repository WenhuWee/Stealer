
export class FeedStoreModel {
    id: string;
    url: string;
    xml: string;
    errMsg:string;
    errTime:Date;

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
    }

    isValid() {
        return Boolean(this.id);
    }

    generateStoreObjectWithID() {
        if (this.id) {
            const storeObj = { _id: this.id };
            storeObj.url = this.url;
            storeObj.xml = this.xml;
            storeObj.errMsg = this.errMsg;
            storeObj.errTime = this.errTime;
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
            return storeObj;
        } else {
            return null;
        }
    }
}
