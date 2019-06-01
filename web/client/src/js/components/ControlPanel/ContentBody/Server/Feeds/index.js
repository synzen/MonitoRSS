import React, { Component } from 'react'
import { withRouter } from 'react-router-dom'
import { connect } from 'react-redux'
import { changePage, setActiveFeed } from 'js/actions/index-actions'
import pages from 'js/constants/pages'
import PageHeader from 'js/components/utils/PageHeader'
import SideBar from './SideBar'
import SectionTitle from 'js/components/utils/SectionTitle'
import AddFeed from './AddFeed'
import PaginatedTable from '../../../utils/PaginatedTable'
import PropTypes from 'prop-types'
import styled from 'styled-components'
import { Divider, Icon, Popup, Dropdown, Button, Input } from 'semantic-ui-react'
import { Scrollbars } from 'react-custom-scrollbars';
import modal from '../../../utils/modal'
import toast from '../../../utils/toast'
import axios from 'axios'
import colors from 'js/constants/colors'
import SectionSubtitle from 'js/components/utils/SectionSubtitle'
import moment from 'moment-timezone'

const mapStateToProps = state => {
  return {
    feeds: state.feeds,
    channels: state.channels,
    guildId: state.guildId,
    feedId: state.feedId,
    guildLimits: state.guildLimits,
    linkStatuses: state.linkStatuses,
    guild: state.guild,
    defaultConfig: state.defaultConfig,
    csrfToken: state.csrfToken
  }
}

const mapDispatchToProps = dispatch => {
  return {
    setToThisPage: () => dispatch(changePage(pages.FEEDS)),
    setActiveFeed: feedId => dispatch(setActiveFeed(feedId))
  }
}

const MainContent = styled.div`
  padding: 20px;
  @media only screen and (min-width: 930px) {
    padding: 55px;
  }
  width: 100%;
  /* overflow: hidden; */
  scrollbar-width: thin;
  /* overflow-y: auto; */
  /* max-width: 840px; */
`

const SideBarContainer = styled.div`
  display: none;
  @media only screen and (min-width: 1475px) {
    display: block;
  }
`

const FeedLimitContainer = styled.div`
  > a {
    margin-left: 10px;
    &:hover {
      text-decoration: none;
    }
  }
`

const FeedButtonsContainer = styled.div`
  display: flex;
  justify-content: space-between;
  > div {
    > button:first-child {
      margin-right: 1em;
    }
  }
`

const ViewFeedContainerWithEdit = styled.div`
  > div {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    /* overflow: hidden; */
    > div {
      flex-grow: 1;
    }
    button {
        margin-left: 2em !important;
    }
    p {
      margin: 0;
      flex-grow: 1;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
`

const ChannelDropdown = styled(Dropdown)`
  .menu {
    height: 10em !important;
  }
`

class Feeds extends Component {
  constructor () {
    super()
    this.state = {
      selectedFeedId: '',
      redirect: '',
      title: '',
      channel: '',
      editingChannel: false,
      editingTitle: false,
      ignoreModal: window.innerWidth >= 1475
    }
    this.bodyRef = React.createRef()
  }

  componentWillMount () {
    this.props.setToThisPage()
    window.addEventListener('resize', this.resizeListener)
    this.setState({ selectedFeedId: this.props.feedId })
  }

  componentWillUnmount () {
    window.removeEventListener('resize', this.resizeListener)
  }

  componentDidUpdate(prevProps) {
    if (prevProps.feedId !== this.props.feedId) this.setState({ selectedFeedId: this.props.feedId })
  }

  resizeListener = () => {
    const { ignoreModal } = this.state
    if (ignoreModal && window.innerWidth < 1475) this.setState({ ignoreModal: false })
    else if (!ignoreModal && window.innerWidth >= 1475) this.setState({ ignoreModal: true })
  }

