import React from 'react'
import styled from 'styled-components'
import { connect } from 'react-redux'
import PropTypes from 'prop-types'
import { Link } from 'react-router-dom'
import socketStatus from '../../../constants/socketStatus'
import { Icon, Button, Popup } from 'semantic-ui-react'
import { darken } from 'polished'

const mapStateToProps = state => {
  return {
    guilds: state.guilds,
    feeds: state.feeds
  }
}

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
  /* justify-content: cen; */
  align-items: center;
  user-select: none;
  justify-content: space-between;
  /* cursor: pointer; */
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
  height: 4em;
  @media screen and (min-height: 400px) and (min-width: 525px) {
    height: 5em;
  }
`
const Logo = styled.img`
  height:  2em;
  margin-right: 0.75em;
`

const Title = styled.h2`
  color: ${darken(0.1, 'white')};
  margin: 0;
  
  /* font-weight: 300; */
`

const ExpandButton = styled(Button)`
  margin-right: 1em !important;
`

class App extends React.PureComponent {
  constructor () {
    super()
    this.state = {
      hideExperimental: window.innerWidth < 500
    }
  }

  componentWillMount () {
    window.addEventListener("resize", this.updateDimensions)
  }

  componentWillUnmount = () => {
    window.removeEventListener("resize", this.updateDimensions)
  }

  updateDimensions = () => {
    if (!this.state.hideExperimental && window.innerWidth < 500) this.setState({ hideExperimental: true })
    else if (this.state.hideExperimental && window.innerWidth >= 500) this.setState({ hideExperimental: false })
  }

  render () {
    return (
      <BrandTitleContainer hideExpandButton={this.props.hideExpandButton}>
      
        <div>
          <ExpandButton className='expand-left-menu-btn' icon='list' basic onClick={this.props.toggleLeftMenu} />
          {/* {this.props.hideExpandButton ? null : } */}
          <RouterLink to='/'>
            <Logo src='https://discordapp.com/assets/d36b33903dafb0107bb067b55bdd9cbc.svg' />
            <Title>Discord.RSS</Title>
          </RouterLink>
        </div>
        <div>
          {/* {this.state.hideExperimental
          ? null
          : <Popup
            trigger={<h3 style={{ margin: 0, paddingRight: '1em' }}>EXPERIMENTAL</h3>}
            inverted
            content='This is a highly experimental UI only for patron use'
          />
          } */}
          {
            this.props.socketStatus === socketStatus.CONNECTED
              ? <Popup trigger={<Icon name={'check circle outline'} size='large' color='green' />} content='Server is connected, and all changes are bidirectionally live' position='bottom left' inverted/>
              : this.props.socketStatus === socketStatus.DISCONNECTED ? <Popup trigger={<Icon name={'x'} size='large' color='red' />} content='Server is disconnected. No changes will be saved!' position='bottom left' inverted/>
                : <Popup trigger={<Icon name={'question circle outline'} size='large' color='grey' />} content='Attempting to connect to server...' position='bottom left' inverted/>
          }
        </div>
      </BrandTitleContainer>
    )
  }
}

App.propTypes = {
  hideExpandButton: PropTypes.bool,
  toggleLeftMenu: PropTypes.func,
  socketStatus: PropTypes.number
}

export default connect(mapStateToProps)(App)
