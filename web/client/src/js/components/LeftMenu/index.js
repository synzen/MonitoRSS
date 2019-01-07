import { Switch, Route, withRouter, Link } from 'react-router-dom'
import { connect } from 'react-redux'
import React, { Component } from 'react'
import colors from '../../constants/colors'
import pages from '../../constants/pages'
import { Divider, Dropdown } from 'semantic-ui-react'
import styled from 'styled-components'
import { lighten, darken, transparentize } from 'polished'
import DiscordAvatar from '../utils/DiscordAvatar'
import MenuButton from './MenuButton'
import { changePage } from '../../actions/index-actions'
import PropTypes from 'prop-types'

const mapStateToProps = state => {
  return {
    selectedFeed: state.activeFeed,
    page: state.page,
    user: state.user,
    feeds: state.feeds,
    guildId: state.activeGuild
  }
}

const mapDispatchToProps = dispatch => {
  return {
    changePage: page => dispatch(changePage(page))
  }
}

const LeftMenuDiv = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-width: 22em;
  /* height: 100%; */
  background: ${darken(0.02, colors.discord.darkButNotBlack)};
`

const Logo = styled.img`
  height:  2em;
  margin-right: 1.5em;
`

const Title = styled.h2`
  color: ${darken(0.1, 'white')};
  margin: 0;
  /* font-weight: 300; */
`

const Status = styled.h3`
  color: ${darken(0.25, 'white')};
  font-weight: 300;
  margin-bottom: 2em;
`

const MenuSectionHeader = styled.h4`
  /* margin-top: 0; */
  padding-left: 1.5em;
  text-align: left;
  color: white;
  font-weight: 300;
`

const BrandTitleContainer = styled.div`
  padding-left: 2em;
  height: 5em;
  box-shadow: 0 2px 0px 0 rgba(0,0,0,0.2);
  display: flex;
  /* justify-content: cen; */
  align-items: center;
  user-select: none;
  /* cursor: pointer; */
  &:hover {
    text-decoration: none;
  }
`

const UserCard = styled.div`
  color: ${darken(0.15, 'white')};
  /* width: 100%; */
  align-items: center;
  background-color: ${darken(0.03, colors.discord.darkButNotBlack)};
  border-style: solid;
  border-width: 1px;
  border-color: ${transparentize(0.5, darken(0.1, colors.discord.darkButNotBlack))};
  display: flex;
  /* justify-content: space-evenly; */
  padding: .75em;
  border-radius: 0.5em;
  margin: 1.5em 1em;
`

const UserCardTextContainer = styled.div`
  display: flex;
  height: 4em;
  flex-direction: column;
  justify-content: space-between
  text-align: left;
  margin-left: 1.5em;
  & p:first-child {
    font-weight: bold;
  }
`

const MyDropdown = styled(Dropdown)`
  /* margin-left: 1em;
  margin-right: 1em; */
  width: 85%;
  margin-bottom: 1em;
  background-color: green;
  &:hover {
    cursor: not-allowed;
  }
`

const RouterLink = styled(Link)`
  &:active, &:focus {
    outline: 0;
    border: none;
  }
`

class LeftMenu extends Component {
  constructor () {
    super()
    this.state = {
      page: pages.DASHBOARD
    }
  }

  render () {
    const { guildId, feeds, user, selectedFeed } = this.props
    const dropdownOptions = !feeds[guildId] ? [] : feeds[guildId].map((feed, i) => {
      return { text: `${i + 1} - ${feed.title}`, value: feed.rssName }
    })

    const userAvatar = user ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : undefined
    return (
      <LeftMenuDiv>
        <div>
          <RouterLink to='/' onClick={() => this.props.changePage(pages.DASHBOARD)}>
            <BrandTitleContainer>
              <Logo src='https://discordapp.com/assets/d36b33903dafb0107bb067b55bdd9cbc.svg' />
              <Title>Discord.RSS</Title>
            </BrandTitleContainer>
          </RouterLink>
          <UserCard>
            <DiscordAvatar src={userAvatar} width='4em' />
            <UserCardTextContainer>
              <p>{user ? user.username : undefined}</p>
              <p>ID {user ? user.id : undefined}</p>
            </UserCardTextContainer>
          </UserCard>
          <Divider />
          <RouterLink to='/' onClick={() => this.props.changePage(pages.DASHBOARD)}><MenuButton active={this.props.page === pages.DASHBOARD}>Dashboard</MenuButton></RouterLink>
          <Divider />
          <MenuSectionHeader>Selected Feed</MenuSectionHeader>
          <MyDropdown options={dropdownOptions} selection value={selectedFeed} />
          <Divider />
          <MenuSectionHeader>Feed Customizations</MenuSectionHeader>
          <RouterLink to='/filters' onClick={() => this.props.changePage(pages.FILTERS)}><MenuButton active={this.props.page === pages.FILTERS}>Filters</MenuButton></RouterLink>
          <RouterLink to='/subscriptions' onClick={() => this.props.changePage(pages.SUBSCRIPTIONS)}><MenuButton active={this.props.page === pages.SUBSCRIPTIONS}>Subscriptions</MenuButton></RouterLink>
          <RouterLink to='/miscoptions' onClick={() => this.props.changePage(pages.MISC_OPTIONS)}><MenuButton active={this.props.page === pages.MISC_OPTIONS}>Misc Options</MenuButton></RouterLink>
          <Divider />
          <MenuSectionHeader>Information</MenuSectionHeader>

          <RouterLink to='/faq' onClick={() => this.props.changePage(pages.FAQ)}><MenuButton active={this.props.page === pages.FAQ}>FAQ</MenuButton></RouterLink>
          <RouterLink to='/support' onClick={() => this.props.changePage(pages.SUPPORT)}><MenuButton disabled active={this.props.page === pages.SUPPORT}>Support</MenuButton></RouterLink>
        </div>
        <div>
          <Divider />
          <MenuButton>Feedback</MenuButton>
        </div>
      </LeftMenuDiv>
    )
  }
}

LeftMenu.propTypes = {
  page: PropTypes.number,
  changePage: PropTypes.func,
  feeds: PropTypes.object,
  user: PropTypes.object,
  guildId: PropTypes.string
}

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(LeftMenu))
