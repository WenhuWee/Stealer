
import { funcCheck, safeJSONParse } from '../utils/misc';
import { FeedStoreModel } from '../model/FeedStoreModel';

const Path = require('path');
const Nedb = require('nedb');
const FS = require('fs');

let instance = null;

const filePrefix = 'Stealer_';

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
            this._clearDB();
        }

        const appPath = Path.resolve('./');
        const dirPath = Path.join(appPath, 'data');
        const dbPath = Path.join(dirPath, `${filePrefix}db`);
        this.db = new Nedb({ filename: dbPath, autoload: true });


        // this._initTestData();
    }

    _clearDB() {
        const appPath = Path.resolve('./');
        const dirPath = Path.join(appPath, 'data');
        const dbPath = Path.join(dirPath, `${filePrefix}db`);
        FS.unlink(dbPath, () => {
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
        const urls = [];
        this.db.find({ }).projection({ url: 1 }).exec((err, docs) => {
            if (!err) {
                docs.forEach((ele) => {
                    if (ele.url) {
                        urls.push(ele.url);
                    }
                });
            }
            callback(urls);
        });
    }

    delRSSSource(url:string, callback) {
        if (!url || !callback) {
            return;
        }

        this.db.remove({ _id: url }, {}, (err) => {
            callback(err);
        });
    }

    setRSSSource(source:FeedStoreModel) {
        if (source instanceof FeedStoreModel && source.isValid()) {
            this.db.find({ _id: source.id }, (err, docs) => {
                if (docs.length) {
                    const updateRes = source.generateStoreObjectWithoutID();
                    this.db.update({ _id: source.id }, updateRes, {}, (updateErr, updateNewDocs) => {
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

    getRSSSource(url, callback) {
        if (url && callback && this.db) {
            this.db.find({ _id: url }, (err, docs) => {
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

    _initTestData() {

    }
}