  modalClose = justMadeChanges => {
    this.setState({ title: '', channel: '', editingChannel: false, editingTitle: false, removing: justMadeChanges ? false : this.state.removing, saving: justMadeChanges ? false : this.state.saving })
    modal.hide()
  }

  modalConfirmEdits = feedId => {
    const title = this.state.title.trim()
    const channel = this.state.channel.trim()
    const { csrfToken, guildId, feeds } = this.props
    const feed = feeds[guildId][feedId] || {}
    if ((title === feed.title && !this.state.channel) || (channel === feed.channel && !title) || (title === feed.title && channel === feed.channel) || (!title && !channel)) return this.modalClose()
    this.setState({ saving: true, title, channel })
    const toSend = {}
    if (channel) toSend.channel = channel
    if (title) toSend.title = title
    if (Object.keys(toSend).length === 0) return this.modalClose()
    axios.patch(`/api/guilds/${guildId}/feeds/${feedId}`, toSend, { headers: { 'CSRF-Token': csrfToken } }).then(() => {
      this.modalClose(true)
      toast.success(`Changes saved. Yay!`)
    }).catch(err => {
      console.log(err.response || err)
      const errMessage = err.response && err.response.data && err.response.data.message ? err.response.data.message : err.response && err.response.data ? err.response.data : err.message
      this.setState({ saving: false })
      toast.error(<p>Failed to save<br/><br/>{errMessage ? typeof errMessage === 'object' ? JSON.stringify(errMessage, null, 2) : errMessage : 'No details available'}</p>)
    })
  }

  modalRemoveFeed = feedId => {
    this.setState({ removing: true })
    axios.delete(`/api/guilds/${this.props.guildId}/feeds/${feedId}`, { headers: { 'CSRF-Token': this.props.csrfToken } }).then(() => {
      this.modalClose(true)
      toast.success(`Removed feed!`)
    }).catch(err => {
      console.log(err.response || err)
      const errMessage = err.response && err.response.data && err.response.data.message ? err.response.data.message : err.response && err.response.data ? err.response.data : err.message
      this.setState({ saving: false })
      toast.error(<p>Failed to remove feed<br/><br/>{errMessage ? typeof errMessage === 'object' ? JSON.stringify(errMessage, null, 2) : errMessage : 'No details available'}</p>)
    })
  }

  setActive = feedId => {
    const { setActiveFeed, selectedFeedId } = this.props
    setActiveFeed(feedId || selectedFeedId)
    this.modalClose()
  }

