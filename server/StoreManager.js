
import { funcCheck, safeJSONParse } from '../utils/misc';
import { FeedStoreModel } from '../model/FeedStoreModel';

const Path = require('path');
const Nedb = require('nedb');
const FS = require('fs');

let instance = null;

const filePrefix = 'Stealer_';
const cookiesFilePrefix = 'Stealer_cookies_';

export default class StoreManager {
    static instance() {
        if (!instance) {
            instance = new StoreManager();
            instance.init();
        }
        return instance;
    }

    init() {
        if (process.env.NODE_ENV !== 'production') {
            // this._clearDB();
        }

        const appPath = Path.resolve('./');
        const dirPath = Path.join(appPath, 'data');
        const dbPath = Path.join(dirPath, `${filePrefix}db`);
        this.db = new Nedb({ filename: dbPath, autoload: true });

        const cookiesdbPath = Path.join(dirPath, `${cookiesFilePrefix}db`);
        this.cookiesdb = new Nedb({ filename: cookiesdbPath, autoload: true });

        // this._initTestData();
    }

    _clearDB() {
        const appPath = Path.resolve('./');
        const dirPath = Path.join(appPath, 'data');
        const dbPath = Path.join(dirPath, `${filePrefix}db`);
        FS.unlink(dbPath, () => {
        });

        const cookiesdbPath = Path.join(dirPath, `${cookiesFilePrefix}db`);
        FS.unlink(cookiesdbPath, () => {
        });
    }

    getAllDocs(callback) {
        if (!callback) {
            return;
        }
        this.db.find({}, (err, docs) => {
            callback(docs);
        });
    }

    getAllURL(callback) {
        if (!callback) {
            return;
        }
        this.db.find({ }).projection({ url: 1 , updatedTime: 1, interval:1}).exec((err, docs) => {
            if (!err) {
                callback(docs);
            }
            callback([]);
        });
    }

    delRSSSource(id:string, url:string, callback) {
        if (!callback) {
            return;
        }
        if (!id && !url) {
            callback(Error("no id and url"));
            return;
        }

        let searchObj = {};
        if (id) {
            searchObj['_id'] = id;
        }else if (url) {
            searchObj['url'] = url;
        }

        this.db.find(searchObj, (err, docs) => {
            if (docs.length) {
                const item = docs[0];
                const feedModel = new FeedStoreModel(item);
                this.db.remove({'_id':feedModel.id}, {}, (err) => {
                    callback(err,feedModel);
                });
            } else {
                callback(Error('no Item'),null);
            }
        });
    }

    updateLastVisitedDate(id:String,url:String,lastVisitedDate:Date) {
        if ((!id && !url) || !lastVisitedDate) {
            return;
        }
        let searchObj = {};
        if (id) {
            searchObj['_id'] = id;
        }else if (url) {
            searchObj['url'] = url;
        }
        this.db.update(searchObj, {$set:{lastVisitedDate:lastVisitedDate}}, {}, (updateErr, updateNewDocs) => {
            if (updateNewDocs) {

            }
        });
    }

    updateTimerInterval(id:String,url:String,interval:Number,callback) {
        if (!callback) {
            return;
        }
        if ((!id && !url) || !interval) {
            return;
        }
        let searchObj = {};
        if (id) {
            searchObj['_id'] = id;
        }else if (url) {
            searchObj['url'] = url;
        }
        this.db.update(searchObj, {$set:{interval:interval}}, {returnUpdatedDocs:true,multi:true}, (updateErr,updateNum, updateNewDocs) => {
            if (updateNewDocs.length) {
                const item = updateNewDocs[0];
                const feedModel = new FeedStoreModel(item);
                callback(updateErr,item);
            } else {
                callback(updateErr,null);
            }
        });
    }

    setRSSSource(source:FeedStoreModel) {
        if (source instanceof FeedStoreModel && source.isValid()) {
            this.db.find({ _id: source.id }, (err, docs) => {
                if (docs.length) {
                    const updateRes = source.generateStoreObjectWithoutID();
                    this.db.update({ _id: source.id }, {$set:updateRes}, {}, (updateErr, updateNewDocs) => {
                        if (updateNewDocs) {

                        }
                    });
                } else {
                    const insertRes = source.generateStoreObjectWithID();
                    this.db.insert(insertRes, (insertErr, insertNewDocs) => {
                        if (insertNewDocs) {

                        }
                    });
                }
            });
        }
    }

    getRSSSource(id,url, callback) {
        if (callback && this.db && (id || url)) {
          let searchObj = {};
          if (id) {
              searchObj['_id'] = id;
          }else if (url) {
              searchObj['url'] = url;
          }

            this.db.find(searchObj, (err, docs) => {
                if (docs.length) {
                    const item = docs[0];
                    const feedModel = new FeedStoreModel(item);
                    callback(feedModel);
                } else {
                    callback(null);
                }
            });
        }
    }

    getCookies(host,pathName,callback){
        if (callback) {
            const searchObj = {};
            if (host && pathName) {
                const id = `${host}${pathName}`;
                searchObj['_id'] = id;
            }
            this.cookiesdb.find(searchObj, (err, docs) => {
                if (docs.length) {
                    callback(docs);
                } else {
                    callback(null);
                }
            });
        }
    }

    setCookies(host,pathName,cookies) {
        if (host && pathName && cookies) {
            const id = `${host}${pathName}`;
            const insertRes = {'_id':id,'host':host,'path':pathName,'cookies':cookies};
            this.cookiesdb.insert(insertRes, (insertErr, insertNewDocs) => {
                if (insertNewDocs) {

                }
            });
        }
    }

    _initTestData() {

    }
}
