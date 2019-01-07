import React, { Component } from 'react'
import colors from '../../../../constants/colors'
import styled from 'styled-components'
import { addFeed, removeFeed, changeFeed } from '../../../../actions/index-actions'
import { lighten, darken } from 'polished'
import { Table, Modal, Transition, Popup, Button, Header, TransitionablePortal, Input, Dropdown, Divider } from 'semantic-ui-react'
import axios from 'axios'
import DiscordModal from '../../../utils/Modal'
import { connect } from 'react-redux'
import Alert from 'react-s-alert'

const LINK_VALIDATION = {
  PENDING: 0,
  VALIDATING: 1,
  VALID: 2,
  INVALID: 3 
}

const mapStateToProps = state => {
  return {
    guildId: state.activeGuild,
    channels: state.channels
  }
}

const mapDispatchToProps = dispatch => {
  return {
    changeFeed: (rssName, data) => dispatch(changeFeed(rssName, data)),
    removeFeed: rssName => dispatch(removeFeed(rssName))
  }
}

const ModalHeader = styled.div`
  color: ${colors.discord.text};
  h4 {
    color: white;
  }
`

const FeedButtonsContainer = styled.div`
  /* > div {
    margin-bottom: 1em;
  } */
  display: flex;
  justify-content: space-between;

`

const ViewFeedContainer = styled.div`
  h5 {
    color: ${colors.discord.text};
    margin-bottom: 0.5em;
  }
`

const ViewFeedContainerWithEdit = styled.div`
  > div {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    > div {
      flex-grow: 1;
    }
    button {
        margin-left: 2em !important;
    }
    p {
      margin: 0;
      flex-grow: 1;
    }
  }
`

const ChannelDropdown = styled(Dropdown)`
  .menu {
    height: 10em !important;
  }
`

class ViewFeedModal extends Component {
  constructor (props) {
    super()
    this.state = {
      validatingState: LINK_VALIDATION.PENDING,
      validatingFeedback: undefined,
      title: '',
      channel: '',
      editingChannel: false,
      editingTitle: false
    }
  }

  close = justRemoved => {
    this.setState({ validatingFeedback: null, validatingState: justRemoved ? LINK_VALIDATION.VALID : this.state.validatingState, title: '', channel: '', editingChannel: false, editingTitle: false })
    return this.props.onClose()
  }

  confirm = () => {
    const { feed, guildId } = this.props
    if ((this.state.title === feed.title && !this.state.channel) || (this.state.channel === feed.channel && !this.state.title) || (this.state.title === feed.title && this.state.channel === feed.channel) || (!this.state.title && !this.state.channel)) return this.close()
    this.setState({ validatingState: LINK_VALIDATION.VALIDATING })
    const toSend = {}
    if (this.state.channel) toSend.channel = this.state.channel
    if (this.state.title) toSend.title = this.state.title
    if (Object.keys(toSend).length === 0) return this.close()
    axios.patch(`/api/guilds/${guildId}/feeds/${feed.rssName}`, toSend).then(() => {
      this.props.changeFeed(feed.rssName, toSend)
      this.close(true)
    }).catch(err => {
      console.log(err)
      console.log(err.response)
      const errMessage = err.response && err.response.data && err.response.data.message ? err.response.data.message : err.response.data ? err.response.data : err.message
      this.setState({ validatingState: LINK_VALIDATION.INVALID, validatingFeedback: errMessage })
    })
  }

  saveNewTitle = () => {
    const newTitle = this.state.title
  }

  removeFeed = () => {
    const feed = this.props.feed
    this.setState({ validatingState: LINK_VALIDATION.VALIDATING, validatingFeedback: null })
    axios.delete(`/api/guilds/${this.props.guildId}/feeds/${feed.rssName}`).then(() => {
      this.props.removeFeed(feed.rssName)
      this.close(true)
    }).catch(err => {
      console.log(err.response)
      const errMessage = err.response && err.response.data && err.response.data.message ? err.response.data.message : err.response.data ? err.response.data : err.message
      this.setState({ validatingState: LINK_VALIDATION.INVALID, validatingFeedback: errMessage })
      if (!this.props.open) Alert.error(`Failed to Remove Feed<br />${feed.link}<br /><br />${errMessage || 'No details available'}`, { effect: 'scale', position: 'bottom-right', timeout: 8000 })
    })
  }

  render () {
    const { feed, open, onClose, channels, guildId } = this.props
    const validatingState = this.state.validatingState === LINK_VALIDATION.VALIDATING
    const cancelCondition = (this.state.title === feed.title && !this.state.channel) || (this.state.channel === feed.channel && !this.state.title) || (this.state.title === feed.title && this.state.channel === feed.channel) || (!this.state.title && !this.state.channel)
    const guildChannels = channels[guildId]
    const dropdownOptions = []
    if (guildChannels) {
      for (const channelId in guildChannels) {
        const channel = guildChannels[channelId]
        dropdownOptions.push({ text: `#${channel.name}`, value: channelId })
      }
    }

    return (
      <DiscordModal 
      header={<ModalHeader><h4>{feed.title}</h4>{feed.link}</ModalHeader>} 
      footer={<FeedButtonsContainer><Button color='red' content='Delete' onClick={this.removeFeed} disabled={validatingState} /><Button disabled={validatingState} content={cancelCondition ? 'Close' : validatingState ? 'Saving...' : 'Save Changes'} onClick={this.confirm} /></FeedButtonsContainer>}
      open={open} onClose={() => {
        onClose()
      }}>
        <ViewFeedContainer>
          <div>
            <div>
              <h5>Filters Used</h5>
              <p>Yes</p>
            </div>
          </div>
          <Divider />
          <ViewFeedContainerWithEdit>
            <h5>Channel</h5>
            <div>
              { this.state.editingChannel
              ? <ChannelDropdown value={feed.channel} disabled={validatingState} search options={dropdownOptions} selection fluid onChange={(e, data) => this.setState({ channel: data.value })} />
              : <p>{channels[guildId] && channels[guildId][feed.channel] ? `#${channels[guildId][feed.channel].name}` : feed.channelName ? `#${feed.channelName}` : feed.channel}</p>
              }
              <Button content={this.state.editingChannel ? 'Cancel' : 'Edit'} onClick={e => this.setState(this.state.editingChannel ? {editingChannel: false, channel: '' } : {editingChannel: true, channel: '' })}/>
            </div>
          </ViewFeedContainerWithEdit>
          <Divider />
          <ViewFeedContainerWithEdit>
            <h5>Title</h5>
            <div>
              { this.state.editingTitle 
                ? <Input disabled={validatingState} placeholder={feed.title} fluid onChange={e => this.setState({ title: e.target.value })} />
                : <p>{feed.title}</p>
              }
              <Button content={this.state.editingTitle ? 'Cancel' : 'Edit'} onClick={e => this.setState(this.state.editingTitle ? { editingTitle: false, title: '' } : { editingTitle: true, title: '' })}/>
            </div>
          </ViewFeedContainerWithEdit>
          <Divider />
          <Transition visible={!!this.state.validatingFeedback} animation='drop' duration={300}>
              <p style={{ color: colors.discord.red }}>{this.state.validatingFeedback}</p>
          </Transition>
        </ViewFeedContainer>
      </DiscordModal>
    )
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(ViewFeedModal)
