import React, { useState } from 'react'
import { Link, withRouter } from 'react-router-dom'
import styled from 'styled-components'
import { Icon, Button } from 'semantic-ui-react'
import { darken } from 'polished'
import colors from '../../constants/colors'
import posed from 'react-pose'
import pages from '../../constants/pages'

const Title = styled.h2`
  color: ${darken(0.1, 'white')};
  margin: 0;
`

const MobileNav = styled.nav`
  height: 100%;
  position: relative;
  display: none;
  align-items: center;
  padding: 0 25px;
  > a {
    display: flex;
    margin-left: 25px;
    z-index: 150;
  }
  > .ui.button {
    z-index: 150;
  }
  @media only screen and (max-width: 850px) {
    display: flex;
  }
  z-index: 90;
`

const SidebarStyles = styled.div`
  position: absolute;
  background: black;
  border-bottom-style: solid;
  border-bottom-color: black;
  border-bottom-width: 1px;
  width: 100%;
  z-index: 100;
  top: 0;
  left: 0;
  overflow: hidden;
  > div {
    height: 60px;
    width: 100%;
  }
  > ul {
    list-style: none;
    margin: 0;
    padding: 0;
    /* padding: 0 25px; */
    a {
      display: block;
      padding: 15px 25px 15px 25px;
      color: ${colors.discord.text};
      text-decoration: none;
      > span {
        margin-left: 5px;
      }
    }
      
  }
`

const Sidebar = posed(SidebarStyles)({
  enter: { height: 'auto' },
  exit: { height: 0 }
})

const DesktopNav = styled.nav`
  height: 100%;
  @media only screen and (max-width: 850px) {
    display: none;
  }
`

const NavButtons = styled.ul`
  height: 100%;
  list-style: none;
  padding: 0;
  display: flex;
  /* padding: 0 25px; */
  align-items: center;
  justify-content: space-between;
  margin: 0;
  user-select: none;
`

const NavItem = styled.li`
  position: relative;
  display: flex;
  justify-content: center;
  height: 100%;
  width: 100%;
  
  &:first-child > a {
    user-select: none;
    padding-left: 25px;
    justify-content: left;
  }
  &:last-child {
    height: auto;
    padding-right: 25px;
    justify-content: flex-end;
  }
  > button {
    color: ${colors.discord.text};
    border: none;
    background: none;
    transition: color 0.25s;
    width: 100%;
    cursor: pointer;
    &:focus {
      outline: none;
    }
    &:hover {
      color: white;
      text-decoration: none;
    }
    > i {
      margin-left: 5px;
    }
  }
  /* text-align: center; */
  > a {
    padding: 10px 20px;
    justify-content: center;
    display: flex;
    height: 100%;
    width: 100%;
    align-items: center;
    text-align: center;      
    min-width: 100px;
    cursor: pointer;
    color: ${props => props.selected ? 'white' : colors.discord.text};
    text-decoration: none;
    transition: color 0.25s;
    &:hover {
      color: white;
      text-decoration: none;
    }
    > i {
      margin-left: 5px;
    }
  }
`

const Logo = styled.img`
  height:  2em;
  margin-right: 0.75em;
`

const NavDropdown = styled.ul`
  display: ${props => props.show ? 'block' : 'none'};
  position: absolute;
  list-style: none;
  padding: 0;
  top: 55px;
  z-index: 10;
  background: ${colors.discord.darkButNotBlack};
  padding: 3px 0;
  border-radius: 6px;
  /* border-color: ${colors.discord.greyple}; */
  border-width: 1px;
  /* border-style: solid; */
  min-width: 122px;
`

const DropdownNavItem = styled.li`
  > a {
    cursor: pointer;
    display: block;
    padding: 10px 20px;
    color: ${colors.discord.text};
    &:hover {
      text-decoration: none;
      > span {
        color: black;
      }
      > i {
        color: black;
      }
      
      /* color: ${colors.discord.text}; */
    }
    > span {
      padding-left: 5px;
    }
  }
  &:hover {
    background: ${colors.discord.greyple};
  }
`

