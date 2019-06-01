import React, { Component } from 'react'
import { withRouter, Redirect } from 'react-router-dom'
import { connect } from 'react-redux'
import { changePage } from 'js/actions/index-actions'
import { Button, Divider, Sticky, ButtonGroup } from 'semantic-ui-react'
import styled from 'styled-components'
import pages from 'js/constants/pages'
import MessageSettings from './MessageSettings'
import EmbedSettings from './EmbedSettings/index'
import DiscordMessage from './DiscordMessage'
import SectionTitle from 'js/components/utils/SectionTitle'
import PageHeader from 'js/components/utils/PageHeader'
import Placeholders from './Placeholders'
import embedProperties from 'js/constants/embed'
import PropTypes from 'prop-types'
import colors from 'js/constants/colors'
import { Scrollbars } from 'react-custom-scrollbars'

const MAX_VIEWPORT_WIDTH_STICKY = 1850
const EMBED_PROPERTY_LENGTHS = {
  [embedProperties.title]: 256,
  [embedProperties.description]: 2048,
  [embedProperties.footerText]: 2048,
  [embedProperties.footerTextCamelCase]: 2048,
  [embedProperties.authorName]: 256,
  [embedProperties.authorNameCamelCase]: 256,
}

const mapStateToProps = state => {
  return {
    defaultConfig: state.defaultConfig,
    guildId: state.guildId,
    feedId: state.feedId,
    guilds: state.guilds,
    feeds: state.feeds,
    messages: state.messages,
    subscribers: state.subscribers,
    embeds: state.embeds
  }
}

const mapDispatchToProps = dispatch => {
  return {
    setToThisPage: () => dispatch(changePage(pages.MESSAGE)),
    toDashboard: () => dispatch(changePage(pages.DASHBOARD))
  }
}

const FullArea = styled.div`
  display: flex;
`

const SettingsArea = styled.div`
  padding: 20px;
  @media only screen and (min-width: 930px) {
    padding: 55px;
  }
  width: 100%;
  max-width: 840px;
`

const PreviewArea = styled.div`
  /* display: flex; */
  display: inline-block;
  align-items: center;
  /* height: 100%; */
  width: 700px;
  padding: 4em 0;
  flex: 1;
  /* margin-top: 7em; */
  justify-items: center;
`

const PreviewHeader = styled.div`
  display: flex;
  align-items: center;
  > div:first-child {
    margin-right: 1em;
    padding-bottom: 0;
  }
`

class Message extends Component {
  constructor () {
    super()
    this.state = {
      articleId: 0,
      window: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      embedsOriginal: [],
      embeds: [],
      messageOriginal: '',
      message: '',
      previewNew: true
    }
  }

  componentWillMount () {
    this.props.setToThisPage()
    window.addEventListener('resize', this.updateWindowDimensions)
    this.populateComponent()
  }

  updateWindowDimensions = () => {
    const newState = { window: { width: window.innerWidth, height: window.innerHeight } }
    this.setState(newState)
  }

  componentWillUnmount () {
    window.removeEventListener('resize', this.updateWindowDimensions)
  }

  componentDidUpdate (prevProps, prevState) {
    // Called after apply() since changes are received by the websocket
    const { feedId, feeds, guildId, messages, embeds } = this.props

    if (prevProps.feedId !== feedId) return this.populateComponent()
    const prevFeed = prevProps.feeds[guildId] ? prevProps.feeds[guildId][feedId] : null
    const newFeed = feeds[guildId] ? feeds[guildId][feedId] : null
    if (prevFeed && newFeed) {
      const newState = {}
      // Check the message
      if (messages[guildId][feedId] !== prevProps.messages[guildId][feedId]) {
        newState.messageOriginal = messages[guildId][feedId] || ''
        newState.message = messages[guildId][feedId] || ''
      }

      // Check the embeds
      const prevEmbeds = prevProps.embeds[guildId][feedId] || null
      const newEmbeds = embeds[guildId][feedId] || null
      if (prevEmbeds && !newEmbeds) {
        newState.embeds = []
        newState.embedsOriginal = []
      } else if ((!prevEmbeds && newEmbeds) || (prevEmbeds && newEmbeds && JSON.stringify(prevEmbeds) !== JSON.stringify(newEmbeds))) {
        newState.embeds = newEmbeds
        newState.embedsOriginal = newEmbeds
      }

      // Finally update if necessary
      if (Object.keys(newState).length > 0) this.setState(newState)
    }
  }

  handleContextRef = contextRef => this.setState({ contextRef })

  populateComponent () {
    const { guildId, feedId, feeds, embeds, messages } = this.props
    const guildFeeds = feeds[guildId]
    if (!guildFeeds) return
    this.setState({
      message: messages[guildId][feedId] || '',
      messageOriginal: messages[guildId][feedId] || '',
      embeds: embeds[guildId][feedId] || [],
      embedsOriginal: embeds[guildId][feedId] || []
    })
  }

  onEmbedPropertyUpdate = (embedIndex, property, value) => {
    if (EMBED_PROPERTY_LENGTHS[property] && value.length >= EMBED_PROPERTY_LENGTHS[property]) return
    const embeds = [ ...this.state.embeds ]
    if (!embeds[embedIndex]) {
      if (embedIndex > embeds.length) throw new Error('Out of bounds index, requires more than 1 push to reach')
      embeds.push({ [property]: value })
    } else {
      const embed = { ...embeds[embedIndex] }
      embed[property] = value
      embeds[embedIndex] = embed
    }
    this.setState({ embeds })
  }

  resetEmbedProperties = () => {
    this.setState({ embeds: JSON.parse(JSON.stringify(this.state.embedsOriginal)) })
  }

  onMessageUpdate = message => {
    this.setState({ message: message })
  }

