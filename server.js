

import APIServer from './server/APIServer.js';
import * as utils from './utils/misc.js';

const Express = require('express');
const Http = require('http');
const Path = require('path');
const bodyParser = require('body-parser');

// ------------- web server ----------------

const apiServer = new APIServer();
const app = new Express();

if (process.env.NODE_ENV !== 'production') {
    app.use(require('morgan')('short'));
}

(function initWebpack() {
    if (process.env.NODE_ENV !== 'production') {
        const webpack = require('webpack');
        const webpackConfig = require('./webpack/common.config');

        const compiler = webpack(webpackConfig);

        app.use(require('webpack-dev-middleware')(compiler, {
            noInfo: true,
            publicPath: webpackConfig.output.publicPath,
        }));

        app.use(require('webpack-hot-middleware')(compiler, {
            log: utils.devLog,
            path: '/__webpack_hmr',
            heartbeat: 10 * 1000,
        }));
    }
}());

app.use(bodyParser.raw({ type: '*/*', inflate: false }));
app.use('/image', Express.static(Path.join(__dirname, '/resource/image/')));
app.use('/captchaSample', Express.static(Path.join(__dirname, '/captchaSample/')));

app.all(/^\/api\/(.*)/, (req, res) => {
    if (apiServer.matchAPIPattern(req.url)) {
        utils.devLog('-------API--------');
        apiServer.handleRequest(req, res);
    }
});

app.all(/.*/, (req, res) => {
    utils.devLog('--------WEB----------');
    res.sendFile(Path.join(__dirname, '/index.html'));
});

const PORT = process.env.PORT || 3333;

const server = Http.createServer(app);
server.listen(PORT, () => {
    const address = server.address();
    utils.devLog(`Web server listening on: ${address.address}:${address.port}`);
});
