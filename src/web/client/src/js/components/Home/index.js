import React from 'react'
import { withRouter } from 'react-router-dom'
import styled from 'styled-components'
import { Button, Icon } from 'semantic-ui-react'
import Section from './Section'
import colors from '../../constants/colors'
import modal from '../utils/modal'
import pages from '../../constants/pages'
import PropTypes from 'prop-types'

const Header = styled.div`
  position: relative;
  background-color: #26262b;
  width: 100%;
  height: 750px;
  /* justify-content: center; */
  display: flex;
  align-items: center;
  justify-content: center;
  /* flex-direction: column; */
  /* padding-top: 100px; */
  text-align: center;
  /* max-width: 1600px; */
  p {
    margin-bottom: 30px;
    font-size: 16px;
  }
  h1 {
    font-weight: bold;
  }
  > div {

    max-width: 1400px;
    
    padding: 0 30px;
    overflow: hidden;
    @media only screen and (min-width: 1270px) {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
    }
  }
  @media only screen and (min-width: 1270px) {
      height: 500px;
  }
`

const HeaderButtons = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 40px;
  > .ui.button {
    width: 200px;
    &:first-child {
      margin-right: 2em;
    }
  }
`

const ImageContainer = styled.div`
  margin-top: 50px;
  @media only screen and (min-width: 1270px) {
    margin-top: 0;
  }
  > img {
    max-width: 450px;
    width: 100%;
    height: 100%;
    box-shadow: 0 8px 6px rgba(0,0,0,0.16), 0 3px 6px rgba(0,0,0,0.23);
  }
`

const Cards = styled.div`
  display: flex;
  justify-content: center;
  /* justify-content: space-between; */
  flex-wrap: wrap;
`

const Card = styled.div`
  box-shadow: 0 9px 20px 0 rgba(0,0,0,0.23);
  background-color: #26262b;
  max-width: 345px;
  width: 100%;
  padding: 30px 20px;
  min-height: 350px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  /* margin-right: 30px;
  margin-top: 30px; */
  margin: 30px;
  margin-bottom: 0;
  /* &:last-child {
    margin-right: 0;
  } */
  h3 {
    margin-top: 30px !important;
    font-weight: bolder;
    line-height: 30px;
    margin-bottom: 12px;
  }
  p {
    font-size: 20px;
    margin-bottom: 50px !important;
  }
  i {
    font-size: 3.5em !important;
    margin-top: 50px !important;
  }
`

const FeatureBoxes = styled.div`
  display: flex;
  justify-content: center;
  max-width: 1200px;
  flex-wrap: wrap;
  margin: 0 auto;
`

const Feature = styled.div`
  max-width: 350px;
  width: 100%;
  max-height: 225px;
  height: 100%;
  display: flex;
  align-items: left;
  flex-direction: column;
  text-align: left;
  padding: 30px;

  > div {
    margin-top: 20px;
    > span {
      font-size: 24px;
      color: white;
    }
    > p {
      font-size: 16px;
      margin-top: 10px;
    }
  }
  i {
    font-size: 40px !important;
  }
  img {
    width: 40px;
    height: 100%;
  }
`

const ModalBody = styled.div`
  text-align: center;
`

const ModalFooter = styled.div`
  display: flex;
  justify-content: space-around;
  a {
    width: 100%;
    &:hover {
      text-decoration: none;
    }
    &:first-child {
    margin-right: 10px;
  }
  }
  
`

const modalProps = {
  footer: <ModalFooter>
    <a target='_blank' rel='noopener noreferrer' href='https://discordapp.com/oauth2/authorize?client_id=268478587651358721&scope=bot&permissions=19456' onClick={e => modal.hide()}><Button fluid>With Role</Button></a>
    <a target='_blank' rel='noopener noreferrer' href='https://discordapp.com/oauth2/authorize?client_id=268478587651358721&scope=bot' onClick={e => modal.hide()}><Button fluid>Without Role</Button></a>
  </ModalFooter>
}

const modalChildren = <ModalBody>You can choose whether you want a role attached to the me by default.</ModalBody>

function Home (props) {
  return (
    <div>
      <Header>
        <div>
          <div>
            <h1>Get news delivered, automagically.</h1>
            <p>Receive news from sources like Twitter, YouTube, Reddit, Steam, or any site that supports RSS.<br />
              With a copious level of customization, you can design it to look just how you want it.
            </p>
            <HeaderButtons>
              <Button basic onClick={e => props.history.push(pages.DASHBOARD)}>Control Panel</Button>
              <Button size='large' onClick={e => modal.show(modalProps, modalChildren)}>Invite Me!</Button>
            </HeaderButtons>
          </div>
          <ImageContainer>
            <img src='https://i.imgur.com/okaIBQv.png' alt='Sample Screenshot' />
          </ImageContainer>
        </div>
      </Header>
      {/* <SampleContainer>
        <h2>Samples</h2>
      </SampleContainer> */}
      <Section>
        <h2>Get Started!</h2>
        <p>Getting automatic delivery of your desired news can be done in 3 simple steps.<br />For the full list of commands, use the rss.help command.</p>
        {/* <p style={{ fontSize: 16 }}>In just 3 easy steps.</p> */}
        <Cards>
          <Card>
            <Icon name='add' />
            <div>
              <h3>1. Invite Me</h3>
              <p>You'll have to invite me first to be able to use my features!</p>
            </div>
          </Card>
          <Card>
            <Icon name='search' />
            <div>
              <h3>2. Find a valid feed</h3>
              <p>An example of a valid feed would be <a href='https://www.reddit.com/r/all.rss' target='_blank' rel='noopener noreferrer'>https://www.reddit.com/r/all.rss</a></p>
            </div>
          </Card>
          <Card>
            <Icon name='check' />
            <div>
              <h3>3. Add it!</h3>
              <p>Use the ~rssadd command in your desired channel to add the feed!</p>
            </div>
          </Card>
        </Cards>
      </Section>
      <Section>
        <h2>Features</h2>
        <p>With a slew of customization features, you get to design exactly how you want your feed to look like.</p>
        <FeatureBoxes>
          <Feature>
            <Icon name='filter' style={{ color: colors.discord.yellow }} />
            <div>
              <span>Filter Articles</span>
              <p>Use filters to filter out articles you don't want in your feed.</p>
            </div>
          </Feature>
          <Feature>
            <Icon name='at' style={{ color: colors.discord.blurple }} />
            <div>
              <span>Subscriptions</span>
              <p>Mention users when an article of their liking comes in with the use of filters.</p>
            </div>
          </Feature>
          <Feature>
            <Icon name='copy' alt='placeholders' style={{ color: '#99AAB5' }} />
            <div>
              <span>Property Placeholders</span>
              <p>Extract whatever information you want from the article's properties and use them.</p>
            </div>
          </Feature>

          <Feature>
            <Icon name='shield' style={{ color: colors.discord.green }} />
            <div>
              <span>RSS Reliability</span>
              <p>With the core logic behind D.RSS, you'll almost never miss an article.</p>
            </div>
          </Feature>
          <Feature>
            <Icon name='window maximize outline' style={{ color: '#A6BDF0' }} />
            <div>
              <span>Web Interface</span>
              <p>Easily manage and customize all your feeds through the control panel.</p>
            </div>
          </Feature>
          <Feature>
            <Icon name='github' />
            <div>
              <span>Open Source</span>
              <p>The source code is openly available for anyone to use and host. Spread the love!</p>
            </div>
          </Feature>
        </FeatureBoxes>
      </Section>
    </div>
  )
}

Home.propTypes = {
  history: PropTypes.object
}

export default withRouter(Home)
