import React from 'react'
import ReactDOM from 'react-dom'
import { ChakraProvider } from '@chakra-ui/react'
import './index.css'
import App from './App'

ReactDOM.render(
  <ChakraProvider>
  <React.StrictMode>
      <App />
    </React.StrictMode>
  </ChakraProvider>,
  document.getElementById('root')
)
