import React, { useState, useEffect } from 'react'
import { ToastContainer } from 'react-toastify'
import styled from 'styled-components'
import LeftMenu from './LeftMenu/index'
import ContentBody from './ContentBody/index'
import { useSelector, useDispatch } from 'react-redux'
import colors from 'js/constants/colors'
import {
  fetchUser
} from 'js/actions/user'
import { Loader } from 'semantic-ui-react'
import TopBar from './TopBar/index'

const MainContainer = styled.div`
  width: 100vw;
  height: 100vh;
  max-width: 100%;
  display: flex;
  flex-direction: row;
  padding-top: ${props => props.offsetTop ? '60px' : 0};
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

// const EmptyBackgroundTransparent = styled(EmptyBackground)`
//   display: ${props => props.visible ? 'flex' : 'none'};
//   position: absolute;
//   background: rgba(40, 43, 48, .85);
//   z-index: 99999;
//   padding: 20px;
//   > h1 {
//     color: ${colors.discord.red};
//   }
// `

function ControlPanel () {
  const authenticated = useSelector(state => state.authenticated)
  const [loaded, setLoaded] = useState(false)
  const [ready, setReady] = useState(false)
  const dispatch = useDispatch()
  const [ sizeInfo, setSizeInfo ] = useState({
    leftMenuExpanded: window.innerWidth >= 910,
    leftMenuNotFull: window.innerWidth >= 910
  })

  useEffect(() => {
    if (loaded === true && authenticated === true && !ready) {
      setReady(true)
    }
  }, [loaded, authenticated, ready])

  useEffect(() => {
    dispatch(fetchUser()).then(() => {
      setLoaded(true)
    })
  }, [])

  useEffect(() => {
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  })

  function updateDimensions () {
    const newState = {}
    if (window.innerWidth < 860) {
      // if (this.state.leftMenuExpanded) newState.leftMenuExpanded = false
      if (sizeInfo.leftMenuNotFull) newState.leftMenuNotFull = false
    } else {
      if (!sizeInfo.leftMenuExpanded) newState.leftMenuExpanded = true
      if (!sizeInfo.leftMenuNotFull) newState.leftMenuNotFull = true
    }
    if (Object.keys(newState).length > 0) {
      setSizeInfo({
        ...sizeInfo,
        ...newState
      })
    }
  }

  if (authenticated === false) {
    window.location.href = '/login'
  }

  if (!ready) {
    return (
      <EmptyBackground>
        <Loader inverted active size='massive'>Loading</Loader>
      </EmptyBackground>
    )
  }
  return (
    <div>
      {/* <EmptyBackgroundTransparent visible={this.state.socketStatus === socketStatus.DISCONNECTED}>
        <Icon name='broken chain' size='massive' color='red' />
        <h1>Disconnected from Server</h1>
        <h3>My lifeline to the server has been severed! Access will be restored once my connection has been re-established.</h3>
      </EmptyBackgroundTransparent> */}
      <ToastContainer position='top-center' />
      {sizeInfo.leftMenuNotFull
        ? null
        : <TopBar toggleLeftMenu={() => {
          setSizeInfo({
            ...sizeInfo,
            leftMenuExpanded: !sizeInfo.leftMenuExpanded
          })
        }} />
      }
      <MainContainer offsetTop={!sizeInfo.leftMenuNotFull}>
        <LeftMenu disableMenuButtonToggle={sizeInfo.leftMenuNotFull} toggleLeftMenu={() => {
          setSizeInfo({
            ...sizeInfo,
            leftMenuExpanded: !sizeInfo.leftMenuExpanded
          })
        }} expanded={sizeInfo.leftMenuExpanded} />
        <ContentBody />
      </MainContainer>
    </div>
  )
}

export default ControlPanel
