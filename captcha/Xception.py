#!/usr/bin/env python3

from scipy import misc
import numpy as np
from keras.applications.xception import Xception,preprocess_input
from keras.models import load_model


model = load_model('/Users/ewenli/Stealer/captcha/model/my_model.h5')
img = '/Users/ewenli/Stealer/captcha/sample/cefb.jpg'

img_size = (50, 120)

inputs = []

input = misc.imresize(misc.imread(img), img_size)

inputs.append(input)
inputs = preprocess_input(np.array(inputs).astype(float))

output = model.predict(inputs)

chars = []
for char in output:
    chars.append(char.argmax(axis=1))

print(chars)
