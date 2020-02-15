import { Link } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import React from 'react'
import PropTypes from 'prop-types'
import colors from '../../../constants/colors'
import pages from '../../../constants/pages'
import { Divider, Dropdown, Button, Popup } from 'semantic-ui-react'
import styled from 'styled-components'
import DiscordAvatar from '../utils/DiscordAvatar'
import MenuButton from './MenuButton'
import { isMobile } from 'react-device-detect'
import { Scrollbars } from 'react-custom-scrollbars'
import modal from '../../utils/modal'
import { setActiveGuild } from 'js/actions/guilds'
import { setActiveFeed } from 'js/actions/feeds'
import { changePage } from 'js/actions/page'
import feedSelectors from 'js/selectors/feeds'

const LeftMenuDiv = styled.div`
  display: flex;
  flex-shrink: 0;
  height: 100%;
  flex-direction: column;
  justify-content: space-between;
  width: ${props => props.expanded ? '100vw' : 0};
  transition: opacity 0.25s ease-in-out;
  z-index: 100;
  background: #2f3136;
  opacity: ${props => props.expanded ? 1 : 0};
  scrollbar-width: thin;
  > div {
    width: auto;
  }
  @media screen and (min-width: 860px) {
    position: static;
    width: ${props => props.expanded ? '350px' : 0};
    > div {
      width: auto;
    }
  }
`

const Header = styled(Link)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
  margin-bottom: 30px;
  &:hover {
    text-decoration: none;
  }
  > div {
    display: flex;
    align-items: flex-end;
  }
  h3 {
    color: ${colors.discord.white};
  }
  h4 {
    color: ${colors.discord.text};
  }
`

const Content = styled.div`
  padding: ${props => props.expanded ? '0 calc(19px + 6px) 50px 15px' : '0 0 50px 0'}; /* 6px is the custom scrollbar */
`

const MenuSectionHeader = styled.span`
  font-weight: 600;
  line-height: 16px;
  color: #dcddde;
  text-transform: uppercase;
  font-size: 12px;
  margin-bottom: 8px;
`

const UserContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 10px 0;
  > div {
    display: flex;
    align-items: center;
    overflow: hidden;
  }
  span {
    font-size: 20px;
    font-weight: 600;
    color: ${colors.discord.white};
    margin: 20px 0;
    word-break: break-all;
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
    margin-left: 10px;
    margin-right: 10px;
  }
`

const MyDropdown = styled(Dropdown)`
  display: flex !important;
  margin-bottom: 0;
  margin-top: 7px;
  background-color: green;
  &:hover {
    cursor: not-allowed;
  }
`

const LogoutModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  button {
    padding: 1em 1.5em;
  }
  button {
    background: transparent;
    
    padding-right: 2em;
    color: white;
    user-select: none;
    border-style: none;
    &:hover {
      cursor: pointer;
      color: white;
      text-decoration: underline;
    }
    &:focus {
      outline: none;
    }
  }
