import React from 'react'
import { withRouter } from 'react-router-dom'
import { connect } from 'react-redux'
import { Button } from 'semantic-ui-react'
import styled from 'styled-components'
import TextArea from 'js/components/utils/TextArea'
import PopInButton from '../../../utils/PopInButton'
import toast from '../../../utils/toast'
import PropTypes from 'prop-types'
import axios from 'axios';

const mapStateToProps = state => {
  return {
    guildId: state.guildId,
    feedId: state.feedId,
    csrfToken: state.csrfToken
  }
}

const MessageArea = styled.div`
  margin-bottom: 1.5em;
`

const ActionButtons = styled.div`
  display: flex;
  justify-content: flex-end;
  .ui.button {
    margin-left: 1em;
    margin-top: 1em;
  }
`

class MessageSettings extends React.PureComponent {
  constructor () {
    super()
    this.state = {
      value: null,
      saving: false
    }
  }

  componentDidUpdate (prevProps) {
    if (prevProps.messageOriginal !== this.props.messageOriginal) this.setState({ value: null }) // Reset the value
  }

  apply = () => {
    const { csrfToken, guildId, feedId, messageOriginal } = this.props
    if (this.state.value === null || this.state.value === messageOriginal) return
    this.setState({ saving: true })
    const payload = { message: this.state.value }
    const toSend = !this.state.value ? axios.delete(`/api/guilds/${guildId}/feeds/${feedId}/message`, { headers: { 'CSRF-Token': csrfToken } }) : axios.patch(`/api/guilds/${guildId}/feeds/${feedId}/message`, payload, { headers: { 'CSRF-Token': csrfToken } })
    toSend
    .then(() => {
      toast.success('Saved new message, woohoo!')
      this.setState({ saving: false, value: null })
    }).catch(err => {
      this.setState({ saving: false })
      if (err.response && err.response.status === 304) return toast.success('No changes detected')
      const errMessage = err.response && err.response.data && err.response.data.message ? err.response.data.message : err.response && err.response.data ? err.response.data : err.message
      toast.error(<p>Failed to update feed message<br/><br/>{errMessage ? typeof errMessage === 'object' ? JSON.stringify(errMessage, null, 2) : errMessage : 'No details available'}</p>)
      console.log(err.response || err.message)
    })
  }

  onUpdate = value => {
    if (value && value.length > 1950) return
    this.setState({ value })
    this.props.onUpdate(value)
  }

  render () {
    const { messageOriginal } = this.props
    const noChanges = this.state.value === null || this.state.value === messageOriginal
    const textAreaVal = this.state.value || this.state.value === '' ? this.state.value : messageOriginal

    return (
      <MessageArea>
        <TextArea onChange={e => this.onUpdate(e.target.value)} placeholder={'Using default message'} value={textAreaVal} lineCount={textAreaVal ? textAreaVal.split('\n').length : 0} />
        <ActionButtons>
          <PopInButton content='Reset' basic inverted onClick={e => this.onUpdate(null)} pose={this.state.saving ? 'exit' : noChanges ? 'exit' : 'enter'} />
          <Button disabled={this.state.saving || noChanges} content='Save' color='green' onClick={this.apply.bind(this)} />
        </ActionButtons>
      </MessageArea>
    )
  }
}

MessageSettings.propTypes = {
  setToThisPage: PropTypes.func
}

export default withRouter(connect(mapStateToProps)(MessageSettings))
