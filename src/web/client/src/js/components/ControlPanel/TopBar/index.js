import React from 'react'
import styled from 'styled-components'
import PropTypes from 'prop-types'
import { Link } from 'react-router-dom'
import { Button } from 'semantic-ui-react'
import { darken } from 'polished'

const RouterLink = styled(Link)`
  display: flex;
  align-items: center;
  :hover {
    text-decoration: none !important;
  }
  &:active, &:focus {
    outline: 0;
    border: none;
  }
`

const BrandTitleContainer = styled.div`
  position: fixed;
  padding-left: 1em;
  padding-right: 2em;
  box-shadow: 0 2px 0px 0 rgba(0,0,0,0.2);
  display: flex;
  background: #282b30;
  width: 100vw;
  z-index: 500;
  align-items: center;
  user-select: none;
  > a {
    display: flex;
    align-items: center;
  }
  &:hover {
    text-decoration: none;
  }
  > div {
    display: flex;
    align-items: center;
  }
  @media screen and (min-width: 860px) {
    padding-left: 2em;
    .expand-left-menu-btn {
      display: none !important;
    }
  }
  height: 60px;
`
const Logo = styled.img`
  height:  2em;
  margin-right: 0.75em;
`

const Title = styled.h2`
  color: ${darken(0.1, 'white')};
  margin: 0;
`

const ExpandButton = styled(Button)`
  margin-right: 1em !important;
`

function TopBar (props) {
  const { hideExpandButton, toggleLeftMenu } = props
  return (
    <BrandTitleContainer hideExpandButton={hideExpandButton}>
      <ExpandButton className='expand-left-menu-btn' icon='list' basic onClick={toggleLeftMenu} />
      <RouterLink to='/'>
        <Logo src='https://discordapp.com/assets/d36b33903dafb0107bb067b55bdd9cbc.svg' />
        <Title>Discord.RSS</Title>
      </RouterLink>
    </BrandTitleContainer>
  )
}

TopBar.propTypes = {
  hideExpandButton: PropTypes.bool,
  toggleLeftMenu: PropTypes.func
}

export default TopBar
