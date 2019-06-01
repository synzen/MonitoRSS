import React, { Component } from 'react'
import { connect } from 'react-redux'
import { withRouter } from 'react-router-dom'
import { setActiveFeed } from 'js/actions/index-actions'
import PageHeader from 'js/components/utils/PageHeader'
import SectionTitle from 'js/components/utils/SectionTitle'
import SectionSubtitle from 'js/components/utils/SectionSubtitle'
import PopInButton from '../../../utils/PopInButton'
import PropTypes from 'prop-types'
import styled from 'styled-components'
import { Button, Dropdown, Input, Divider } from 'semantic-ui-react';
import axios from 'axios'
import toast from '../../../utils/toast'
import { isMobile } from 'react-device-detect'
import posed from 'react-pose'
import pages from 'js/constants/pages'
import colors from 'js/constants/colors';
import moment from 'moment-timezone'
import { Scrollbars } from 'react-custom-scrollbars';

const mapStateToProps = state => {
  return {
    feeds: state.feeds,
    guild: state.guild,
    guildId: state.guildId,
    articlesFetching: state.articlesFetching,
    defaultConfig: state.defaultConfig,
    linkStatuses: state.linkStatuses,
    csrfToken: state.csrfToken
  }
}

const mapDispatchToProps = dispatch => {
  return {
    setActiveFeed: rssName => dispatch(setActiveFeed(rssName))
  }
}

const Container = styled.div`
  width: 425px;
  height: 100%;
  background: #2f3136;
  /* overflow-y: ${props => props.populated ? 'auto' : 'hidden'}; */

`
const EditField = styled.div`
  margin-top: 1em;
`

const Content = styled.div`
  padding: 20px 10px;
  @media only screen and (min-width: 930px) {
    padding: 55px 27px;
  }
`

const ApplyField = styled.div`
  margin-top: 1.5em;
  display: flex;
  justify-content: flex-end;
  .ui.button {
    margin-left: 1em;
  }
`

const PosedDiv = posed.div({
  show: { opacity: 1, transition: { duration: 200 } },
  hide: { opacity: 0, transition: { duration: 200 } }
})

class SideBar extends Component {
  constructor () {
    super()
    this.state = {
      title: '',
      channel: '',
      deleting: false,
      saving: false,
      changingPageTo: ''
    }
  }

  componentDidUpdate (prevProps) {
    const { guildId, feeds, selectedFeedId } = this.props
    const selectedFeed = feeds[guildId] && feeds[guildId][selectedFeedId] ? feeds[guildId][selectedFeedId] : null
    if (prevProps.selectedFeedId !== this.props.selectedFeedId) {
      if (selectedFeed) this.setState({ title: selectedFeed.title, channel: selectedFeed.channel })
      else this.setState({ title: '', channel: '' })
      window.scrollTo(0, 0)
    }
  }

  confirm = () => {
    const { guildId, feeds, selectedFeedId, csrfToken } = this.props
    const selectedFeed = feeds[guildId] && feeds[guildId][selectedFeedId] ? feeds[guildId][selectedFeedId] : null
    if (!selectedFeed) return
    const payload = {}
    if (this.state.title && this.state.title !== selectedFeed.title) payload.title = this.state.title
    if (this.state.channel && this.state.channel !== selectedFeed.channel) payload.channel = this.state.channel
    this.setState({ saving: true })
    axios.patch(`/api/guilds/${guildId}/feeds/${selectedFeedId}`, payload, { headers: { 'CSRF-Token': csrfToken } }).then(() => {
      this.setState({ saving: false })
      toast.success(`Changes saved. Yay!`)
    }).catch(err => {
      this.setState({ saving: false })
      console.log(err.response || err)
      const errMessage = err.response && err.response.data && err.response.data.message ? err.response.data.message : err.response && err.response.data ? err.response.data : err.message
      toast.error(<p>Failed to save changes<br/><br/>{errMessage ? typeof errMessage === 'object' ? JSON.stringify(errMessage, null, 2) : errMessage : 'No details available'}</p>)
    })
  }

  remove = () => {
    const { selectedFeedId, guildId, onDeletedFeed, csrfToken } = this.props
    if (!selectedFeedId) return
    this.setState({ deleting: true })
    axios.delete(`/api/guilds/${guildId}/feeds/${selectedFeedId}`, { headers: { 'CSRF-Token': csrfToken } }).then(() => {
      this.setState({ deleting: false })
      onDeletedFeed()
      toast.success(`Removed feed!`)
    }).catch(err => {
      this.setState({ deleting: false })
      console.log(err.response || err)
      const errMessage = err.response && err.response.data && err.response.data.message ? err.response.data.message : err.response && err.response.data ? err.response.data : err.message
      toast.error(<p>Failed to remove feed<br/><br/>{errMessage ? typeof errMessage === 'object' ? JSON.stringify(errMessage, null, 2) : errMessage : 'No details available'}</p>)
    })
  }

  changePage = async page => {
    const { selectedFeedId, setActiveFeed, redirect } = this.props
    await setActiveFeed(selectedFeedId)
    redirect(page) // Route changes must be bubbled up to the top level components that does the routing since it doesn't work in nested components
  }

