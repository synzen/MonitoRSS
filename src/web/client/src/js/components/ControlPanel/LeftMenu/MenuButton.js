import React from 'react'
import colors from '../../../constants/colors'
import { Popup } from 'semantic-ui-react'
import styled from 'styled-components'
import { lighten, darken } from 'polished'
import PropTypes from 'prop-types'
import { Link } from 'react-router-dom'

const RouterLink = styled(Link)`
  -webkit-tap-highlight-color: transparent;
  outline: none;
  :hover {
    text-decoration: none !important;
  }
  &:active, &:focus {
    border: none;
  }
`

const ButtonBlank = styled.a`
  display: flex;
  text-align: left;
  align-items: center;
  padding: ${props => props.padding || '10px 20px'};
  margin: .5em 0;
  border-radius: .25em;
  color: ${props => props.disabled || props.unsupported ? darken(0.4, colors.discord.text) : props.selected ? 'white' : lighten(0.45, colors.discord.darkButNotBlack)};
  background-color: ${props => props.disabled || props.unsupported ? 'transparent' : props.selected ? colors.discord.blurple : 'transparent'};
  /* width: 100%; */
  user-select: none;
  cursor: ${props => props.disabled || props.unsupported ? 'not-allowed' : props.selected ? 'default' : 'pointer'} !important;
  &:hover {
    user-select: none;
    text-decoration: none !important;
    /* color: white; */
    color: ${props => props.disabled || props.unsupported ? darken(0.4, colors.discord.text) : 'white'};
    background-color: ${props => props.disabled || props.unsupported ? 'transparent' : props.selected ? colors.discord.blurple : 'transparent'}; // '#292B2F'};
    cursor: pointer;
  }
  &:active {
    /* background-color: #202225; */
    /* background-color: ${props => props.disabled || props.unsupported ? 'transparent' : props.selected ? colors.discord.blurple : 'rgba(255, 255, 255, .08)'}; */
  }
`

function MenuButton (props) {
  return props.nonmenu
    ? <ButtonBlank {...props} onClick={props.onClick} padding={props.padding}>
      {props.children}
    </ButtonBlank>
    : !props.disabled && !props.unsupported
      ? <ButtonBlank {...props} to={props.to} onClick={props.onClick} as={RouterLink} padding={props.padding}>
        {props.children}
      </ButtonBlank>
      : <Popup content={props.disabled ? 'You must select a feed first!' : 'Not yet implemented, sorry!'} inverted position='top left' trigger={
        <ButtonBlank {...props} onClick={props.onClick} padding={props.padding}>
          {props.children}
        </ButtonBlank>} />
}

MenuButton.propTypes = {
  children: PropTypes.node,
  unsupported: PropTypes.bool,
  disabled: PropTypes.bool,
  onClick: PropTypes.func,
  to: PropTypes.string,
  padding: PropTypes.string,
  nonmenu: PropTypes.bool
}

export default MenuButton
