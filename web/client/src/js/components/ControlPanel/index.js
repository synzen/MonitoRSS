import React from 'react'
import axios from 'axios'
import { ToastContainer } from 'react-toastify'
import styled from 'styled-components'
import LeftMenu from './LeftMenu/index'
import ContentBody from './ContentBody/index'
import { connect } from 'react-redux'
import colors from 'js/constants/colors'
import PropTypes from 'prop-types'
import { clearGuild, updateGuildAfterWebsocket, changePage, initState, updateLinkStatus, updateGuildLimits, updateSourceSchedule } from 'js/actions/index-actions'
import openSocket from 'socket.io-client'
import socketStatus from 'js/constants/socketStatus'
import { Loader, Icon, Button } from 'semantic-ui-react'
import TopBar from './TopBar/index'
import DiscordModal from './utils/DiscordModal';
import modal from './utils/modal'

var socket

const MainContainer = styled.div`
  width: 100vw;
  height: 100vh;
  max-width: 100%;
  display: flex;
  flex-direction: row;
  padding-top: 4em;
  @media screen and (min-height: 400px) and (min-width: 525px) {
    padding-top: 5em;
  }
`

const EmptyBackground = styled.div`
  height: 100vh;
  width: 100vw;
  background-color: #282b30;
  display: flex;
  flex-direction: column;
  justify-content: center;
  text-align: center;
  align-items: center;
  h1 {
    color: white;
  }
  color: ${colors.discord.text};
`

const EmptyBackgroundTransparent = styled(EmptyBackground)`
  display: ${props => props.visible ? 'flex' : 'none'};
  position: absolute;
  background: rgba(40, 43, 48, .85);
  z-index: 99999;
  padding: 20px;
  > h1 {
    color: ${colors.discord.red};
  }
`

const mapStateToProps = state => {
  return {
    guilds: state.guilds,
    feeds: state.feeds,
    modalOpen: state.modalOpen,
    modal: state.modal
  }
}

const mapDispatchToProps = dispatch => {
  return {
    initializeState: data => dispatch(initState(data)),
    clearGuild: guildId => dispatch(clearGuild(guildId)),
    updateGuildAfterWebsocket: guildRss => dispatch(updateGuildAfterWebsocket(guildRss)),
    changePage: page => dispatch(changePage(page)),
    updateLinkStatus: data => dispatch(updateLinkStatus(data)),
    updateGuildLimits: limits => dispatch(updateGuildLimits(limits)),
    updateSourceSchedule: data => dispatch(updateSourceSchedule(data))
  }
}

class ControlPanel extends React.PureComponent {
  constructor () {
    super()
    this.state = {
      loaded: false,
      leftMenuExpanded: window.innerWidth >= 860,
      leftMenu300Width: window.innerWidth >= 860,
      socketStatus: socketStatus.CONNECTING,
      authenticatingLogin: true,
      loggedOut: true,
      errorMessage: ''
    }

    this.notificationDOMRef = React.createRef()
  }

  socketConnected = () => {
    console.log('[WEBSOCKET] Connected')
    this.setState({ socketStatus: socketStatus.CONNECTED })
  }

  socketDisconnected = reason => {
    console.log('[WEBSOCKET] Disconnected')
    setTimeout(() => {
      // Set a timeout to ignore refreshes which will auto disconnect the socket
      if (!socket.disconnected) return
      this.setState({ socketStatus: socketStatus.DISCONNECTED })
      if (reason === 'io server disconnect') socket.connect()
    }, 3000)
  }

  socketReconnect = attemptNum => {
    console.log('[WEBSOCKET] Reconnected')
    this.setState({ loaded: false })
    this.initialize()
    // for (const guildId in guilds) socket.emit('identify', guildId)
  }

