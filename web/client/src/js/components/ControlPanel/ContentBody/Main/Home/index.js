import React, { Component } from 'react'
import styled from 'styled-components'
import { changePage, setActiveGuild } from 'js/actions/index-actions'
import { Divider, Button, Popup, Form } from 'semantic-ui-react'
import DiscordAvatar from '../../../utils/DiscordAvatar'
import { connect } from 'react-redux'
import PropTypes from 'prop-types'
import pages from 'js/constants/pages'
import SectionTitle from 'js/components/utils/SectionTitle'
import PageHeader from 'js/components/utils/PageHeader'
import AlertBox from 'js/components/utils/AlertBox'
import Wrapper from 'js/components/utils/Wrapper'
import toast from '../../../utils/toast'
import axios from 'axios'
import modal from '../../../utils/modal'
import MenuButton from '../../../LeftMenu/MenuButton'
import posed from 'react-pose'

const mapStateToProps = state => {
  return {
    guildId: state.guildId,
    user: state.user,
    guilds: state.guilds,
    feeds: state.feeds,
    channels: state.channels,
    csrfToken: state.csrfToken
  }
}

const mapDispatchToProps = dispatch => {
  return {
    setToThisPage: () => dispatch(changePage(pages.DASHBOARD)),
    setActiveGuild: guildId => dispatch(setActiveGuild(guildId))
  }
}

const Container = styled.div`
  padding: 20px;
  @media only screen and (min-width: 930px) {
    padding: 55px;
  }
  width: 100%;
`

const ServerButtonInner = styled.div`
  display: flex;
  align-items: center;
  h4 {
    margin: 0;
  }
  > div {
    margin-right: 10px;
  }
`

const ServerEditButtonStyles = styled(Wrapper)`
  display: flex;
  overflow: hidden;
  padding: 15px;
  border-style: none;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  margin-bottom: 5px;
  > .ui.button {
    margin-right: 1em;
  }
`

const ServerEditButtons = posed(ServerEditButtonStyles)({
  enter: { height: 66, paddingTop: 15, paddingBottom: 15, transition: { duration: 200 } },
  exit: { height: 0, paddingTop: 0, paddingBottom: 0, transition: { duration: 200 } }
})

const ServerButton = styled(MenuButton)`
  margin-bottom: 0;
  margin-top: 0;
  ${props => props.selected
  ? `border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;`
  : ''};
`

const FeedbackForm = styled(Form)`
  > div:last-child {
    display: flex;
    justify-content: flex-end;
    margin-top: 1em;
  }
`

const NoServers = styled.div`
  text-align: center;
  color: #72767d;
  font-size: 17px;
  user-select: none;
  padding: 40px 15px;
  > span {
    margin-top: 8px;
    font-size: 16px;
  }
`

class Home extends Component {
  constructor () {
    super()
    this.state = {
      feedbackContent: '',
      saving: false,
      disabledFeedback: false
    }
  }

  componentWillMount () {
    this.props.setToThisPage()
    window.addEventListener("resize", this.updateDimensions);
  }

  updateDimensions = () => {
    const newState = {}
    if (window.innerWidth >= 1000) {
      if (this.state.avatarSize !== '14em') newState.avatarSize = '14em'
    } else if (window.innerWidth < 1000) {
      if (this.state.avatarSize !== '9em') newState.avatarSize = '9em'
    }
    if (Object.keys(newState).length > 0) this.setState(newState)
  }

  componentWillUnmount () {
      window.removeEventListener("resize", this.updateDimensions);
  }

  submitFeedback = () => {
    const content = this.state.feedbackContent.trim()
    if (!content) return
    this.setState({ saving: true })
    axios.post(`/api/feedback`, { message: content }, { headers: { 'CSRF-Token': this.props.csrfToken } }).then(() => {
      this.setState({ saving: false, feedbackContent: '' })
      toast.success(`Thanks for your feedback! I will carefully review it.`)
    }).catch(err => {
      console.log(err.response || err)
      const errMessage = err.response && err.response.data && err.response.data.message ? err.response.data.message : err.response && err.response.data ? err.response.data : err.message
      this.setState({ saving: false, disabledFeedback: errMessage === 'Too many requests' ? true : false })
      toast.error(<p>Failed to send feedback<br/><br/>{errMessage ? typeof errMessage === 'object' ? JSON.stringify(errMessage, null, 2) : errMessage : 'No details available'}</p>)
    })
  }

  onClickServer = id => {
    this.props.setActiveGuild(id)
  }

  showImage = () => {
    modal.showImage('https://upload.wikimedia.org/wikipedia/commons/c/cc/ESC_large_ISS022_ISS022-E-11387-edit_01.JPG', 'alt')

  }

