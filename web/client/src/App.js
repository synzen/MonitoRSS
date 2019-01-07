import React, { Component } from 'react'
// import ReconnectingWebSocket from 'reconnecting-websocket'
import axios from 'axios'
import './js/index'
import './App.css'
import './App.scss'
import styled from 'styled-components'
import LeftMenu from './js/components/LeftMenu'
import ContentBody from './js/components/ContentBody/index'
import { connect } from 'react-redux'
// import 'semantic-ui-css/semantic.min.css'
import './semantic/dist/semantic.min.css'
import PropTypes from 'prop-types'
import Alert from 'react-s-alert'
import 'react-s-alert/dist/s-alert-default.css'
import 'react-s-alert/dist/s-alert-css-effects/scale.css'

const MainContainer = styled.div`
  width: 100vw;
  height: 100vh;
  max-width: 100%;
  display: flex;
  flex-direction: row;
`

const mapDispatchToProps = dispatch => {
  return {
    initializeState: data => dispatch({ type: 'INIT_STATE', data })
  }
}

class App extends Component {
  constructor () {
    super()

    this.state = {
      serverResponse: '',
      socketStatus: 'connecting...',
      socketError: undefined,
      loaded: false
    }

    const socket = new WebSocket('ws://localhost:8081/ping')
    this.socket = socket

    socket.onopen = event => {
      // console.log('socket open')
      // console.log(event)
      this.setState({ socketStatus: 'open', socketError: undefined })
    }

    socket.onerror = err => {
      // console.log('socket error')
      // console.log(err)
      this.setState({ socketStatus: 'error', socketError: err })
    }

    socket.onmessage = message => {
      // console.log('socket message')
      // console.log(message)
      this.setState({ serverResponse: message.data })
    }

    socket.onclose = event => {
      // console.log('socket closed')
      // console.log(event)
      this.setState({ socketStatus: 'closed', socketError: undefined })
    }


  }

  componentWillMount () {
    Promise.all([ axios.get('/api/users/@me'), axios.get('/api/users/@me/guilds') ])
      .then(([ userResp, guildResp ]) => {
        const guildList = guildResp.data
        const newState = {
          user: userResp.data,
          guilds: {}, // By guild id
          feeds: {}, // by guild id, with array of feeds
          filters: {}, // by guild id, then by feed id
          subscriptions: {}, // by guild id, then by feed id, with array of subscribers
          channels: {}, // by guild id, then by channel id
          activeGuild: ''
        }
        for (const guildData of guildList) {
          const guildRss = guildData.profile
          const guildDiscord = guildData.discord
          const guildId = guildDiscord.id
          if (!newState.activeGuild) {
            newState.activeGuild = guildId
            newState.channels[guildId] = {}
          }

          // Guild settings
          newState.guilds[guildId] = {
            icon: guildDiscord.icon,
            name: guildDiscord.name,
            owner: guildDiscord.owner,
            permissions: guildDiscord.permissions,
            sendAlertsTo: guildRss.sendAlertsTo,
            dateLanguage: guildRss.dateLanguage,
            dateFormat: guildRss.dateFormat,
            prefix: guildRss.prefix,
            timezone: guildRss.timezone
          }
          const rssList = guildRss.sources
          if (!rssList) continue
          for (const rssName in rssList) {
            const source = rssList[rssName]

            // Feeds
            if (!newState.feeds[guildId]) newState.feeds[guildId] = []
            newState.feeds[guildId].push({
              rssName,
              title: source.title,
              channel: source.channel,
              link: source.link,
              channelName: source.channelName,
              checkTitles: source.checkTitles,
              imgPreviews: source.imgPreviews,
              imgLinksExistence: source.imgLinksExistence,
              checkDates: source.checkDates,
              formatTables: source.formatTables,
              toggleRoleMentions: source.toggleRoleMentions
            })

            // Feed Filters
            if (source.filters) newState.filters[guildId][rssName] = source.filters

            // Feed Subscriptions
            if ((source.globalSubscriptions && source.globalSubscriptions.length > 0) || (source.filteredSubscriptions && source.filteredSubscriptions.length > 0)) {
              if (!newState.subscriptions[guildId]) newState.subscriptions[guildId] = {}
              if (!newState.subscriptions[guildId][rssName]) newState.subscriptions[guildId][rssName] = []
              if (source.globalSubscriptions) newState.subscriptions[guildId][rssName] = newState.subscriptions[guildId][rssName].concat(source.globalSubscriptions)
              if (source.filteredSubscriptions) newState.subscriptions[guildId][rssName] = newState.subscriptions[guildId][rssName].concat(source.filteredSubscriptions)
            }
          }
        }

        // if (newState.activeGuild) {
        //   console.log('active guild', newState.activeGuild)
        //   axios.get(`/api/guilds/${newState.activeGuild}/channels`)
        //     .then(({ data }) => {
        //       for (const channel of data) newState.channels[newState.activeGuild][channel.id] = channel
        //       this.props.initializeState(newState)
        //       this.setState({ loaded: true })
        //     }).catch(err => {
        //       console.log(err.response || err.message)
        //     })
        // } else {
        this.props.initializeState(newState)
        this.setState({ loaded: true })
        // }
      }).catch(err => console.log(err.response || err.message))
  }

  render () {
    // if (!this.state.loaded) return <h1>Not Ready</h1>
    return (
      <div className='App'>
        {/* <TopNavBar /> */}
        <MainContainer>
          <LeftMenu />
          <ContentBody />
        </MainContainer>
        <Alert stack={{ limit: 3 }} html />
        {/* <button onClick={() => {
          console.log('clicked')
          // The API is fully functioning, and works through the package.json proxy once the server is up
          // axios.post('/api/guilds/240535022820392961/feeds')
        }}>fetch</button> */}
      </div>
    )
  }
}

App.propTypes = {
  initializeState: PropTypes.func
}

export default connect(null, mapDispatchToProps)(App)
