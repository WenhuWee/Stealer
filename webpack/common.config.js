const path = require('path');
const autoprefixer = require('autoprefixer');
const postcssImport = require('postcss-import');
const merge = require('webpack-merge');
const ExtractTextPlugin = require('extract-text-webpack-plugin');

const development = require('./dev.config');
const production = require('./prod.config');


const TARGET = process.env.npm_lifecycle_event;

const PATHS = {
    app: path.join(__dirname, '../src'),
    build: path.join(__dirname, '../dist'),
};

process.env.BABEL_ENV = TARGET;

const common = {
    entry: {
        main: PATHS.app,
    },

    output: {
        path: PATHS.build,
        filename: 'bundle.js',
    },

    resolve: {
        modules: [
            'node_modules',
            PATHS.app,
        ],
        extensions: ['.jsx', '.js', '.json', '.scss'],
    },

    plugins: [
        // new ExtractTextPlugin('[name].bundle.css'),
    ],

    module: {
        rules: [{
            test: /\.jsx$/,
            loaders: ['babel-loader'],
            exclude: /node_modules/,
        }, {
            test: /\.js$/,
            loaders: ['babel-loader'],
            exclude: /node_modules/,
        }, {
            test: /\.png$/,
            loader: 'file?name=[name].[ext]',
        }, {
            test: /\.jpg$/,
            loader: 'file?name=[name].[ext]',
        }, {
            test: /\.scss$/,
            // use: ExtractTextPlugin.extract({
                // fallback: 'style-loader',
                use: [
                    'css-loader',
                    'sass-loader',
                ],
            // }),
        }, {
            test: /\.css$/,
            // use: ExtractTextPlugin.extract({
                // fallback: 'style-loader',
                use: [
                    'style-loader',
                    { loader: 'css-loader', options: { importLoaders: 1 } },
                    'postcss-loader',
                ],
            // }),
        }],
    },
};

if (process.env.NODE_ENV === 'production') {
    module.exports = merge(production, common);
} else {
    module.exports = merge(development, common);
}