  render () {
    const { guilds, guildId, setActiveGuild, user, feeds, redirect } = this.props
    const selectedGuildIconStyle = { transform: 'scale(1.1)', opacity: 1 }
    const serverIcons = []
    const serverButtons = []
    for (const thisGuildId in guilds) {
      const guild = guilds[thisGuildId]
      serverIcons.push(<Popup key={`dashboard.icon.${thisGuildId}`} trigger={<DiscordAvatar src={!guild.icon ? '' : `https://cdn.discordapp.com/icons/${thisGuildId}/${guild.icon}?size=256`} width='64px' onClick={e => setActiveGuild(thisGuildId)} style={guildId === thisGuildId ? selectedGuildIconStyle : {}} />} inverted content={guild.name} />)
      serverButtons.push(
        <div key={thisGuildId}>
        <ServerButton nonmenu padding='15px' selected={guildId === thisGuildId} onClick={e => this.onClickServer(thisGuildId)} >
          <ServerButtonInner>
            <DiscordAvatar src={!guild.icon ? '' : `https://cdn.discordapp.com/icons/${thisGuildId}/${guild.icon}?size=256`} width='48px' onClick={e => setActiveGuild(thisGuildId)} style={guildId === thisGuildId ? selectedGuildIconStyle : {}} />
            <div>
              <h4>{guild.name}</h4>
              <p>{Object.keys(feeds[thisGuildId]).length} feeds</p>
            </div>
          </ServerButtonInner>
        </ServerButton>
        <ServerEditButtons pose={guildId === thisGuildId ? 'enter' : 'exit'}>
          <Button content='Feeds' onClick={e => redirect(pages.FEEDS)} />
          <Button content='Settings' onClick={e => redirect(pages.SERVER_SETTINGS)} />
        </ServerEditButtons>
        </div>
      )
    }


    return (
      <Container>
        <PageHeader heading={`Hi there, ${user ? user.username : '(no name found)'}!`} subheading='Make your life immensely easier by using this web interface! (though excuse my appearance while I am still under construction)' />
        <AlertBox>
          This UI is still under development! Occasional issues are expected - please report them if you encounter any!
        </AlertBox>
        {/* <Divider />
        <h2>What is Discord.RSS?</h2>
        <ParagraphText>
          Discord.RSS is an RSS bot.
        </ParagraphText>
        <Divider />
        <SectionTitle>
          <h3>Servers</h3>
          <p>Select a server to see its feeds. All your changes will be reflected for this feed in this server. You may also change your active server in the left menu. Only servers where you have Manage Channel permissions, and the bot is a member will be shown.</p>
        </SectionTitle>
        <SelectedGuildContainer>
          <h4>SELECTED</h4>
          <p>{guilds[guildId] ? `${guilds[guildId].name} (${guildId})` : Object.keys(guilds).length === 0 ? 'No servers found' : 'None selected'}</p>
        </SelectedGuildContainer>
        <ServerIconsWrapper>
          {serverIcons}
        </ServerIconsWrapper> */}

        <Divider />
        <SectionTitle heading='Servers' subheading='Select a server to start seeing its feeds. Only servers where you have Manage Channel permissions, and the bot is a member will be shown. You can also change your active server in the left menu.' />
        { serverButtons.length > 0
        ? serverButtons
        : <NoServers>
            <h4>NO ELIGIBLE SERVERS</h4>
            <span>Make sure Discord.RSS is in the right servers where you have MANAGE CHANNEL permissions</span>
          </NoServers>
        }

        <Divider />
        {/* <SectionTitle heading='Rating'/>
        <Rating size='massive' maxRating={5} />
        <Divider /> */}
        <SectionTitle heading='Feedback' subheading='Help make this a better experience for all and provide some feedback! ;) Any and all comments, suggestions, critiques and opinions are welcome. Bug reports are also welcome.' />

        <FeedbackForm>
          <Form.Field>
            <label>Feedback</label>
            <textarea onChange={e => this.setState({ feedbackContent: e.target.value })} value={this.state.feedbackContent} />
          </Form.Field>
          <Form.Field>
            <Button content='Submit' type='submit' disabled={this.state.disabledFeedback || !this.state.feedbackContent.trim() || this.state.saving} loading={this.state.saving} onClick={this.submitFeedback} />
          </Form.Field>
        </FeedbackForm>
        <Divider />
      </Container>
    )
  }
}

Home.propTypes = {
  guildId: PropTypes.string,
  guilds: PropTypes.object
}

export default connect(mapStateToProps, mapDispatchToProps)(Home)
