import React from 'react'
import ReactDOM from 'react-dom'

import * as serviceWorker from './serviceWorker'
// import index from './js/index.js'
import { Provider } from 'react-redux'
import store from './js/store/index-store.js'
import { BrowserRouter, Route } from 'react-router-dom'

import './index.css'
import App from './App'
ReactDOM.render(
  <Provider store={store}>
    <BrowserRouter>
      <Route path='/' component={App} />
    </BrowserRouter>
  </Provider>, document.getElementById('root'))

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: http://bit.ly/CRA-PWA
serviceWorker.unregister()
