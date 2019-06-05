import React from 'react'
import './js/index'
import styled from 'styled-components'
import { Switch, Route, Link, Redirect } from 'react-router-dom'
import colors from './js/constants/colors'
import 'react-toastify/dist/ReactToastify.min.css'
import './semantic/dist/semantic.min.css'
import { Icon, Button } from 'semantic-ui-react'
import pages from './js/constants/pages'
import './App.css'
import 'highlight.js/styles/solarized-dark.css'
import FeedBrowser from './js/components/FeedBrowser/index'
import ControlPanel from './js/components/ControlPanel/index'

const CleanLink = styled(Link)`
  &:hover {
    text-decoration: none;
  }
`

const EmptyBackground = styled.div`
  height: 100vh;
  width: 100vw;
  background-color: #282b30;
  display: flex;
  flex-direction: column;
  justify-content: center;
  text-align: center;
  align-items: center;
  h1 {
    color: white;
  }
  color: ${colors.discord.text};
`

const LoginContainer = styled.div`
  color: white;
`

class App extends React.PureComponent {
  constructor () {
    super()
    this.state = {}
  }

  render () {
    if (this.state.errorMessage) return (
      <EmptyBackground>
        <div>
          <Icon name='x' size='massive' color='red' />
          <h1>Oops!<br />Something went wrong!</h1>
          <h3>{this.state.errorMessage || ''}</h3>
          <Button basic fluid onClick={e => { window.location.href = '/logout' }} color='red'>Logout</Button>
        </div>
      </EmptyBackground>
    )
    return (
      <div className='App'>

        <Switch>
          <Route exact path='/' render={props => {
            return (
              <EmptyBackground>
                <LoginContainer>
                  <img src='https://discordapp.com/assets/d36b33903dafb0107bb067b55bdd9cbc.svg' width='175em' height='175em' alt='Discord.RSS Logo' />
                  <h1>Discord.RSS</h1>
                  <p style={{ color: colors.discord.yellow }}>Under Construction</p>
                  {this.state.loggedOut
                    ? <Button fluid onClick={e => { window.location.href = '/login' }}>{'Login'}</Button>
                    : <CleanLink to={pages.DASHBOARD}><Button fluid>Control Panel</Button></CleanLink>
                  }
                  <CleanLink to={pages.FEED_BROWSER}><Button style={{ marginTop: '0.5em' }} fluid>Feed Browser</Button></CleanLink>
                </LoginContainer>
              </EmptyBackground>
            )
          }} />

          <Route path={`${pages.FEED_BROWSER}/:url?`} component={FeedBrowser} />
          <Route path={pages.DASHBOARD} component={ControlPanel} />
          <Route render={() => <Redirect to='/' />} />
        </Switch>
      </div>
    )
  }
}

export default App