  onClickFeedRow = feed => {
    if (this.state.ignoreModal) return this.state.selectedFeedId === feed.rssName ? this.setState({ selectedFeedId : '' }) : this.setState({ selectedFeedId: feed.rssName })
    this.setState({ selectedFeedId: feed.rssName })
    const { defaultConfig, channels, guildId, guild, linkStatuses } = this.props
    const cancelCondition = (this.state.title === feed.title && !this.state.channel) || (this.state.channel === feed.channel && !this.state.title) || (this.state.title === feed.title && this.state.channel === feed.channel) || (!this.state.title && !this.state.channel)
    const dateTimezone = guild.timezone || defaultConfig.timezone
    const dateFormat = guild.dateFormat || defaultConfig.dateFormat
    const dateLanguage = guild.dateLanguage || defaultConfig.dateLanguage
    const guildChannels = channels[guildId]
    const dropdownOptions = []
    if (guildChannels) {
      for (const channelId in guildChannels) {
        const channel = guildChannels[channelId]
        dropdownOptions.push({ text: `#${channel.name}`, value: channelId })
      }
    }

    const channelDropdownValue = feed.channel && channels[guildId][feed.channel] ? feed.channel : null // The feed channel may be deleted
    const props = {
      title: feed.title,
      subtitle: feed.link,
      footer: (
        <FeedButtonsContainer>
          <Button color='red' content='Delete' onClick={e => this.modalRemoveFeed(feed.rssName)} disabled={this.state.saving || this.state.removing} />
          <div>
            <Button content='Set Active' onClick={e => this.setActive(feed.rssName)} />
            <Button disabled={this.state.saving} content={cancelCondition ? 'Close' : this.state.saving ? 'Saving...' : 'Save Changes'} onClick={e => this.modalConfirmEdits(feed.rssName)} />
          </div>
        </FeedButtonsContainer>
      )
    }
    const children = (
      <div>
        <ViewFeedContainerWithEdit>
          <SectionSubtitle>Status</SectionSubtitle>
          { Object.keys(feed).length === 0
              ? ''
              : feed.disabled
                ? <span style={{ color: colors.discord.yellow }}>Disabled ({feed.disabled})</span>
                :  typeof linkStatuses[feed.link] === 'string'
                  ? <span style={{ color: colors.discord.red }}>Failed ({moment(linkStatuses[feed.link]).format('DD MMMM Y')})</span>
                  : <div><span style={{ color: colors.discord.green }}>Normal</span>{defaultConfig.failLimit > 0 ? ` ${linkStatuses[feed.link] === undefined ? '100' : ((defaultConfig.failLimit - linkStatuses[feed.link]) / defaultConfig.failLimit * 100).toFixed(0)}% health` : ''}</div>
          }
          <Divider />
          <SectionSubtitle>Refresh Rate</SectionSubtitle>
          { !feed ? '\u200b' : feed.disabled || typeof linkStatuses[feed.link] === 'string' ? 'None ' : !feed.lastRefreshRateMin ? 'To be determined ' : feed.lastRefreshRateMin < 1 ? `${feed.lastRefreshRateMin * 60} seconds      ` : `${feed.lastRefreshRateMin} minutes      `}<a rel='noopener noreferrer' href='https://www.patreon.com/discordrss' target='_blank'>－</a>
          <Divider />
          <SectionSubtitle>Added On</SectionSubtitle>
          { !feed ? '\u200b' : !feed.addedOn ? 'Unknown' : moment(feed.addedOn).locale(dateLanguage).tz(dateTimezone).format(dateFormat)}
          <Divider />
          <SectionSubtitle>Channel</SectionSubtitle>
          <div>
            { this.state.editingChannel
            ? <ChannelDropdown value={this.state.channel || channelDropdownValue} disabled={this.state.saving || this.state.removing} search options={dropdownOptions} selection fluid onChange={(e, data) => this.setState({ channel: data.value }, () => this.onClickFeedRow(feed))} />
            : <p>{channels[guildId] && channels[guildId][feed.channel] ? `#${channels[guildId][feed.channel].name}` : feed.channelName ? `#${feed.channelName}` : feed.channel}</p>
            }
            <Button content={this.state.editingChannel ? 'Cancel' : 'Edit'} onClick={e => this.setState(this.state.editingChannel ? {editingChannel: false, channel: '' } : {editingChannel: true, channel: '' }, () => this.onClickFeedRow(feed))}/>
          </div>
        </ViewFeedContainerWithEdit>
        <Divider />
        <ViewFeedContainerWithEdit>
          <SectionSubtitle>Title</SectionSubtitle>
          <div>
            { this.state.editingTitle 
              ? <Input disabled={this.state.saving || this.state.removing} placeholder={feed.title} fluid onChange={e => this.setState({ title: e.target.value }, () => this.onClickFeedRow(feed))} value={this.state.title || feed.title} />
              : <p>{feed.title}</p>
            }
            <Button content={this.state.editingTitle ? 'Cancel' : 'Edit'} onClick={e => this.setState(this.state.editingTitle ? { editingTitle: false, title: '' } : { editingTitle: true, title: '' }, () => this.onClickFeedRow(feed))}/>
          </div>
        </ViewFeedContainerWithEdit>
        <Divider />
      </div>
    )

    modal.show(props, children)
    this.setState({ selectedFeedId: feed.rssName })
  }