`

function LeftMenu (props) {
  const feeds = useSelector(state => state.feeds)
  const guilds = useSelector(state => state.guilds)
  const channels = useSelector(state => state.channels)
  const guildId = useSelector(state => state.activeGuildID)
  const page = useSelector(state => state.page)
  const user = useSelector(state => state.user)
  const feedId = useSelector(feedSelectors.activeFeedID)
  const feed = useSelector(feedSelectors.activeFeed)
  const feedsFetchError = useSelector(feedSelectors.feedsFetchError)
  const articlesFetchError = useSelector(feedSelectors.articlesFetchErrored)
  const feedsFetching = useSelector(feedSelectors.feedsFetching)
  const articlesFetching = useSelector(feedSelectors.articlesFetching)
  const dispatch = useDispatch()
  const feedDropdownOptions = []
  const serverDropdownOptions = []
  for (const storedFeed of feeds) {
    const channel = channels.find(c => c.id === storedFeed.channel)
    const channelText = channel ? ` (#${channel.name})` : ''
    feedDropdownOptions.push({ text: `${storedFeed.title}${channelText}`, value: storedFeed._id })
  }

  for (const guild of guilds) {
    serverDropdownOptions.push({ text: guild.name, value: guild.id })
  }

  const userAvatar = user ? (user.displayAvatarURL || `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`) : undefined
  const noServers = serverDropdownOptions.length === 0
  const noFeeds = feedDropdownOptions.length === 0

  function setGuild (guildID) {
    dispatch(setActiveGuild(guildID))
  }

  function setFeed (feedID) {
    dispatch(setActiveFeed(feedID))
  }

  function menuButtonClick (page) {
    if (!props.disableMenuButtonToggle) {
      props.toggleLeftMenu()
    }
    dispatch(changePage(page))
  }

  function logoutClick () {
    const modalProps = {
      footer: (<LogoutModalFooter>
        <button onClick={modal.hide}>Cancel</button>
        <Button color='red' onClick={e => {
          window.location.href = '/logout'
        }}>Log Out</Button>
      </LogoutModalFooter>)
    }
    const children = <h4 style={{ padding: '0.5em' }}>Are you sure you want to log out?</h4>
    modal.show(modalProps, children)
  }

  const disableFeedButtons = !feedId || feedsFetchError || feedsFetching || articlesFetching || articlesFetchError

  return (
    <LeftMenuDiv expanded={props.expanded}>
      <Scrollbars>
        <Content expanded={props.expanded}>
          <div>
            {props.disableMenuButtonToggle
              ? <Header to='/'>
                <div>
                  <img alt='Discord RSS logo' src='https://discordapp.com/assets/d36b33903dafb0107bb067b55bdd9cbc.svg' width='30px' />
                  <h3 style={{ margin: '0 10px' }}>Discord.RSS</h3>
                  <h4 style={{ margin: 0 }}>Control Panel</h4>
                </div>
              </Header>
              : null
            }
            {/* <Divider /> */}
            <UserContainer>
              <div>
                <DiscordAvatar src={userAvatar} width='30px' />
                <span>{user ? user.username : undefined}</span>
              </div>
              <Popup
                trigger={<Button basic icon='log out' color='red' onClick={logoutClick} />}
                inverted
                position='bottom right'
                content='Log Out'
              />

            </UserContainer>

            {/* <Button fluid content='Logout' basic color='red' onClick={this.logoutClick} /> */}
            <Divider />
            <MenuSectionHeader>Main</MenuSectionHeader>
            <MenuButton to={pages.DASHBOARD} selected={page === pages.DASHBOARD} onClick={() => menuButtonClick(pages.DASHBOARD)}>Home</MenuButton>
            <Divider />
            <MenuSectionHeader>Server</MenuSectionHeader>
            <MyDropdown noResultsMessage='No servers found' search={!isMobile} placeholder={noServers ? 'No servers found' : 'Select a server'} options={serverDropdownOptions} disabled={noServers} value={guildId} selection onChange={(e, data) => setGuild(data.value)} />
            <MenuButton to={pages.FEEDS} disabled={!guildId} selected={page === pages.FEEDS} onClick={() => menuButtonClick(pages.FEEDS)}>Feeds</MenuButton>
            <MenuButton to={pages.SERVER_SETTINGS} disabled={!guildId} selected={page === pages.SERVER_SETTINGS} onClick={() => menuButtonClick(pages.SERVER_SETTINGS)}>Settings</MenuButton>
            <Divider />
            <MenuSectionHeader>Feed</MenuSectionHeader>
            <MyDropdown
              error={!feedsFetching && !articlesFetching && (!!articlesFetchError || feedsFetchError)}
              loading={feedsFetching || articlesFetching}
              noResultsMessage='No feeds found'
              search={!isMobile}
              placeholder={articlesFetching && feed ? `Fetching articles for ${feed.title}...` : noServers ? 'No server found' : noFeeds ? 'No feeds found' : 'Select a feed'}
              options={feedDropdownOptions}
              disabled={noFeeds || articlesFetching}
              value={articlesFetching ? '' : feedId}
              selection
              onChange={(e, data) => setFeed(data.value)} />
            <MenuButton to={pages.MESSAGE} disabled={disableFeedButtons} onClick={() => menuButtonClick(pages.MESSAGE)} selected={page === pages.MESSAGE}>Message</MenuButton>
            <MenuButton to={pages.FILTERS} disabled={disableFeedButtons} onClick={() => menuButtonClick(pages.FILTERS)} selected={page === pages.FILTERS}>Filters</MenuButton>
            <MenuButton to={pages.SUBSCRIBERS} disabled={disableFeedButtons} onClick={() => menuButtonClick(pages.SUBSCRIBERS)} selected={page === pages.SUBSCRIBERS}>Subscribers</MenuButton>
            <MenuButton to={pages.MISC_OPTIONS} disabled={disableFeedButtons} onClick={() => menuButtonClick(pages.MISC_OPTIONS)} selected={page === pages.MISC_OPTIONS}>Misc Options</MenuButton>
            {/* <MenuButton to={pages.DEBUGGER} disabled={disableFeedButtons} onClick={() => menuButtonClick(pages.DEBUGGER)} selected={page === pages.DEBUGGER}>Debugger</MenuButton> */}
            <Divider />
          </div>
          <div />
        </Content>
      </Scrollbars>
    </LeftMenuDiv>
  )
}

LeftMenu.propTypes = {
  disableMenuButtonToggle: PropTypes.bool,
  expanded: PropTypes.bool,
  toggleLeftMenu: PropTypes.func
}

export default LeftMenu
