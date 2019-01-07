import React, { Component } from 'react'
import colors from '../../../constants/colors'
import styled from 'styled-components'
import { lighten, darken } from 'polished'
import { setGuildChannels, setGuildAuthorization, setActiveGuild } from '../../../actions/index-actions'
import { Divider, Input, Button, List, Popup, Dropdown } from 'semantic-ui-react'
import DiscordAvatar from '../../utils/DiscordAvatar'
import FeedTable from './FeedTable/index'
import { connect } from 'react-redux'
import PropTypes from 'prop-types'
import Alert from 'react-s-alert'
import axios from 'axios'

const mapStateToProps = state => {
  return {
    guildId: state.activeGuild,
    guilds: state.guilds
  }
}

const mapDispatchToProps = dispatch => {
  return {
    setGuildChannels: channels => dispatch(setGuildChannels(channels)),
    setGuildAuthorization: guildId => dispatch(setGuildAuthorization(guildId))
  }
}

const ServerBackground = styled.div`
  position: relative;
  background: url('https://i.imgur.com/eS4IxK3.png');
  /* background-size: cover;
  background-attachment: fixed; */
  /* background-color:  ${lighten(0.02, colors.discord.notQuiteblack)}; */
  width: 100%;
  height: 18em;
  margin-bottom: 11em;
  /* z-index: 10; */
`

const ServerBlock = styled.div`
  display: flex;
  flex-direction: row;
  position: absolute;
  bottom: -7em;
  left: 7em;
  /* background: green; */
  height: 14em;
`

const ServerBlockTextContainer = styled.div`
  justify-content: center;
  /* background: green; */
  padding: 2em;
  padding-bottom: 2.75em;
  text-align: left;
  display: flex;
  flex-direction: column;
`

const ServerBlockTitle = styled.h1`
  text-align: end;
  color: white;
  margin: 0;
`

const ServerBlockText = styled.p`
  padding-top: 1.5em;
  color: ${lighten(0.5, colors.discord.darkButNotBlack)};
`

const GuildContentWrapper = styled.div`
  /* margin-top: 10em; */
  margin-left: 7em;
  margin-right: 7em;
  /* background: green; */
  /* align-self: center;
  justify-self: center; */
`

const SettingBox = styled.div`
  display: flex;
  flex-grow: 1;
  flex-direction: column;
  text-align: left;
  margin-bottom: 1em;
  h4 {
    color: ${colors.discord.text};
  }
  p {
    color: ${darken(0.3, colors.discord.text)}
  }
  input {
    margin-bottom: 0.5em !important;
  }
  /* background: gray; */
`

const Card = styled(SettingBox)`
  display: flex;
  align-content: center;
  align-items: center;
  h3 {
    color: white;
    text-align: center;
    align-content: center;
    justify-content: center;
    align-self: center;
  }
`

class Dashboard extends Component {
  constructor () {
    super()
    this.state = {

    }
  }

  componentDidUpdate (prevProps) {
    if (this.props.guildId === prevProps.guildId || !this.props.guildId) return
    console.log(`requesting with`, this.props.guildId)
    axios.get(`/api/guilds/${this.props.guildId}/channels`)
      .then(({ data }) => {
        const guildStateChanels = {}
        for (const channel of data) guildStateChanels[channel.id] = channel
        this.props.setGuildChannels(guildStateChanels)
        this.props.setGuildAuthorization(true)
      }).catch(err => {
        if (err.response.status === 403) this.props.setGuildAuthorization(false)
        console.log('dashboard index channels get', err.response)
      })
  }

  render () {
    const { guilds, guildId } = this.props
    const ref = guilds[guildId]
    const authorized = !ref || ref.authorized === undefined ? '...' : ref.authorized ? 'AUTHORIZED' : 'UNAUTHORIZED'
    const avatar = guildId ? `https://cdn.discordapp.com/icons/${guildId}/${ref.icon}?size=256` : undefined
    const guildName = guildId ? ref.name : undefined

    return (
      <div>
        <ServerBackground>
          {/* Hello world */}
          <ServerBlock>
            <DiscordAvatar src={avatar} width={'14em'} />
            <ServerBlockTextContainer>
              <ServerBlockTitle>{guildName || 'No Server Selected'}</ServerBlockTitle>
              <ServerBlockText>{authorized}</ServerBlockText>
            </ServerBlockTextContainer>
          </ServerBlock>
        </ServerBackground>
        <GuildContentWrapper>
          <FeedTable />
          <Divider />
          {/* <SettingBoxContainerWrapper>
            <SettingBoxContainer>
              <Card>
                <h4>Feed Limit</h4>
                <div><h3>5 Minutes</h3></div>
              </Card>
              <Card>
                <h4>Refresh Rate</h4>
              </Card>
            </SettingBoxContainer>
            <SettingBoxContainer>
              <SettingBox>
                <h4>Timezone</h4>
                <p>Hello world</p>
                <HorizontalInput>
                  <Input disabled fluid />
                  <Button content='Edit' />
                </HorizontalInput>
              </SettingBox>
              <SettingBox>
                <h4>Feed Alerts Prefix</h4>
                <p>Hello world</p>
                <AlertList>
                  <List.Item>4678i946691</List.Item>
                  <List.Item>1468i579365</List.Item>
                  <List.Item>124q506845e</List.Item>
                  <List.Item>12450398502</List.Item>
                  <List.Item>12094353645</List.Item>
                </AlertList>
                <Button content='Edit' />
              </SettingBox>
            </SettingBoxContainer>
            <SettingBoxContainer>
              <SettingBox>
                <h4>Command Prefix</h4>
                <p>Hello world</p>
                <HorizontalInput>
                  <Input disabled fluid />
                  <Button content='Edit' />
                </HorizontalInput>
              </SettingBox>
              <SettingBox>
                <h4>Date Language</h4>
                <p>Hello world</p>
                <HorizontalInput>
                  <Input disabled fluid />
                  <Button content='Edit' />
                </HorizontalInput>
              </SettingBox>
              <SettingBox>
                <h4>Date Format</h4>
                <p>Hello world</p>
                <HorizontalInput>
                  <Input disabled fluid />
                  <Button content='Edit' />
                </HorizontalInput>
              </SettingBox>
            </SettingBoxContainer>
          </SettingBoxContainerWrapper>
          <Divider />
          <h3>Title</h3> */}
        </GuildContentWrapper>
      </div>
    )
  }
}

Dashboard.propTypes = {
  guildId: PropTypes.string,
  guilds: PropTypes.object
}

export default connect(mapStateToProps, mapDispatchToProps)(Dashboard)
