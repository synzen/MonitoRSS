import React, { Component } from 'react'
import { withRouter, Redirect } from 'react-router-dom'
import { connect } from 'react-redux'
import { changePage } from 'js/actions/index-actions'
import pages from 'js/constants/pages'
import PropTypes from 'prop-types'
import styled from 'styled-components'
import PopInButton from '../../../utils/PopInButton'
import colors from 'js/constants/colors'
import SectionItemTitle from 'js/components/utils/SectionItemTitle'
import PageHeader from 'js/components/utils/PageHeader'
import { Divider, Checkbox, Button } from 'semantic-ui-react'
import SectionSubtitle from 'js/components/utils/SectionSubtitle';
import axios from 'axios'
import toast from '../../../utils/toast'

const mapStateToProps = state => {
  return {
    defaultConfig: state.defaultConfig,
    guildId: state.guildId,
    feedId: state.feedId,
    feed: state.feed,
    csrfToken: state.csrfToken
  }
}

const mapDispatchToProps = dispatch => {
  return {
    setToThisPage: () => dispatch(changePage(pages.MISC_OPTIONS)),
    toDashboard: () => dispatch(changePage(pages.DASHBOARD))
  }
}

const Container = styled.div`
  padding: 20px;
  @media only screen and (min-width: 930px) {
    padding: 55px;
  }
  width: 100%;
  max-width: 840px;
`

const MiscOptionContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  > div {
    max-width: calc(100% - 80px);
  }
`

const SaveButtonContainer = styled.div`
  display: flex;
  justify-content: flex-end;
  .ui.button {
    margin-left: 1em;
  }
`

const Categories = styled.div`
  > div {
    margin-top: 50px;
    &:first-child {
      margin-top: 30px;
    }
  }
`

const Description = styled.p`
  color: ${colors.discord.subtext};
