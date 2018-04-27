
import { funcCheck, safeJSONParse } from '../utils/misc';
import { FeedStoreModel } from '../model/FeedStoreModel';

const Path = require('path');
const Nedb = require('nedb');
const FS = require('fs');
const LevelDB = require('level');

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
            this._clearDB();
        }

        const appPath = Path.resolve('./');
        const dirPath = Path.join(appPath, 'data');
        const dbPath = Path.join(dirPath, `${filePrefix}db`);
        this.leveldb = new LevelDB(dbPath);

        const cookiesdbPath = Path.join(dirPath, `${cookiesFilePrefix}db`);
        this.cookiesdb = new Nedb({ filename: cookiesdbPath, autoload: true });

        // this._initTestData();
    }

    _clearDB() {
        const appPath = Path.resolve('./');
        const dirPath = Path.join(appPath, 'data');
        const dbPath = Path.join(dirPath, `${filePrefix}db`);

        const rimraf = require('rimraf');
        rimraf.sync(dbPath);

        const cookiesdbPath = Path.join(dirPath, `${cookiesFilePrefix}db`);
        FS.unlink(cookiesdbPath, () => {
        });
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

    delRSSSource(id, url, callback) {
        if (!callback) {
            return;
        }
        if (!id && !url) {
            callback(Error("no id and url"));
            return;
        }

        this.getRSSSource(id, url, (source)=>{
            if (source && source.id) {
                this.leveldb.del(source.id, function (err) {
                    callback(err, source);
                });
            } else {
                callback(Error('no Item'), null);
            }
        });
    }

    updateLastVisitedDate(id, url, lastVisitedDate) {
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

    updateTimerInterval(id, url, interval, callback) {
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

        this.setRSSSource(source, (err, source) =>{
            callback(err, source);
        })
    }

    setRSSSource(source, callback) {
        if (source instanceof FeedStoreModel && source.isValid()) {
            const leveldb = this.leveldb;

            this.leveldb.get(source.id, function (err, value) {
                let mergedSource = source;
                if (value) {
                    const valueObj = safeJSONParse(value);
                    const oldSource = new FeedStoreModel(valueObj);
                    mergedSource = oldSource.merge(mergedSource);
                }
                const res = mergedSource.generateStoreObjectWithID();
                const resJson = JSON.stringify(res)
                leveldb.put(source.id, resJson, function (err) {
                    if (callback) {
                        callback(err, mergedSource);
                    }
                })
            })
        }
    }

    getRSSSource(id, url, callback) {
        if (callback && (id || url)) {
            let searchObj = {};
            if (id) {
              searchObj['_id'] = id;
            }else if (url) {
              searchObj['url'] = url;
            }
            let identifier = id;
            if (!identifier) {
                identifier = url;
            }

            this.leveldb.get(identifier, function (err, value) {
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

    getCookies(host, pathName, callback){
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

    setCookies(host, pathName, cookies) {
        if (host && pathName && cookies) {
            const id = `${host}${pathName}`;
            const insertRes = {'_id':id, 'host':host, 'path':pathName, 'cookies':cookies};
            this.cookiesdb.insert(insertRes, (insertErr, insertNewDocs) => {
                if (insertNewDocs) {

                }
            });
        }
    }

    _initTestData() {

    }
}
