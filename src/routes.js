/* eslint new-cap: 0 */

import React from 'react';
import { Router, Route, hashHistory } from 'react-router';

/* containers */
import { App } from './containers/App';
import HelpView from './components/HelpView.jsx';

export default (
    <Route path="/" component={App}>
        <Route path="*" component={HelpView} />
    </Route>
);
