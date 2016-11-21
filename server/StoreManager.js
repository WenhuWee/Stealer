
import { funcCheck, safeJSONParse } from '../utils/misc.js';

const Path = require('path');
const FS = require('fs');
const Nedb = require('nedb');

let instance = null;

const filePrefix = 'daza_';

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
        this.dirPath = Path.join(appPath, 'data');
        try {
            FS.accessSync(this.dirPath, FS.F_OK);
        } catch (err) {
            try {
                FS.mkdirSync(this.dirPath);
            } catch (e) {
                throw Error('Can not Find "./data" Dir');
            }
        }

        // this._initTestData();
    }

    _initTestData() {

    }
}
