
import { funcCheck, safeJSONParse } from '../utils/misc';
import { FeedStoreModel } from '../model/FeedStoreModel';

const Path = require('path');
const Nedb = require('nedb');
const FS = require('fs');
const LevelDB = require('levelup');

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
        this.leveldb = new LevelDB(dbPath);

        this.token = 27;
        this.shouldAutoUpdateToken = true;

        // this._initTestData();
    }

    _clearDB() {
        const appPath = Path.resolve('./');
        const dirPath = Path.join(appPath, 'data');
        const dbPath = Path.join(dirPath, `${filePrefix}db`);

        const rimraf = require('rimraf');
        rimraf.sync(dbPath);
    }

    getAllDocs(callback) {
        if (!callback) {
            return;
        }
        const res = [];
        this.leveldb.createReadStream()
            .on('data', function (data) {
                const valueObj = safeJSONParse(data.value);
                const oldSource = new FeedStoreModel(valueObj);
                res.push(oldSource);
            })
            .on('error', function (err) {
                callback(res);
            })
            .on('close', function () {
            })
            .on('end', function () {
                callback(res);
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

        this.getRSSSource(id,url,(source)=>{
            if (source && source.id) {
                this.leveldb.del(source.id, function (err) {
                    callback(err,source);
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

        const source = new FeedStoreModel();
        source.id = id;
        if (!id) {
            source.id = url;
        }
        source.url = url;
        source.lastVisitedDate = lastVisitedDate;

        this.setRSSSource(source);
    }

    updateTimerInterval(id:String,url:String,interval:Number,callback) {
        if (!callback) {
            return;
        }
        if ((!id && !url) || !interval) {
            return;
        }

        const source = new FeedStoreModel();
        source.id = id;
        if (!id) {
            source.id = url;
        }
        if (url) {
            source.url = url;
        }
        source.interval = interval;

        this.setRSSSource(source, (err, newSource) => {
            callback(err, newSource);
        });
    }

    setRSSSource(source:FeedStoreModel, callback) {
        if (source instanceof FeedStoreModel && source.isValid()) {
            const leveldb = this.leveldb;

            this.leveldb.get(source.id, (err, value) => {
                let mergedSource = source;
                if (value) {
                    const valueObj = safeJSONParse(value);
                    const oldSource = new FeedStoreModel(valueObj);
                    mergedSource = oldSource.merge(mergedSource);
                }
                if (mergedSource.interval == null) {
                    mergedSource.interval = 12;
                }
                const res = mergedSource.generateStoreObjectWithID();
                const resJson = JSON.stringify(res);
                leveldb.put(source.id, resJson, (err) => {
                    if (callback) {
                        callback(err, mergedSource);
                    }
                });
            });
        }
    }

    getRSSSource(id, url, callback) {
        if (callback && (id || url)) {
            const searchObj = {};
            if (id) {
                searchObj['_id'] = id;
            } else if (url) {
                searchObj['url'] = url;
            }
            let identifier = id;
            if (!identifier) {
                identifier = url;
            }

            this.leveldb.get(identifier, (err, value) => {
                if (value) {
                    const valueObj = safeJSONParse(value);
                    const oldSource = new FeedStoreModel(valueObj);
                    callback(oldSource);
                } else {
                    callback(null);
                }
            });
        }
    }

    _initTestData() {

    }
}
