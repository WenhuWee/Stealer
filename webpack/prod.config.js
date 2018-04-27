const webpack = require('webpack');

module.exports = {
    mode: 'production',
    devtool: 'source-map',

    output: {
        publicPath: 'dist/',
    },

    plugins: [
    ],
    optimization: {
        minimize: true,
    }
};
