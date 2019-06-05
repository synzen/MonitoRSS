import React, { Component } from 'react'
import { withRouter } from 'react-router-dom'
import styled from 'styled-components'
import Home from './Main/Home/index'
import Feeds from './Server/Feeds/index'
import Settings from './Server/Settings/index'
import Message from './Feed/Message/index'
import Filters from './Feed/Filters/index'
import Subscriptions from './Feed/Subscriptions/index'
// import FAQ from './Information/FAQ/index'
import Support from './Information/Support/index'
import MiscOptions from './Feed/MiscOptions/index'
import { Switch, Route } from 'react-router-dom'
import { connect } from 'react-redux'
import { setActiveGuild } from '../../../actions/index-actions'
import pages from '../../../constants/pages';
import { changePage } from '../../../actions/index-actions'
import { Scrollbars } from 'react-custom-scrollbars';

const mapDispatchToProps = dispatch => {
  return {
    setActiveGuild: guildId => dispatch(setActiveGuild(guildId)),
    changePage: page => dispatch(changePage(page))
  }
}

const Body = styled.div`
  height: 100%;
  width: 100%;
  background-color: #36393f;
  /* overflow-y: auto; */
  /* scrollbar-width: thin; */
`

class ContentBody extends Component {
  constructor () {
    super()
    this.state = {

    }
  }

  redirect = page => {
    const { changePage } = this.props
    changePage(page)
    this.props.history.push(page)
  }

  render () {
    return (
      <Body>
        {/* <Notice>Hello!</Notice> */}
        <Scrollbars>
          <Switch>
            
            <Route exact path={pages.DASHBOARD} render={props => <Home redirect={this.redirect} />}/>
            <Route exact path={pages.FEEDS} render={props => <Feeds redirect={this.redirect} />} />
            <Route exact path={pages.SERVER_SETTINGS} component={Settings} />
            <Route exact path={pages.MESSAGE} component={Message} />
            <Route exact path={pages.FILTERS} component={Filters} />
            <Route exact path={pages.SUBSCRIPTIONS} component={Subscriptions} />
            <Route exact path={pages.MISC_OPTIONS} component={MiscOptions} />
            <Route exact path={pages.SUPPORT} component={Support} />
            <Route component={Home} />
          </Switch>
        </Scrollbars>
      </Body>
    )
  }
}

export default withRouter(connect(null, mapDispatchToProps)(ContentBody))
