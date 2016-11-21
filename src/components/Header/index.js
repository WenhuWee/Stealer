import React, { Component } from 'react';
import AppBar from 'material-ui/AppBar';
import FlatButton from 'material-ui/FlatButton';

export class Header extends Component {
    static contextTypes = {
        router: React.PropTypes.object,
    }

    render() {
        return (
            <header>
                <AppBar
                  title="RSS Fire Stealer"
                  iconElementLeft={<div />}
                  iconElementRight={
                      <div>
                          <FlatButton label="Home"
                            onClick={() => this.context.router.push('/')}
                          />
                      </div>
                    }
                />
            </header>

        );
    }
}
