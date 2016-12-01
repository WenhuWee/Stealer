
import { funcCheck, safeJSONParse } from '../utils/misc.js';

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
        this.db.find({}).projection({ url: 1 }).exec((err, docs) => {
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

    setRSSSource(url, xml) {
        if (url && xml && this.db) {
            this.db.find({ _id: url }, (err, docs) => {
                if (docs.length) {
                    this.db.update({ _id: url }, { url, xml }, {}, (updateErr, updateNewDocs) => {
                        if (updateNewDocs) {

                        }
                    });
                } else {
                    this.db.insert({ _id: url, url, xml }, (insertErr, insertNewDocs) => {
                        if (insertNewDocs) {

                        }
                    });
                }
            });
        }
    }

    getRSSXML(url, callback) {
        if (url && callback && this.db) {
            this.db.find({ url }, (err, docs) => {
                if (docs.length) {
                    const item = docs[0];
                    const xml = item.xml;
                    callback(xml);
                } else {
                    callback(null);
                }
            });
        }
    }

    _initTestData() {

    }
}
