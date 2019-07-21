import React, { useState } from 'react'
import PropTypes from 'prop-types'
import styled from 'styled-components'
import colors from 'js/constants/colors'
import { Icon, Popup } from 'semantic-ui-react'
import { lighten, darken } from 'polished'
import WrapperDark from 'js/components/utils/WrapperDark'
import { Scrollbars } from 'react-custom-scrollbars'

const ButtonBlank = styled.a`
  > div {
    display: flex;
    > i {
      display: flex;
      align-items: center;
    }
    > span {
      color: ${props => props.disabled ? darken(0.4, colors.discord.text) : colors.discord.text};
    }
  }
  display: flex;
  text-align: left;
  align-items: center;
  justify-content: space-between;
  padding: 10px;
  margin: .5em 0 0;
  /* border-radius: .25em; */
  color: ${props => props.disabled ? darken(0.4, colors.discord.text) : props.selected ? 'white' : lighten(0.45, colors.discord.darkButNotBlack)};
  background-color: ${props => props.disabled ? 'transparent' : props.selected ? '#40444B' : 'transparent'};
  border-style: solid;
  border-width: 1px;
  border-color: ${darken(0.5, `rgba(34,36,38,.15)`)};
  /* width: 100%; */
  user-select: none;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'} !important;
  &:hover {
    user-select: none;
    text-decoration: none !important;
    /* color: white; */
    color: ${props => props.disabled ? darken(0.4, colors.discord.text) : 'white'} !important;
    background-color: ${props => props.disabled ? 'transparent' : props.selected ? '#40444B' : '#292B2F'};
    cursor: pointer;
  }
  &:active {
    background-color: ${props => props.disabled ? 'transparent' : '#202225'};
  }
`

const Expandable = styled(WrapperDark)`
  border-top: none;
  border-radius: 0;
  
  overflow: hidden;
  /* padding: 10px; */
  padding: ${props => props.expanded ? '10px' : 0};
  height: ${props => props.expanded ? '100%' : 0};
  max-height: 420px;
  padding: 0;
  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    > li {
      word-break: break-all;
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 5px;
      > div {
        margin-right: 20px;
      }
      &:last-child {
        margin-bottom: 0;
      }
      label {
        margin: 0 5px 0 0;
        display: inline;
        font-size: 14px;
      }
      /* &:before {
        content: ">"
      } */
    }
  }
`

function DetailButton (props) {
  const { numberColor, number, title, disabled, popupText } = props
  const [ show, setShow ] = useState(false)
  const button = (
    <ButtonBlank onClick={e => number !== 0 ? setShow(!show) : null} selected={show} disabled={disabled}>
      <div>
        <Icon name={disabled ? 'x' : show ? 'caret up' : 'caret down'} />
        <span>{title}</span>
      </div>
      <span style={numberColor ? { color: numberColor } : null}>{ number }</span>
    </ButtonBlank>
  )
  const mainBody = (
    <div className='detail-button-body'>
      { popupText
        ? <Popup inverted trigger={button} content={popupText} position='bottom center' />
        : button }

      <Expandable expanded={show} className='expandable'>
        <Scrollbars autoHeight autoHeightMin={0} autoHeightMax={420}>
          <div style={{ padding: '10px 15px' }}>
            {props.children}
          </div>
        </Scrollbars>
      </Expandable>
      

      {/* </Scrollbars> */}
    </div>
  )

  return mainBody
}

DetailButton.propTypes = {
  popupText: PropTypes.string,
  disabled: PropTypes.bool,
  title: PropTypes.string,
  numberColor: PropTypes.string,
  number: PropTypes.number,
  children: PropTypes.node
}

export default DetailButton
