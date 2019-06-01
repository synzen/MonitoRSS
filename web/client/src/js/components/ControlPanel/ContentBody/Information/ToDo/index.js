import React, { Component } from 'react'
import { withRouter } from 'react-router-dom'
import { connect } from 'react-redux'
import { changePage } from 'js/actions/index-actions'
import PageHeader from 'js/components/utils/PageHeader'
import SectionSubtitle from 'js/components/utils/SectionSubtitle'
import pages from 'js/constants/pages'
import { Icon, Divider } from 'semantic-ui-react'
import PropTypes from 'prop-types'
import styled from 'styled-components'

const mapDispatchToProps = dispatch => {
  return {
    setToThisPage: () => dispatch(changePage(pages.TODO))
  }
}

const Container = styled.div`
  padding: 20px;
  @media only screen and (min-width: 930px) {
    padding: 55px;
  }
  width: 100%;
  max-width: 840px;
`

const Item = styled.div`
  /* display: flex;
  align-items: center; */
  padding: 5px 0;
`

const mapFunc = item => (
  <Item key={item.t}>
    <Icon name='circle outline' />
    <label>{item.t}</label>
  </Item>
)

class ToDo extends Component {
  constructor () {
    super()
    this.state = {

    }
  }

  componentWillMount () {
    this.props.setToThisPage()
  }

  render () {
    const core = [
      {
        t: 'Add FAQ page',
        d: 0
      }, {
        t: 'Add debugger page',
        d: 0
      }, {
        t: 'Add rsssplit support',
        d: 0
      }, {
        t: 'Add rssclone support',
        d: 0
      }, {
        t: 'Add link to Discord support server somewhere',
        d: 0
      }, {
        t: 'Add the list of users for rssalerts in Settings',
        d: 0
      }]

    const aesthetics = [
      {
        t: 'Animate left menu expansion on smaller screens',
        d: 0
      }, {
        t: 'Fix page not scrolling all the way when moving between feed customization pages',
        d: 0
      }, {
        t: 'Make the green plus button next to feed count mnore appealing than href anchor'
      }
    ]

    const experience = [
      {
        t: 'Support multiple feed addition support on Feeds page',
        d: 0
      }, {
        t: 'Support keyboard arrow keys to control selection on tables',
        d: 0
      }, {
        t: 'Add button to auto scroll down to preview, and to scroll back to original position',
        d: 0
      }, {
        t: 'Include before and after images for Misc Options',
        d: 0
      }, {
        t: 'Add a way to easily remove multiple feeds',
        d: 0
      }, {
        t: 'Add more details as to why a feed could not be added, besides the generic-ish messages',
        d: 0
      }
    ]

    const other = [
      {
        t: 'World domination',
        d: 0
      }
    ]
    return (
      <Container>
        <PageHeader heading='To Do List' subheading='Planned?' />
        <Divider />
        <SectionSubtitle>Core</SectionSubtitle>
        {core.map(mapFunc)}
        <Divider />
        <SectionSubtitle>Experience</SectionSubtitle>
        {experience.map(mapFunc)}
        <Divider />
        <SectionSubtitle>Aesthetics</SectionSubtitle>
        {aesthetics.map(mapFunc)}
        <Divider />
        <SectionSubtitle>Other</SectionSubtitle>
        {other.map(mapFunc)}
      </Container>
    )
  }
}

ToDo.propTypes = {
  setToThisPage: PropTypes.func
}

export default withRouter(connect(null, mapDispatchToProps)(ToDo))