  render () {
    const { feeds, channels, guildId, redirect, linkStatuses, guildLimits } = this.props
    const guildFeeds = feeds[guildId]
    const guildChannels = channels[guildId]
    const tableItems = []
    for (const rssName in guildFeeds) {
      const feed = guildFeeds[rssName]
      tableItems.push(feed)
    }

    const channelDropdownOptions = []
    for (const id in guildChannels) {
      channelDropdownOptions.push({ text: '#' + guildChannels[id].name, value: id })
    }

    return (
      <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
        <Scrollbars>
          <MainContent ref={ref => this.bodyRef}>
            <PageHeader heading='Feed Management' subheading='Manage and edit your feeds.' />
            <Divider />
            <SectionTitle heading='Current' subheading='View and your current feeds.' sideComponent={
              <FeedLimitContainer>
                <Popup content={<span>Need more? <a href='https://www.patreon.com/discordrss' target='_blank' rel='noopener noreferrer'>Become a supporter!</a></span>} position='left center' hideOnScroll hoverable inverted trigger={<span>{tableItems.length}/{guildLimits[guildId] === 0 ? '∞' : guildLimits[guildId]}</span>} />
                <a href='https://www.patreon.com/discordrss' target='_blank' rel='noopener noreferrer'><Icon color='green' name='arrow circle up' /></a>
              </FeedLimitContainer>
            } />
            <PaginatedTable.Table
              basic
              unstackable
              items={tableItems}
              compact={tableItems.length > 5}
              maxPerPage={tableItems.length > 5 ? 10 : 5}
              headers={['', 'Title', 'Link', 'Channel']}
              itemFunc={feed => {
                return (
                  <PaginatedTable.Row active={feed.rssName === this.state.selectedFeedId} style={{ cursor: 'pointer' }} key={feed.rssName}onClick={e => this.onClickFeedRow(feed)}>
                    <PaginatedTable.Cell collapsing>
                      { feed.disabled
                        ? <Icon name='warning circle' size='large' color='yellow' />
                        : typeof linkStatuses[feed.link] === 'string'
                          ? <Icon name='dont' size='large' color='red' />
                          : <Icon name='check circle' size='large' color='green' />
                      }
                    </PaginatedTable.Cell>
                    <PaginatedTable.Cell>{feed.title}</PaginatedTable.Cell>
                    <PaginatedTable.Cell>{feed.link}</PaginatedTable.Cell>
                    <PaginatedTable.Cell>{channels[guildId] && channels[guildId][feed.channel] ? `#${channels[guildId][feed.channel].name}` : `Unknown (${feed.channel})`}</PaginatedTable.Cell>
                  </PaginatedTable.Row>
                )
              }}
              searchFunc={(feed, search) => {
                for (const key in feed) {
                  if (typeof feed[key] === 'string' && feed[key].includes(search)) return true
                }
                return false
              }} />
            <Divider />
            <SectionTitle heading='Add' subheading={<span>{`Add a new feed. You may have a maximum of ${guildLimits[guildId] === 0 ? '∞' : guildLimits[guildId]} feeds. Need more? `}<a href='https://www.patreon.com/discordrss' target='_blank' rel='noopener noreferrer'>Become a supporter!</a></span>} />
            <AddFeed channelDropdownOptions={channelDropdownOptions} />
            <Divider />
          </MainContent>
        </Scrollbars>
        <SideBarContainer>
          <SideBar selectedFeedId={this.state.selectedFeedId} channelDropdownOptions={channelDropdownOptions} onDeletedFeed={() => this.setState({ selectedFeedId: '' })} redirect={redirect} />
        </SideBarContainer>
      </div>
    )
  }
}

Feeds.propTypes = {
  setToThisPage: PropTypes.func,
  guildId: PropTypes.string,
  feedId: PropTypes.string,
  channels: PropTypes.object,
  redirect: PropTypes.func,
  linkStatuses: PropTypes.object,
  feeds: PropTypes.object
}

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(Feeds))
