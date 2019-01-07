import React, { Component } from 'react'
import colors from '../../constants/colors'
import styled from 'styled-components'
import { lighten, darken } from 'polished'
import Dashboard from './Dashboard/index'
import Filters from './Filters/index'
import Subscriptions from './Subscriptions/index'
import FAQ from './FAQ/index'
import Support from './Support/index'
import MiscOptions from './MiscOptions/index'
import { Switch, Route, withRouter } from 'react-router-dom'
import { Button, Dropdown } from 'semantic-ui-react'
import { connect } from 'react-redux'
import PropTypes from 'prop-types'
import { setActiveGuild } from '../../actions/index-actions'

const mapStateToProps = state => {
  return {
    guildId: state.activeGuild,
    guilds: state.guilds
  }
}

const mapDispatchToProps = dispatch => {
  return {
    setActiveGuild: guildId => dispatch(setActiveGuild(guildId))
  }
}

const Body = styled.div`
  padding-top: 20;
  height: 100vh;
  width: 100%;
  background-color: ${lighten(0.05, colors.discord.notQuiteblack)};
  text-align: center;
  overflow-y: auto;
`

const TitleContainer = styled.div`
  display: flex;
  justify-content: space-between;
  position: relative;
  z-index: 10;
  padding-left: 2em;
  padding-right: 2em;
  height: 5em;
  box-shadow: 0 2px 0px 0 rgba(0,0,0,0.2);
  align-items: center;
  > div {
    display: flex;

  }
  h3 {
    margin: 0;
    color: ${darken(0.2, 'white')};
    align-self: center;
    margin-right: 2em;
  }
`

const ServerDropdown = styled(Dropdown)`
  font-size: 1.25em !important;

`

class ContentBody extends Component {
  constructor () {
    super()
    this.state = {

    }
  }

  render () {
    const { guildId, guilds } = this.props
    const dropdownOptions = []
    for (const id in guilds) {
      dropdownOptions.push({ text: guilds[id].name, value: id })
    }

    return (
      <Body>
        {/* <TopNavBar /> */}
        <TitleContainer>
          <div>
            {/* <h3>{guild ? guild.name : 'No Server Selected'}</h3> */}
            {/* <Dropdown search selection defaultValue={'szdoighjo'} options={dropdownDummyOptions} /> */}

            <ServerDropdown options={dropdownOptions} search selection value={guildId} onChange={(e, data) => this.props.setActiveGuild(data.value)} />
          </div>
          <h3>Status</h3>
        </TitleContainer>
        <Switch>
          <Route exact path='/' component={Dashboard} />
          <Route exact path='/filters' component={Filters} />
          <Route exact path='/subscriptions' component={Subscriptions} />
          <Route exact path='/miscoptions' component={MiscOptions} />
          <Route exact path='/faq' component={FAQ} />
          <Route exact path='/support' component={Support} />
          <Route component={Dashboard} />
        </Switch>
        {/* <Dashboard /> */}
        {/* <BodyTop>Hello world</BodyTop> */}
        {/* Hello World */}
      </Body>
    )
  }
}

ContentBody.propTypes = {
  guildId: PropTypes.string,
  guilds: PropTypes.object
}

export default connect(mapStateToProps, mapDispatchToProps)(ContentBody)
