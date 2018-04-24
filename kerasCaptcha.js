const KerasJS = require('keras-js')
var Jimp = require("jimp");
var ndarray = require("ndarray")
var ops = require("ndarray-ops")

const model = new KerasJS.Model({
    filepath: './my_model.bin',
    filesystem: true
})

Jimp.read("zwoz.jpg", function (err, image) {
    if (err) throw err;

    resizeImg = image.resize(120, 50)

    console.log(resizeImg)

    imageArr = ndarray(new Float32Array(resizeImg.bitmap.data), [120, 50, 4])
    imageArr = imageArr.transpose(1,0,2)
    ops.divseq(imageArr, 255)

    uniArrImg = ndarray(new Float32Array(50 * 120 * 3),[50, 120, 3])
    ops.assign(uniArrImg.pick(null, null, 0), imageArr.pick(null, null, 0))
    ops.assign(uniArrImg.pick(null, null, 1), imageArr.pick(null, null, 1))
    ops.assign(uniArrImg.pick(null, null, 2), imageArr.pick(null, null, 2))

    console.log(uniArrImg.shape)

    model.ready().then(() => {
        const inputData = {
            input_1: uniArrImg.data
        }
        return model.predict(inputData)
    }).then(outputData => {
        console.log(outputData)
    }).catch(err => {
        console.log(err)
    })
});