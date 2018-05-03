
import * as utils from '../utils/misc.js';
const KerasJS = require('keras-js');
const Jimp = require('jimp');
const ndarray = require('ndarray');
const ops = require('ndarray-ops');
const Axios = require('axios');
const Querystring = require('querystring');
const Http = require("https");

export default class KerasCaptcha {

    constructor() {
        const self = this;
        self.predicting = false;
        const model = new KerasJS.Model({
            filepath: './captcha/model/my_model.bin',
            filesystem: true,
        });

        model.ready().then(() => {
            self.model = model;

            self.autoPredict(20, (success, err) => {
                console.log(success, err);
            });
        }).catch((err) => {});
    }

    autoPredict(count, callback) {
        const self = this;
        if (self.predicting) {
            callback(false, null);
            return;
        }
        self.predicting = true;
        const callbackSet = (success, err) => {
            self.predicting = false;
            callback(success, err);
        };

        const predictBlock = (index) => {
            const cert = new Date().getTime() + Math.random();
            const codeURL = `https://mp.weixin.qq.com/mp/verifycode?cert=${cert}`;

            console.log(index);
            console.log(codeURL);
            self.predict(codeURL, (chars, image, predictErr) => {
                if (chars) {
                    const params = {
                        'cert': cert,
                        input: chars,
                    };
                    let name = chars;
                    if (!name) {
                        name = Math.random();
                    }
                    const paramsString = Querystring.stringify(params);
                    console.log(paramsString);

                    Axios.post('https://mp.weixin.qq.com/mp/verifycode', paramsString).then((response) => {
                        console.log(response.data);
                        if (response.data && response.data.ret !== 501) {
                            if (response.data.ret === 0) {
                                image.write(`./captchaSample/${name}.jpg`);
                                callbackSet(true, null);
                            } else {
                                image.write(`./captchaSample/${cert}.jpg`);
                                callbackSet(false, null);
                            }
                        } else {
                            if (index < count) {
                                predictBlock(index + 1);
                            } else {
                                callbackSet(false, null);
                            }
                            image.write(`./captchaSample/${cert}.jpg`);
                        }
                    }).catch((error) => {
                        // console.log(error);
                    });
                    console.log(index, chars);
                }
            });
        };
        predictBlock(0);
    }

    predict(url, callback) {
        if (!this.model) {
            callback(null, null, 'waiting initialization');
            return;
        }

        const self = this;

        Jimp.read(url, (err, image) => {
            if (err) {
                callback(null, err);
                return;
            }

            const resizeImg = image.resize(120, 50);

            const imageArr = ndarray(new Float32Array(resizeImg.bitmap.data), [120, 50, 4]);
            // imageArr = imageArr.transpose(1, 0, 2);
            ops.divseq(imageArr, 255);

            const uniArrImg = ndarray(new Float32Array(50 * 120 * 3), [120, 50, 3]);
            ops.assign(uniArrImg.pick(null, null, 0), imageArr.pick(null, null, 0));
            ops.assign(uniArrImg.pick(null, null, 1), imageArr.pick(null, null, 1));
            ops.assign(uniArrImg.pick(null, null, 2), imageArr.pick(null, null, 2));

            const inputData = {
                input_1: uniArrImg.data
            };
            self.model.predict(inputData).then((outputData) => {
                const dense1 = outputData.dense_1;
                const dense2 = outputData.dense_2;
                const dense3 = outputData.dense_3;
                const dense4 = outputData.dense_4;

                const denses = [dense1, dense2, dense3, dense4];

                const labels = [];
                denses.forEach((dense) => {
                    let maxI = 0;
                    dense.reduce((p, n, i) => {
                        if (n > p) {
                            maxI = i;
                            return n;
                        } else {
                            return p;
                        }
                    });
                    labels.push(maxI);
                });
                const chars = labels.map((x) => {
                    return String.fromCharCode(97 + x);
                });
                callback(chars.join(''), image, null);
            }).catch((modelErr) => {
                callback(null, image, modelErr);
            });
        });
    }
}