`

const boolToText = bool => bool ? 'Enabled' : 'Disabled'
const configKeyNames = {
  checkTitles: 'checkTitles',
  checkDates: 'checkDates',
  imgPreviews: 'imgPreviews',
  imgLinksExistence: 'imgLinksExistence',
  formatTables: 'formatTables',
  toggleRoleMentions: 'toggleRoleMentions'
}
const configKeys = Object.keys(configKeyNames)

class MiscOptions extends Component {
  constructor () {
    super()
    const state = {
      saving: false,
      initialized: false
    }
    configKeys.forEach(key => {
      state[key] = false
    })

    this.state = state
  }

  componentWillMount () {
    const { feed } = this.props
    if (!feed) {
      this.props.toDashboard()
      return <Redirect to='/' />
    } else this.props.setToThisPage()
  }

  componentDidMount () {
    this.reset()
  }

  componentDidUpdate (prevProps) {
    const { feed } = this.props
    const prevFeed = prevProps.feed
    if (feed && prevFeed) {
      for (const key of configKeys) {
        if (feed[key] !== prevFeed[key]) return this.reset()
      }
    } else if (!prevFeed && feed) return this.reset()
  }

  reset = () => {
    const { feed, defaultConfig } = this.props
    if (!feed) {
      this.props.toDashboard()
      return <Redirect to='/' />
    }
    const newState = {}
    if (!this.state.initialized) newState.initialized = true
    configKeys.forEach(key => {
      newState[key] = feed[key] === undefined ? defaultConfig[key] : feed[key]
    })
    this.setState(newState)
  }

  checkFeedExists = () => {
    const { feed } = this.props
    if (!feed) {
      this.props.toDashboard()
      return <Redirect to='/' />
    }
  }

  updateProperty = (key, val) => {
    this.setState({ [key]: val })
  }

  apply = () => {
    const { csrfToken, guildId, feedId } = this.props
    const payload = {}
    for (const key of configKeys) payload[key] = this.state[key]
    axios.patch(`/api/guilds/${guildId}/feeds/${feedId}`, payload, { headers: { 'CSRF-Token': csrfToken } }).then(() => {
      toast.success('Saved changes, woohoo!')
      this.setState({ saving: false })
    }).catch(err => {
      if (err.response && err.response.status === 304) {
        this.setState({ saving: false})
        return toast.success('No changes detected')
      } else this.setState({ saving: false })
      console.log(err.response || err.message)
      const errMessage = err.response && err.response.data && err.response.data.message ? err.response.data.message : err.response && err.response.data ? err.response.data : err.message
      toast.error(<p>Failed to update feed embed<br/><br/>{errMessage ? typeof errMessage === 'object' ? JSON.stringify(errMessage, null, 2) : errMessage : 'No details available'}</p>)
    })
  }

  render () {
    const { feed, defaultConfig } = this.props
    if (!feed) {
      this.props.toDashboard()
      return <Redirect to='/' />
    }

    let unsaved = false
    if (this.state.initialized) {
      for (const key of configKeys) {
        if (unsaved) continue
        const defaultValue = feed[key] === undefined ? defaultConfig[key] : feed[key]
        const thisValue = this.state[key]
        if (defaultValue !== thisValue) unsaved = true
      }
    }

    return (
      <Container>
        <PageHeader>
          <h2>Misc Options</h2>
          <Description>Miscellaneous options that changes various aspects of your feed.</Description>
        </PageHeader>
        <Categories>
          <div>
            <SectionSubtitle>Algorithms</SectionSubtitle>
            <MiscOptionContainer>
              <div>
                <SectionItemTitle>Title Checks</SectionItemTitle>
                <Description>ONLY ENABLE THIS IF NECESSARY! Title checks will ensure no article with the same title as a previous one will be sent for a specific feed.</Description>
                <Description>Default: {boolToText(defaultConfig.checkTitles)}</Description>
              </div>
              <Checkbox disabled={!this.state.initialized} checked={this.state.checkTitles} toggle onChange={(e, data) => this.updateProperty(configKeyNames.checkTitles, data.checked)} />
            </MiscOptionContainer>
            <Divider />
            <MiscOptionContainer>
              <div>
                <SectionItemTitle>Date Checks</SectionItemTitle>
                <Description>Date checking ensures that articles that are either older than {defaultConfig.cycleMaxAge} day{defaultConfig.cycleMaxAge > 1 ? 's' : ''} or has invalid/no published dates are never sent. This MUST be enabled for feeds with no {`{date}`} placeholder.</Description>
                <Description>Default: {boolToText(defaultConfig.checkDates)}</Description>
              </div>
              <Checkbox disabled={!this.state.initialized} checked={this.state.checkDates} toggle onChange={(e, data) => this.updateProperty(configKeyNames.checkDates, data.checked)} />
            </MiscOptionContainer>
            <Divider />
          </div>

          <div>
            <SectionSubtitle>Formatting</SectionSubtitle>
            <MiscOptionContainer>
              <div>
                <SectionItemTitle>Image Links Preview</SectionItemTitle>
                <Description>Toggle automatic Discord image link embedded previews for image links found inside placeholders such as {`{description}`}.</Description>
                <Description>Default: {boolToText(defaultConfig.imgPreviews)}</Description>
              </div>
              <Checkbox disabled={!this.state.initialized} checked={this.state.imgPreviews} toggle onChange={(e, data) => this.updateProperty(configKeyNames.imgPreviews, data.checked)} />
            </MiscOptionContainer>
            <Divider />
            <MiscOptionContainer>
              <div>
                <SectionItemTitle>Image Links Existence</SectionItemTitle>
                <Description>Remove image links found inside placeholders such as {`{description}`}. If disabled, all image src links in such placeholders will be removed.</Description>
                <Description>Default: {boolToText(defaultConfig.imgLinksExistence)}</Description>
              </div>
              <Checkbox disabled={!this.state.initialized} checked={this.state.imgLinksExistence} toggle onChange={(e, data) => this.updateProperty(configKeyNames.imgLinksExistence, data.checked)} />
            </MiscOptionContainer>
            <Divider />
            <MiscOptionContainer>
              <div>
                <SectionItemTitle>Tables Support</SectionItemTitle>
                <Description>If table formatting is enabled, they should be enclosed in code blocks to ensure uniform spacing.</Description>
                <Description>Default: {boolToText(defaultConfig.formatTables)}</Description>
              </div>
              <Checkbox disabled={!this.state.initialized} checked={this.state.formatTables} toggle onChange={(e, data) => this.updateProperty(configKeyNames.formatTables, data.checked)} />
            </MiscOptionContainer>
            <Divider />
          </div>

          <div>
            <SectionSubtitle>Other</SectionSubtitle>
            <MiscOptionContainer>
              <div>
                <SectionItemTitle>Role Mentioning</SectionItemTitle>
                <Description>Turns on role mentionability for any subscribed roles to a feed when articles are about to send, then immediately turns their mentionability off after the article has been sent.</Description>
                <Description>Default: {boolToText(defaultConfig.toggleRoleMentions)}</Description>
              </div>
              <Checkbox disabled={!this.state.initialized} checked={this.state.toggleRoleMentions} toggle onChange={(e, data) => this.updateProperty(configKeyNames.toggleRoleMentions, data.checked)} />
            </MiscOptionContainer>
            <Divider />
          </div>
        </Categories>
        <SaveButtonContainer>
          <PopInButton pose={this.state.saving ? 'exit' : unsaved ? 'enter' : 'exit'} basic inverted content='Reset' onClick={this.reset}></PopInButton>
          <Button disabled={!unsaved || this.state.saving} content='Save' color='green' onClick={this.apply} />
        </SaveButtonContainer>
      </Container>
    )
  }
}

MiscOptions.propTypes = {
  toDashboard: PropTypes.func,
  setToThisPage: PropTypes.func,
  defaultConfig: PropTypes.object,
  guildId: PropTypes.string,
  feedId: PropTypes.string
}

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(MiscOptions))
