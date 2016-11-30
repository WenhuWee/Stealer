
import { funcCheck, safeJSONParse } from '../utils/misc.js';

const Path = require('path');
const Nedb = require('nedb');

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
        const appPath = Path.resolve('./');
        const dirPath = Path.join(appPath, 'data');
        const dbPath = Path.join(dirPath, `${filePrefix}db`);
        this.db = new Nedb({ filename: dbPath, autoload: true });

        // this._initTestData();
    }

    setRSSSource(url, xml) {
        if (url && xml && this.db) {
            this.db.insert({ url, xml }, (err, newDocs) => {
                console.log(newDocs);
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
