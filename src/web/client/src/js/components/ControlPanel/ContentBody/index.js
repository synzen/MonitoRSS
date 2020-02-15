import React from 'react'
import { Switch, Route, useHistory } from 'react-router-dom'
import styled from 'styled-components'
import Home from './Main/Home/index'
import Feeds from './Server/Feeds/index'
import Settings from './Server/Settings/index'
import Message from './Feed/Message/index'
import Filters from './Feed/Filters/index'
import Subscribers from './Feed/Subscribers/index'
import MiscOptions from './Feed/MiscOptions/index'
// import Debugger from './Feed/Debugger/index'
import { useDispatch } from 'react-redux'
import pages from '../../../constants/pages';
import { Scrollbars } from 'react-custom-scrollbars';
import { changePage } from 'js/actions/page'

const Body = styled.div`
  height: 100%;
  width: 100%;
  background-color: #202225;
  /* overflow-y: auto; */
  /* scrollbar-width: thin; */
`


function ContentBody () {
  const history = useHistory()
  const dispatch = useDispatch()

  function redirect (page) {
    dispatch(changePage(page))
    history.push(page)
  }

  return (
    <Body>
      {/* <Notice>Hello!</Notice> */}
      <Scrollbars>
        <Switch>
          <Route exact path={pages.DASHBOARD} render={routerProps => <Home redirect={redirect} {...routerProps} />}/>
          <Route exact path={pages.FEEDS} render={routerProps => <Feeds redirect={redirect} {...routerProps} />} />
          <Route exact path={pages.SERVER_SETTINGS} render={routerProps => <Settings {...routerProps} />} />
          <Route exact path={pages.MESSAGE} render={routerProps => <Message {...routerProps} />} />
          <Route exact path={pages.FILTERS} render={routerProps => <Filters {...routerProps} />} />
          <Route exact path={pages.SUBSCRIBERS} render={routerProps => <Subscribers {...routerProps} />} />
          <Route exact path={pages.MISC_OPTIONS} render={routerProps => <MiscOptions {...routerProps} />} />
          {/* <Route exact path={pages.DEBUGGER} component={routerProps => <Debugger {...routerProps} />} /> */}
          <Route render={routerProps => <Home {...routerProps} />} />
        </Switch>
      </Scrollbars>
    </Body>
  )
}

export default ContentBody