  render () {
    const { feedId, subscribers } = this.props
    if (!feedId) {
      this.props.toDashboard()
      return <Redirect to='/' />
    }
    const messageToDisplay = this.state.message == null ? this.state.messageOriginal : this.state.message
    let hasSubscribers = false
    for (const guildId in subscribers) {
      if (hasSubscribers) continue
      const guildSubscribers = subscribers[guildId]
      const feedSubscribers = guildSubscribers[feedId]
      if (feedSubscribers && Object.keys(feedSubscribers).length > 0) hasSubscribers = true
    }

    return (
      <FullArea>
        <SettingsArea ref={this.handleContextRef}>
        {/* <div style ={{overflowX: 'auto', height: '200px', background: 'green', whiteSpace: 'nowrap'}}>
          <div style={{display: 'inline-block', height: '100px', background: 'orange', width: '100px', flex: 0, marginRight: '30px'}}></div>
          <div style={{display: 'inline-block', height: '100px', background: 'orange', width: '100px', flex: 0, marginRight: '30px'}}></div>
          <div style={{display: 'inline-block', height: '100px', background: 'orange', width: '100px', flex: 0, marginRight: '30px'}}></div>
          <div style={{display: 'inline-block', height: '100px', background: 'orange', width: '100px', flex: 0, marginRight: '30px'}}></div>
          <div style={{display: 'inline-block', height: '100px', background: 'orange', width: '100px', flex: 0, marginRight: '30px'}}></div>
          <div style={{display: 'inline-block', height: '100px', background: 'orange', width: '100px', flex: 0, marginRight: '30px'}}></div>
          <div style={{display: 'inline-block', height: '100px', background: 'orange', width: '100px', flex: 0, marginRight: '30px'}}></div>
          <div style={{display: 'inline-block', height: '100px', background: 'orange', width: '100px', flex: 0, marginRight: '30px'}}></div>
        </div> */}
          <PageHeader >
            <h2>Message/Embed Customization</h2>
            <p>Set a custom message and/or embed for your feed.</p>
          </PageHeader>
          <Divider />
          <SectionTitle heading='Placeholders' subheading='Below are the available placeholders for the selected article.' />
          <Placeholders updateArticleId={articleId => this.setState({ articleId })} />
          <Divider />
          <SectionTitle heading='Message' subheading={
            <span>
              <span>Remember that you can use the placeholders listed above. A special placeholder, {`{empty}`} can be used to create an empty message, but only if an embed is used. Regular formatting such as bold and etc. is also available.</span>
              { !hasSubscribers
                ? null
                : messageToDisplay === '' || messageToDisplay.includes('{subscriptions}') ? '' : <span style={{ color: colors.discord.yellow }}> Note that because the placeholder {`{subscriptions}`} is not in your message, feed subscribers will not be mentioned.</span> }
            </span>

            } />
          <MessageSettings messageOriginal={this.state.messageOriginal} onUpdate={this.onMessageUpdate} />
          <Divider />
          <SectionTitle heading='Embeds' subheading='Embeds are fancy boxes that can be shown under your message. Placeholders may also be used here.' />
          <EmbedSettings onUpdate={this.onEmbedPropertyUpdate} embeds={this.state.embeds} embedsOriginal={this.state.embedsOriginal} resetEmbedProperties={this.resetEmbedProperties} />
          <Divider />
          {this.state.window.width >= MAX_VIEWPORT_WIDTH_STICKY
          ? null
          : <div>
              <div>
                <SectionTitle heading='Preview' subheading='I can preview my settings right here?! Wow!' />
              </div>
              <ButtonGroup fluid>
                <Button content='Old' onClick={e => this.setState({ previewNew: false })} disabled={!this.state.previewNew} />
                <Button content='New' onClick={e => this.setState({ previewNew: true })} disabled={this.state.previewNew} />
              </ButtonGroup>
              <div style={{ marginTop: '20px' }}>
                <DiscordMessage embeds={this.state.previewNew ? this.state.embeds : this.state.embedsOriginal} message={this.state.previewNew ? messageToDisplay : this.state.messageOriginal} articleId={this.state.articleId} />
              </div>
              <Divider />
            </div>
          }
          {/* <div>
            <div>
              <SectionTitle>
                <h3>Preview</h3>
              </SectionTitle>
            </div>
            <DiscordMessage embeds={this.state.embeds} message={messageToDisplay} />
            <Divider />
          </div> */}


        </SettingsArea>

        {this.state.window.width < MAX_VIEWPORT_WIDTH_STICKY
        ? null
        : <Sticky context={this.state.contextRef} offset={55}>
            <PreviewArea stickied>
              <PreviewHeader>
                <PageHeader heading='Preview' />
              </PreviewHeader>
              <div  style={{ marginTop: '1em' }}>
                <ButtonGroup fluid>
                  <Button content='Old' onClick={e => this.setState({ previewNew: false })} disabled={!this.state.previewNew} />
                  <Button content='New' onClick={e => this.setState({ previewNew: true })} disabled={this.state.previewNew} />
                </ButtonGroup>
                </div>
              <div style={{ height: this.state.window.height - 55 - 70 - 150, marginTop: '20px' }}> { /* 55 is the topbar, 70 is the margin/padding, 150 is the rest of the space to leave */ }
                <Scrollbars>
                  <DiscordMessage embeds={this.state.previewNew ? this.state.embeds : this.state.embedsOriginal} message={this.state.previewNew ? messageToDisplay : this.state.messageOriginal} articleId={this.state.articleId} />
                </Scrollbars>
              </div>
            </PreviewArea>
          </Sticky>
        }
      </FullArea>
    )
  }
}

Message.propTypes = {
  setToThisPage: PropTypes.func
}

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(Message))
