import React, { Component } from 'react'
import colors from '../../../../constants/colors'
import styled from 'styled-components'
import { addFeed, removeFeed } from '../../../../actions/index-actions'
import { lighten, darken } from 'polished'
import { Table, Modal, Transition, Popup, Button, Header, TransitionablePortal, Input, Dropdown, Divider } from 'semantic-ui-react'
import axios from 'axios'
import DiscordModal from '../../../utils/Modal'
import { connect } from 'react-redux'
import ViewFeedModal from './ViewFeedModal'
import Alert from 'react-s-alert'

const LINK_VALIDATION = {
  PENDING: 0,
  VALIDATING: 1,
  VALID: 2,
  INVALID: 3 
}

const mapStateToProps = state => {
  return {
    channels: state.channels,
    guildId: state.activeGuild
  }
}

const mapDispatchToProps = dispatch => {
  return {
    addFeed: feed => dispatch(addFeed(feed)),
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

const AddFeedModalContent = styled.div`
  > div {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    > * {
      flex-grow: 1;
    }
    button {
      flex-grow: 0;
      margin-left: 1em !important;
    }
  }
  h5 {
    margin-top: 0;
    color: ${colors.discord.text};
  }
`

const ChannelDropdown = styled(Dropdown)`
  .menu {
    height: 10em !important;
  }
  /* height: 5em !important; */

`

class AddFeedModal extends Component {
  constructor () {
    super()
    this.state = {
      validatingState: LINK_VALIDATION.PENDING,
      addFeedLink: '',
      addFeedChannel: '', // Both .value and .text should be available
      addFeedTitle: '',
      invalidAttempted: false,
      validatingFeedback: undefined,
    }
  }

  closeAddFeed = (justAddedLink) => {
    const newState = { validatingFeedback: null, addFeedLink: justAddedLink ? '' : this.state.addFeedLink, invalidAttempted: false }
    this.setState(newState)
    this.props.onClose()
  }

  addFeed = () => {
    const { addFeedLink, addFeedChannel, addFeedTitle } = this.state
    const toSend = {
      feed: addFeedLink,
      channel: addFeedChannel,
      title: addFeedTitle
    }
    this.setState({ validatingState: LINK_VALIDATION.VALIDATING, validatingFeedback: null })
    axios.post(`/api/guilds/${this.props.guildId}/feeds`, toSend).then(({ data }) => {
      this.props.addFeed({
        rssName: data._rssName,
        title: data.title,
        channel: data.channel,
        link: data.link
      })
      this.closeAddFeed(true)
    }).catch(err => {
      console.log(err.response)
      const errMessage = err.response && err.response.data && err.response.data.message ? err.response.data.message : err.response.data ? err.response.data : err.message
      this.setState({ validatingState: LINK_VALIDATION.INVALID, validatingFeedback: errMessage, invalidAttempted: true })
      if (!this.props.open) Alert.error(`Failed to Remove Feed<br />${addFeedLink}<br /><br />${errMessage || 'No details available'}`, { effect: 'scale', position: 'bottom-right', timeout: 8000 })
    })
  }

  render () {
    const { guildId, channels, open } = this.props
    const validatingState = this.state.validatingState === LINK_VALIDATION.VALIDATING
    const guildChannels = channels[guildId]
    const dropdownOptions = []
    if (guildChannels) {
      for (const channelId in guildChannels) {
        const channel = guildChannels[channelId]
        dropdownOptions.push({ text: `#${channel.name}`, value: channelId })
      }
    }

    return (
      <DiscordModal header={<ModalHeader><h4>New Feed</h4>Woah!</ModalHeader>} footer={
          <FeedButtonsContainer>
            <Button content='Cancel' disabled={validatingState} onClick={this.closeAddFeed} />
            <Button color='green' disabled={validatingState || this.state.invalidAttempted || !this.state.addFeedLink || !this.state.addFeedChannel} content={validatingState ? 'Validating...' : 'Add'} onClick={this.addFeed} />
          </FeedButtonsContainer>
        } disabled={validatingState}  open={open} onClose={this.closeAddFeed}>
          <AddFeedModalContent>
              <h5>Link</h5>
              <Input disabled={validatingState} onChange={e => this.setState({ addFeedLink: e.target.value, invalidAttempted: false })} fluid/>
            <Divider />
            <h5>Channel</h5>
            <ChannelDropdown disabled={validatingState} search options={dropdownOptions} selection fluid onChange={(e, data) => this.setState({ addFeedChannel: data.value })} />
            <Divider />
            <h5>Title</h5>
            <Input disabled={validatingState} fluid placeholder='(Can be left blank)' onChange={e => this.setState({ addFeedTitle: e.target.value })} />
            <Divider />
            <Transition visible={!!this.state.validatingFeedback} animation='drop' duration={300}>
              <p style={{ color: colors.discord.red }}>{this.state.validatingFeedback}</p>
            </Transition>
          </AddFeedModalContent>
        </DiscordModal>
    )
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(AddFeedModal)
