import React, { Component } from 'react'
import logo from './logo.svg'
import Header from './js/components/Header'
import Dashboard from './js/components/Dashboard'
import ReconnectingWebSocket from 'reconnecting-websocket'
import axios from 'axios'
import './js/index'
import './App.css'

class App extends Component {
  constructor () {
    super()

    this.state = {
      serverResponse: '',
      socketStatus: 'connecting...',
      socketError: undefined
    }

    const socket = new ReconnectingWebSocket('ws://localhost:8081/ping')
    this.socket = socket

    socket.onopen = event => {
      // console.log('socket open')
      // console.log(event)
      this.setState({ socketStatus: 'open', socketError: undefined })
    }

    socket.onerror = err => {
      // console.log('socket error')
      // console.log(err)
      this.setState({ socketStatus: 'error', socketError: err })
    }

    socket.onmessage = message => {
      // console.log('socket message')
      // console.log(message)
      this.setState({ serverResponse: message.data })
    }

    socket.onclose = event => {
      // console.log('socket closed')
      // console.log(event)
      this.setState({ socketStatus: 'closed', socketError: undefined })
    }
  }

  render () {
    return (
      <div className='App'>
        <header className='App-header'>
          <img src={logo} className='App-logo' alt='logo' />
          <p>
            Edit <code>src/App.js</code> and save to reload.
          </p>
          <a
            className='App-link'
            href='https://reactjs.org'
            target='_blank'
            rel='noopener noreferrer'
          >
            Learn React
          </a>
          (Scroll Down for Other Components)
        </header>
        <h1>Websockets ({this.state.socketStatus})</h1>

        <input placeholder='Send data to server' onChange={e => this.socket.send(e.target.value)} />
        <p>{this.state.socketError ? 'Socket Error for ' + this.state.socketError.target.url : this.state.serverResponse}</p>
        <Header />
        <Dashboard />
        {/* <button onClick={() => {
          console.log('clicked')
          // The API is fully functioning, and works through the package.json proxy once the server is up
          // axios.post('/api/guilds/240535022820392961/feeds')
        }}>fetch</button> */}
      </div>
    )
  }
}

export default App
