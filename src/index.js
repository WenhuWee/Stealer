import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { Router, Redirect, browserHistory } from 'react-router';
import injectTapEventPlugin from 'react-tap-event-plugin';
import { syncHistoryWithStore } from 'react-router-redux';
import DevTools from './DevTools';

import configureStore from './store/configureStore';
import routes from './routes';
import './style.scss';

injectTapEventPlugin();
const store = configureStore();
const history = syncHistoryWithStore(browserHistory, store);

function renderDevTool() {
    if (process.env.NODE_ENV !== 'production') {
        return (
            <DevTools />
        );
    } else {
        return null;
    }

}

ReactDOM.render(
    <Provider store={store}>
        <div>
            <Router history={history}>
                <Redirect from="/" to="home" />
                {routes}
            </Router>
            {renderDevTool()}
        </div>
    </Provider>,
    document.getElementById('root')
);