  render () {
    const { guildId, guild, feeds, selectedFeedId, channelDropdownOptions, articlesFetching, linkStatuses, defaultConfig } = this.props
    const selectedFeed = feeds[guildId] && feeds[guildId][selectedFeedId] ? feeds[guildId][selectedFeedId] : null
    let differentFromDefault = false
    if (selectedFeed) {
      if (this.state.title && this.state.title !== selectedFeed.title) differentFromDefault = true
      if (this.state.channel && this.state.channel !== selectedFeed.channel) differentFromDefault = true
    }

    const dateTimezone = guild.timezone || defaultConfig.timezone
    const dateFormat = guild.dateFormat || defaultConfig.dateFormat
    const dateLanguage = guild.dateLanguage || defaultConfig.dateLanguage
    const failed = selectedFeed && typeof linkStatuses[selectedFeed.link] === 'string'
    const disabled = selectedFeed && selectedFeed.disabled
    return (
      <Container populated={selectedFeed}>
        <Scrollbars>
        <Content>
        <PageHeader heading='Feed Details' subheading={'Select a feed'} />
        {/* <SectionItemTitle>Feed Details</SectionItemTitle> */}
        <Divider />
        <PosedDiv pose={selectedFeed ? 'show' : 'hide'}>
          <SectionTitle heading='Info' />
          <SectionSubtitle>Status</SectionSubtitle>
            { !selectedFeed
              ? '\u200b'
              : disabled
                ? <span style={{ color: colors.discord.yellow }}>Disabled ({selectedFeed.disabled})</span>
                : failed
                  ? <span style={{ color: colors.discord.red }}>Failed ({moment(linkStatuses[selectedFeed.link]).format('DD MMMM Y')})</span>
                  : <div><span style={{ color: colors.discord.green }}>Normal</span>{defaultConfig.failLimit > 0 ? ` (${linkStatuses[selectedFeed.link] === undefined ? '100' : ((defaultConfig.failLimit - linkStatuses[selectedFeed.link]) / defaultConfig.failLimit * 100).toFixed(0)}% health)` : ''}</div>
          }
          <EditField>
            <SectionSubtitle>Refresh Rate</SectionSubtitle>
        { failed || disabled ? 'None ' : !selectedFeed ? '\u200b' : !selectedFeed.lastRefreshRateMin ? 'To be determined ' : selectedFeed.lastRefreshRateMin < 1 ? `${selectedFeed.lastRefreshRateMin * 60} seconds      ` : `${selectedFeed.lastRefreshRateMin} minutes      `}{ failed ? null : <a href='https://www.patreon.com/discordrss' target='_blank' rel='noopener noreferrer'>－</a> }
          </EditField>
          <EditField>
            <SectionSubtitle>Added On</SectionSubtitle>
            { !selectedFeed ? '\u200b' : !selectedFeed.addedOn ? 'Unknown' : moment(selectedFeed.addedOn).locale(dateLanguage).tz(dateTimezone).format(dateFormat)}
          </EditField>
          <Divider />
          <SectionTitle heading='Edit' />
          <EditField>
            <SectionSubtitle>Title</SectionSubtitle>
            <Input value={this.state.title || (selectedFeed ? selectedFeed.title : '')} fluid disabled={!selectedFeed} onChange={e => this.setState({ title: e.target.value })} />
          </EditField>
          <EditField>
            <SectionSubtitle>Channel</SectionSubtitle>
            <Dropdown value={this.state.channel || (selectedFeed ? selectedFeed.channel : '')} options={channelDropdownOptions} disabled={!selectedFeed || channelDropdownOptions.length === 0} search={!isMobile} selection fluid onChange={(e, data) => this.setState({ channel: data.value })} />
          </EditField>
          <ApplyField>
            <PopInButton basic inverted content='Reset' disabled={this.state.saving} pose={differentFromDefault ? 'enter' : 'exit'} onClick={e => this.setState({ title: '', channel: '' })} />
            <Button content='Save' color='green' disabled={!differentFromDefault} onClick={this.confirm} />
          </ApplyField>
          <Divider />
          <SectionTitle heading='Customize' subheading='So many options!' />
          <EditField>
            <Button fluid content='Message/Embed' icon='angle right' labelPosition='right' onClick={e => this.changePage(pages.MESSAGE)} loading={articlesFetching} disabled={articlesFetching} />
          </EditField>
          <EditField>
            <Button fluid content='Filters' icon='angle right' labelPosition='right' onClick={e => this.changePage(pages.FILTERS)} loading={articlesFetching} disabled={articlesFetching} />
          </EditField>
          <EditField>
            <Button fluid content='Subscriptions' icon='angle right' labelPosition='right' onClick={e => this.changePage(pages.SUBSCRIPTIONS)} loading={articlesFetching} disabled={articlesFetching} />
          </EditField>
          <EditField>
            <Button fluid content='Misc Options' icon='angle right' labelPosition='right' onClick={e => this.changePage(pages.MISC_OPTIONS)} loading={articlesFetching} disabled={articlesFetching} />
          </EditField>
          <Divider />
          <SectionTitle heading='Remove' />
          <EditField>
            <Button fluid content='Remove' basic color='red' loading={this.state.deleting} disabled={this.state.deleting} onClick={this.remove}/>
          </EditField>
          
        </PosedDiv>
        </Content>
        </Scrollbars>
      </Container>
    )
  }
}

SideBar.propTypes = {
  feeds: PropTypes.object,
  selectedFeedId: PropTypes.string,
  guildId: PropTypes.string,
  setActiveFeed: PropTypes.func,
  changePage: PropTypes.func
}

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(SideBar))
