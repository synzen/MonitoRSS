import React, { Component } from 'react'
import colors from '../../../../constants/colors'
import styled from 'styled-components'
import { addFeed, removeFeed, setGuildChannels, unauthorizeGuild } from '../../../../actions/index-actions'
import { lighten, darken } from 'polished'
import { Table, Modal, Transition, Popup, Button, Header, TransitionablePortal, Input, Dropdown, Divider } from 'semantic-ui-react'
import axios from 'axios'
import DiscordModal from '../../../utils/Modal'
import { connect } from 'react-redux'
import ViewFeedModal from './ViewFeedModal'
import AddFeedModal from './AddFeedModal'

const LINK_VALIDATION = {
  PENDING: 0,
  VALIDATING: 1,
  VALID: 2,
  INVALID: 3 
}

const mapStateToProps = state => {
  return {
    feeds: state.feeds,
    channels: state.channels,
    guildId: state.activeGuild
  }
}

const mapDispatchToProps = dispatch => {
  return {
    addFeed: feed => dispatch(addFeed(feed)),
    removeFeed: rssName => dispatch(removeFeed(rssName))
  }
}

const SectionHeader = styled.h2`
  color: ${colors.discord.white};
  margin-bottom: 1em;
  text-align: left;
`

const FeedRow = styled(Table.Row)`
  cursor: pointer;
`

const TableTop = styled.div`
  display: flex;
  justify-content: space-between;
  width: 100%;
`


class FeedTable extends Component {
  constructor () {
    super()
    this.state = {
      unauthorized: false,
      channels: {},
      viewFeed: {
        open: false,
        rssName: '',
        title: '',
        channel: '',
        link: ''
      },
      addFeedOpen : false,
      modal: {
        header: undefined,
        footer: undefined,
        content: undefined
      }
    }
  }

  closeAddFeed = () => {
    this.setState({ openAddFeed: false, validatingState: LINK_VALIDATION.PENDING, validatingFeedback: null })
  }

  addFeed = () => {
    this.setState({ validatingState: LINK_VALIDATION.VALIDATING, validatingFeedback: null })
    axios.post(`/api/guilds/${this.props.guildId}/feeds`, {
      feed: this.state.addFeedLink,
      channel: this.state.addFeedChannel,
      title: this.state.addFeedTitle
    }).then(({ data }) => {
      this.props.addFeed({
        rssName: data._rssName,
        title: data.title,
        channel: data.channel,
        link: data.link
      })
      this.setState({ validatingState: LINK_VALIDATION.VALID, validatingFeedback: undefined, openAddFeed: false })
    }).catch(err => {
      console.log(err.response)
      const errMessage = err.response && err.response.data ? err.response.data.message : err.message
      this.setState({ validatingState: LINK_VALIDATION.INVALID, validatingFeedback: errMessage, addFeedDisabled: true })
    })
  }

  render () {
    const { guildId, feeds, channels } = this.props
    const guildChannels = channels[guildId]
    const dropdownOptions = []
    if (guildChannels) {
      for (const channelId in guildChannels) {
        const channel = guildChannels[channelId]
        dropdownOptions.push({ text: `#${channel.name}`, value: channelId })
      }
    }

    const guildFeeds = guildId && feeds[guildId] ? feeds[guildId] : []
    // const guildFeeds = [
    //   { title: 'some title', channel: '12334gjmsr9', link: 'q3etjgmiewj46ty', rssName: '1' },
    //   { title: 'some title', channel: '12334gjmsr9', link: 'q3etjgmiewj46ty', rssName: '12' },
    //   { title: 'some title', channel: '12334gjmsr9', link: 'q3etjgmiewj46ty', rssName: '2351' },
    //   { title: 'some title', channel: '12334gjmsr9', link: 'q3etjgmiewj46ty', rssName: '1346' },
    //   { title: 'some title', channel: '12334gjmsr9', link: 'q3etjgmiewj46ty', rssName: '14786' },
    //   { title: 'some title', channel: '12334gjmsr9', link: 'q3etjgmiewj46ty', rssName: '1123' },
    //   { title: 'some title', channel: '12334gjmsr9', link: 'q3etjgmiewj46ty', rssName: '1869' },
    // ]
    const tableRows = guildFeeds.map(feed => {
      return (
        <Popup key={feed.rssName} trigger={
          <FeedRow onClick={e => {
            this.setState({ open: true,
              viewFeed: {
                open: true,
                ...feed
              } })
          }}>
            <Table.Cell>{feed.title}</Table.Cell>
            <Table.Cell>{feed.link}</Table.Cell>
            <Table.Cell>{channels[guildId] && channels[guildId][feed.channel] ? `#${channels[guildId][feed.channel].name}` : feed.channelName ? `#${feed.channelName}` : feed.channel}</Table.Cell>
            <Table.Cell>{feed.status === undefined ? 'OK' : feed.status}</Table.Cell>
          </FeedRow>} content='string' inverted position='left center' hoverable />
      )
    })

    return (
      <div>
        <ViewFeedModal feed={this.state.viewFeed} open={this.state.viewFeed.open} onClose={() => this.setState({ viewFeed: { ...this.state.viewFeed, open: false } })} />
        <AddFeedModal open={this.state.addFeedOpen} onClose={() => this.setState({ addFeedOpen: false })} />

        <SectionHeader>Feed Management</SectionHeader>
        <TableTop>
          <Input placeholder='Search...' />
          <Button content='Add New' onClick={() => this.setState({ addFeedOpen: true })} />
        </TableTop>
        <Table celled selectable>
          <Table.Header>
            <FeedRow>
              <Table.HeaderCell>Name</Table.HeaderCell>
              <Table.HeaderCell>Link</Table.HeaderCell>
              <Table.HeaderCell>Channel</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
            </FeedRow>
          </Table.Header>
          <Table.Body>
            {tableRows}
          </Table.Body>
        </Table>
      </div>
    )
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(FeedTable)