function NavBar (props) {
  const [ showNavDropdown, setShowNavDropdown ] = useState(false)
  const [ showMobileNav, setShowMobileNav ] = useState(false)
  const path = props.location.pathname

  return (
    <header style={{ height: '100%' }}>
      <DesktopNav>
        <NavButtons>
          <NavItem select={path === '/'}>
            <Link to='/'>
              <Logo src='https://discordapp.com/assets/d36b33903dafb0107bb067b55bdd9cbc.svg' />
              <Title>Discord.RSS</Title>
            </Link>
          </NavItem>
          <NavItem selected={path === pages.FAQ}><Link to={pages.FAQ}>FAQ</Link></NavItem>
          <NavItem selected={path === pages.FEED_BROWSER}><Link to={pages.FEED_BROWSER}>Feed Browser</Link></NavItem>
          {/* <li onMouseEnter={e => setHoverPatreon(true)} onMouseLeave={e => setHoverPatreon(false)}>Patreon<ExternalIcon pose={hoveringPatreon ? 'enter' : 'exit'} name='external' /></li>
          <li onMouseEnter={e => setHoverGithub(true)} onMouseLeave={e => setHoverGithub(false)}>Github<ExternalIcon pose={hoveringGithub ? 'enter' : 'exit'} name='external' /></li> */}
          <NavItem selected={path === pages.SUPPORT}><a href='https://discord.gg/pudv7Rx' target='_blank' rel='noopener noreferrer'>Support<Icon name='external' size='small' /></a></NavItem>
          <NavItem onMouseEnter={e => setShowNavDropdown(true)} onMouseLeave={e => setShowNavDropdown(false)}>
            <button>Links<Icon name='caret down' size='small' /></button>
            <NavDropdown show={showNavDropdown} >
              <DropdownNavItem><a href='https://github.com/synzen/Discord.RSS' target='_blank' rel='noopener noreferrer'><Icon name='github' /><span>Github</span></a></DropdownNavItem>
              <DropdownNavItem><a href='https://www.patreon.com/discordrss' target='_blank' rel='noopener noreferrer'><Icon name='patreon' style={{ color: '#E85B46' }} /><span>Patreon</span></a></DropdownNavItem>
            </NavDropdown>
          </NavItem>

          <NavItem><Link to={pages.DASHBOARD}><Button basic>Control Panel</Button></Link></NavItem>
        </NavButtons>
      </DesktopNav>
      <MobileNav>
        <Button basic icon={showMobileNav ? 'caret up' : 'list ul'} onClick={e => setShowMobileNav(!showMobileNav)} />
        <Link to='/'>
          <Logo src='https://discordapp.com/assets/d36b33903dafb0107bb067b55bdd9cbc.svg' />
          <Title>Discord.RSS</Title>
        </Link>
        <Sidebar pose={showMobileNav ? 'enter' : 'exit'}>
          <div />
          <ul>
            <li><Link to={pages.FAQ} onClick={e => setShowMobileNav(false)}>FAQ</Link></li>
            <li><Link to={pages.FEED_BROWSER} onClick={e => setShowMobileNav(false)}>Feed Browser</Link></li>
            <li><a href='https://discord.gg/pudv7Rx' target='_blank' rel='noopener noreferrer'>Discord Support<Icon style={{ marginLeft: '5px' }} name='external' size='small' /></a></li>
            <li><a href='https://github.com/synzen/Discord.RSS' target='_blank' rel='noopener noreferrer'><Icon name='github' /><span>Github</span></a></li>
            <li><a href='https://www.patreon.com/discordrss' target='_blank' rel='noopener noreferrer'><Icon name='patreon' style={{ color: '#E85B46' }} /><span>Patreon</span></a></li>
          </ul>
        </Sidebar>
      </MobileNav>
    </header>
  )
}

export default withRouter(NavBar)
