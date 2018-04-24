
const KerasJS = require('keras-js');
const Jimp = require('jimp');
const ndarray = require('ndarray');
const ops = require('ndarray-ops');

export class kerasCaptcha {

    constructor() {
        this.model = new KerasJS.Model({
            filepath: './captcha/my_model.bin',
            filesystem: true,
        });
    }

    predict(url, callback) {
        Jimp.read('./captcha/sample/prwh.jpg', (err, image) => {
            if (err) throw err;
        
            const resizeImg = image.resize(120, 50);
        
            const imageArr = ndarray(new Float32Array(resizeImg.bitmap.data), [120, 50, 4]);
            // imageArr = imageArr.transpose(1, 0, 2);
            ops.divseq(imageArr, 255);
        
            const uniArrImg = ndarray(new Float32Array(50 * 120 * 3), [120, 50, 3]);
            ops.assign(uniArrImg.pick(null, null, 0), imageArr.pick(null, null, 0));
            ops.assign(uniArrImg.pick(null, null, 1), imageArr.pick(null, null, 1));
            ops.assign(uniArrImg.pick(null, null, 2), imageArr.pick(null, null, 2));
        
            model.ready().then(() => {
                const inputData = {
                    input_1: uniArrImg.data,
                };
                return model.predict(inputData);
            }).then((outputData) => {
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
                console.log(chars);
            }).catch((modelErr) => {
                console.log(modelErr);
            });
        });
    }
}

