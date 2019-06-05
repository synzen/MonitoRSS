import React, { Component } from 'react'
import { withRouter } from 'react-router-dom'
import { connect } from 'react-redux'
import SectionSubtitle from 'js/components/utils/SectionSubtitle'
import PropTypes from 'prop-types'
import styled from 'styled-components'
import { Button, Dropdown, Input } from 'semantic-ui-react'
import { isMobile } from 'react-device-detect'
import axios from 'axios'
import toast from '../../../utils/toast'

const mapStateToProps = state => {
  return {
    feeds: state.feeds,
    channels: state.channels,
    guildId: state.guildId,
    csrfToken: state.csrfToken
  }
}

const AddFeedInputs = styled.div`
  > div {
    margin-bottom: 1em;
  }
  > div:last-child {
    margin-top: 1.5em;
    margin-bottom: 0;
    display: flex;
    justify-content: flex-end;
  }
`

class AddFeed extends Component {
  constructor () {
    super()
    this.state = {
      url: '',
      title: '',
      channel: '',
      saving: false
    }
  }

  add = () => {
    const url = this.state.url.trim()
    const channel = this.state.channel.trim()
    const title = this.state.title.trim()
    if (!this.state.url || !this.state.channel) return
    const { guildId } = this.props
    const payload = {
      link: url,
      channel: channel
    }
    if (title) payload.title = title
    this.setState({ saving: true, title, url, channel })
    axios.post(`/api/guilds/${guildId}/feeds`, payload, { headers: { 'CSRF-Token': this.props.csrfToken } }).then(({ data }) => {
      this.setState({ saving: false, url: '', title: '', channel: '' })
      toast.success(`Added a new feed!`)
    }).catch(err => {
      this.setState({ saving: false })
      console.log(err.response || err)
      const errMessage = err.response && err.response.data && err.response.data.message ? err.response.data.message : err.response && err.response.data ? err.response.data : err.message
      toast.error(<p>Failed to add feed<br/><br/>{errMessage ? typeof errMessage === 'object' ? JSON.stringify(errMessage, null, 2) : errMessage : 'No details available'}</p>)
    })
  }

  render () {
    const { channelDropdownOptions } = this.props

    return (
      <AddFeedInputs>
        <div>
          <SectionSubtitle>URL</SectionSubtitle>
          <Input fluid onChange={e => this.setState({ url: e.target.value })} value={this.state.url} placeholder='Feed URL' onKeyPress={e => e.key === 'Enter' ? this.add() : null} />
        </div>
        <div>
          <SectionSubtitle>Channel</SectionSubtitle>
          <Dropdown selection fluid options={channelDropdownOptions} search={!isMobile} disabled={channelDropdownOptions.length === 0} onChange={(e, data) => this.setState({ channel: data.value })} value={this.state.channel} placeholder='Select a channel' onKeyPress={e => e.key === 'Enter' ? this.add() : null} />
        </div>
        <div>
          <SectionSubtitle>Title (Optional)</SectionSubtitle>
          <Input fluid onChange={e => this.setState({ title: e.target.value })} value={this.state.title} placeholder='This will be automatically resolved if left blank' onKeyPress={e => e.key === 'Enter' ? this.add() : null} />
        </div>
        <div>
          <Button content='Add' color='green' disabled={!this.state.url || !this.state.channel || this.state.saving} onClick={this.add} />
        </div>
      </AddFeedInputs>
    )
  }
}

AddFeed.propTypes = {
  channelDropdownOptions: PropTypes.array
}

export default withRouter(connect(mapStateToProps, null)(AddFeed))