  componentWillMount () {
    const socketUrl = `${window.location.protocol}//${window.location.hostname}${window.location.port ? `:${window.location.port}` : ''}`
    if (!socket) socket = openSocket(socketUrl, { forceNew: false })
    socket.on('DRSS_PROFILE_UPDATE', message => {
      this.updateGuildInState(JSON.parse(message))
    })
    socket.on('DRSS_SOURCE_SCHEDULE_UPDATE', message => {
      this.updateSourceSchedule(JSON.parse(message))
    })
    socket.on('linkStatus', message => this.linkStatusUpdate(JSON.parse(message)))
    socket.on('guildLimitsUpdate', message => this.guildLimitsUpdate(JSON.parse(message)))

    socket.on('disconnect', this.socketDisconnected)
    socket.on('connect', this.socketConnected)
    socket.on('reconnect', this.socketReconnect)
    axios.get('/api/authenticated').then(({ data }) => {
      if (data.authenticated) this.initialize()
      else this.setState({ authenticatingLogin: false })
    }).catch(err => {
      const errMessage = err.response && err.response.data && err.response.data.message ? err.response.data.message : err.response && err.response.data ? err.response.data : err.message
      this.setState({ errorMessage: errMessage })
    })
  }

  componentWillUnmount () {
    if (socket) {
      socket.removeEventListener('disconnect', this.socketDisconnected)
      socket.removeEventListener('connect', this.socketConnected)
      socket.removeEventListener('reconnect', this.socketReconnect)
      window.removeEventListener("resize", this.updateDimensions)
    }
  }

  initialize = () => {
    const localGuildId = window.localStorage.getItem('guildId')
    const localFeedId = window.localStorage.getItem('feedId')

    const state = {
      user: null,
      bot: null,
      defaultConfig: null,
      guilds: {}, // By guild id
      feeds: {}, // by guild id, then by feed id
      filters: {}, // by guild id, then by feed id
      subscribers: {}, // by guild id, then by feed id, then by subscriber id
      channels: {}, // by guild id, then by channel id
      roles: {},
      guildLimits: {},
      embeds: {},
      messages: {},
      linksStatus: {},
      refreshRates: {},
      guildId: '',
      feedId: '',
      guild: null,
      feed: null,
      modalContent: null,
      cpResponse: null
    }

    axios.get('/api/cp').then(({ data }) => {
      const { defaultConfig, user, bot, guilds, linksStatus, csrfToken } = data
      state.cpResponse = data
      state.linksStatus = linksStatus
      state.defaultConfig = defaultConfig
      state.user = user
      state.bot = bot
      state.csrfToken = csrfToken
      for (const guildId in guilds) {
        socket.emit('identify', guildId)
        const guild = guilds[guildId]
        const { discord, profile, maxFeeds, roles, channels } = guild
        state.guilds[guildId] = { ...discord }
        state.feeds[guildId] = {}
        state.embeds[guildId] = {}
        state.messages[guildId] = {}
        state.roles[guildId] = {}
        state.channels[guildId] = {}
        state.subscribers[guildId] = {}
        state.filters[guildId] = {}
        state.refreshRates[guildId] = {}
        state.guildLimits[guildId] = maxFeeds
        
        for (const keyName in profile) {
          const value = profile[keyName]
          if (typeof value !== 'object' && value !== undefined) state.guilds[guildId][keyName] = value
          if (keyName !== 'sources') continue
          const rssList = value
          for (const rssName in rssList) {
            const source = rssList[rssName]
            source.rssName = rssName
            const copy = JSON.parse(JSON.stringify(source))
            if (guildId === localGuildId && rssName === localFeedId) {
              state.feedId = rssName
              state.feed = copy
            }
            state.feeds[guildId][rssName] = copy
            state.embeds[guildId][rssName] = source.embeds
            state.messages[guildId][rssName] = source.message

            // Feed Filters
            if (source.filters) state.filters[guildId][rssName] = source.filters

            // Feed Subscriptions
            state.subscribers[guildId][rssName] = {}
            if (source.subscribers && source.subscribers.length > 0) {
              for (const subscriber of source.subscribers) {
                state.subscribers[guildId][rssName][subscriber.id] = subscriber
              }
            }
          }
        }
        if (guildId === localGuildId) {
          state.guildId = guildId
          state.guild = { ...state.guilds[guildId] }
        }
        for (const channel of channels) state.channels[guildId][channel.id] = channel
        for (const role of roles) state.roles[guildId][role.id] = role
      }
      this.props.initializeState(state)
      window.addEventListener("resize", this.updateDimensions)
      this.setState({ loaded: true, loggedOut: false, authenticatingLogin: false })
    }).catch(err => {
        const errMessage = err.response && err.response.data && err.response.data.message ? err.response.data.message : err.response && err.response.data ? err.response.data : err.message
        if (err.response && err.response.status === 401) {
          if (err.response.data && err.response.data.code === 9999) this.setState({ errorMessage: errMessage })
          else this.setState({ loggedOut: true })
        } else {
          console.log(err.response || err.message, err)
          this.setState({ errorMessage: errMessage })
        }
    })
  }

