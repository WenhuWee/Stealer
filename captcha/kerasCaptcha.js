
import { devLog } from '../utils/misc';

const KerasJS = require('keras-js');
const Jimp = require('jimp');
const ndarray = require('ndarray');
const ops = require('ndarray-ops');
const Request = require('request');
const FS = require('fs');


export default class KerasCaptcha {

    constructor() {
        const self = this;
        self.predicting = false;
        self.shouldWriteCaptcha = true;
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

        FS.readdir('./captchaSample/', (err, files) => {
            if (files.length > 10000) {
                self.shouldWriteCaptcha = false;
            }
        });

        self.predicting = true;
        const callbackSet = (success, err) => {
            self.predicting = false;
            callback(success, err);
        };

        const predictBlock = (index) => {
            const cert = new Date().getTime() + Math.random();
            const codeURL = `https://mp.weixin.qq.com/mp/verifycode?cert=${cert}`;

            devLog(index);
            devLog(codeURL);

            const options = {
                method: 'GET',
                url: 'https://mp.weixin.qq.com/mp/verifycode',
                qs: { cert: cert },
                encoding: null,
            };
            Request(options, (imgeError, imgResponse, imgBody) => {
                if (imgeError || !imgBody) {
                    predictBlock(index + 1);
                    return;
                }

                let cookie = '';
                if (imgResponse.headers['set-cookie']) {
                    cookie = imgResponse.headers['set-cookie'].join(';');
                }

                self.predict(codeURL, imgBody, (chars, image, predictErr) => {
                    if (!chars) {
                        predictBlock(index + 1);
                    } else {
                        const params = {
                            cert: cert,
                            input: chars,
                        };
                        let name = chars;
                        if (!name) {
                            name = Math.random();
                        }
                        devLog(params);

                        const postOptions = {
                            method: 'POST',
                            url: 'https://mp.weixin.qq.com/mp/verifycode',
                            headers: {
                                Accept: 'application/json',
                                'Content-Type': 'application/x-www-form-urlencoded',
                                Cookie: cookie,
                            },
                            form: { input: chars, cert: chars },
                        };

                        Request(postOptions, (error, response, body) => {
                            devLog(body);
                            let bodyObj = null;
                            try {
                                bodyObj = JSON.parse(body);
                            } catch (parseErr) { }

                            if (bodyObj && bodyObj.ret !== 501) {
                                if (bodyObj.ret === 0) {
                                    if (self.shouldWriteCaptcha) {
                                        image.write(`./captchaSample/${name}.jpg`);
                                    }
                                    callbackSet(true, null);
                                } else {
                                    if (self.shouldWriteCaptcha) {
                                        image.write(`./captchaSample/${cert}.jpg`);
                                    }
                                    callbackSet(false, null);
                                }
                            } else {
                                if (index < count) {
                                    predictBlock(index + 1);
                                } else {
                                    callbackSet(false, null);
                                }
                                if (self.shouldWriteCaptcha) {
                                    image.write(`./captchaSample/${cert}.jpg`);
                                }
                            }
                        });
                    }
                });
            });
        };
        predictBlock(0);
    }

    predict(url, img, callback) {
        if (!this.model) {
            callback(null, null, 'waiting initialization');
            return;
        }

        const self = this;

        let readParams = url;
        if (img) {
            readParams = img;
        }

        Jimp.read(readParams, (err, image) => {
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
                input_1: uniArrImg.data,
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
                        }
                        return p;
                    });
                    labels.push(maxI);
                });
                const chars = labels.map(x => String.fromCharCode(97 + x));
                callback(chars.join(''), image, null);
            }).catch((modelErr) => {
                callback(null, image, modelErr);
            });
        });
    }
}