  updateDimensions = () => {
    const newState = {}
    if (window.innerWidth < 860) {
      // if (this.state.leftMenuExpanded) newState.leftMenuExpanded = false
      if (this.state.leftMenu300Width) newState.leftMenu300Width = false
    } else {
      if (!this.state.leftMenuExpanded) newState.leftMenuExpanded = true
      if (!this.state.leftMenu300Width) newState.leftMenu300Width = true
    }
    if (Object.keys(newState).length > 0) this.setState(newState)
  }

  linkStatusUpdate = statuses => {
    this.props.updateLinkStatus(statuses)
  }

  guildLimitsUpdate = limits => {
    this.props.updateGuildLimits(limits)
  }

  updateGuildInState = data => {
    const { feeds } = this.props
    const guildId = data.id
    console.log(`[WEBSOCKET] Guild ${guildId} was updated from Discord`)
    const guildRss = data.profile
    if (!guildRss) return this.props.clearGuild(guildId)
    const rssList = guildRss.sources
    if (rssList) {
      for (const rssName in rssList) {
        if (!feeds[rssName]) socket.emit('getLinkStatus', rssList[rssName].link) // Must be a new feed
      }
    }
    this.props.updateGuildAfterWebsocket(guildRss)
  }

  updateSourceSchedule = data => {
    this.props.updateSourceSchedule(data)
  }

  render () {
    if (this.state.errorMessage) return (
      <EmptyBackground>
        <div>
          <Icon name='x' size='massive' color='red' />
          <h1>Oops!<br/>Something went wrong!</h1>
          <h3>{this.state.errorMessage || ''}</h3>
          <Button basic fluid onClick={e => { window.location.href = '/logout' }} color='red'>Logout</Button>
          </div>
      </EmptyBackground>
    )
    if (!this.state.loaded) {
      if (!this.state.authenticatingLogin && this.state.loggedOut) {
        window.location.href = '/login'
      }
      return (
        // <Dimmer.Dimmable blurring dimmed={!this.state.loaded}>
        <EmptyBackground>
          <Loader inverted active={!this.state.loaded} size='massive'>Loading</Loader>
        </EmptyBackground>
        // </Dimmer.Dimmable>
      )
    }
    return (
      <div>
        <EmptyBackgroundTransparent visible={this.state.socketStatus === socketStatus.DISCONNECTED}>
          <Icon name='broken chain' size='massive' color='red' />
          <h1>Disconnected from Server</h1>
          <h3>My lifeline to the server has been severed! Access will be restored once my connection has been re-established.</h3>
        </EmptyBackgroundTransparent>
        <DiscordModal onClose={modal.hide} open={this.props.modalOpen} { ...this.props.modal.props }>{this.props.modal.children}</DiscordModal>
        <ToastContainer position='top-center' />
        <TopBar toggleLeftMenu={() => this.setState({ leftMenuExpanded: !this.state.leftMenuExpanded })} socketStatus={this.state.socketStatus} />
        <MainContainer>
          <LeftMenu disableMenuButtonToggle={this.state.leftMenu300Width} toggleLeftMenu={() => {
            this.setState({ leftMenuExpanded: !this.state.leftMenuExpanded })
          }} socketStatus={this.state.socketStatus} expanded={this.state.leftMenuExpanded} />
          <ContentBody />
        </MainContainer>
      </div>
    )
  }
}

ControlPanel.propTypes = {
  initializeState: PropTypes.func
}

export default connect(mapStateToProps, mapDispatchToProps)(ControlPanel)
