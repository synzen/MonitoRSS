import React, { useState, useRef, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import PageHeader from 'js/components/utils/PageHeader'
import SidebarContent from './SidebarContent'
import SectionTitle from 'js/components/utils/SectionTitle'
import AddFeed from './AddFeed'
import PaginatedTable from '../../../utils/PaginatedTable'
import PropTypes from 'prop-types'
import styled from 'styled-components'
import { Divider, Icon, Popup } from 'semantic-ui-react'
import { Scrollbars } from 'react-custom-scrollbars'
import Sidebar from 'react-sidebar'
import guildSelectors from 'js/selectors/guilds'
import { Redirect } from 'react-router-dom'
import pages from 'js/constants/pages'
import { changePage } from 'js/actions/page'

const mql = window.matchMedia(`(min-width: 1475px)`)

const MainContent = styled.div`
  padding: 20px;
  @media only screen and (min-width: 930px) {
    padding: 55px;
  }
  width: 100%;
  /* overflow: hidden; */
  scrollbar-width: thin;
  /* overflow-y: auto; */
  /* max-width: 840px; */
`

const FeedLimitContainer = styled.div`
  > a {
    margin-left: 10px;
    &:hover {
      text-decoration: none;
    }
  }
`

function Feeds (props) {
  const [keepSidebar, setKeepSidebar] = useState(mql.matches)
  const [selectedFeedID, setSelectedFeedID] = useState()
  const feeds = useSelector(state => state.feeds)
  const channels = useSelector(state => state.channels)
  const activeGuild = useSelector(guildSelectors.activeGuild)
  const selectedFeed = useSelector(state => state.feeds.find(f => f._id === selectedFeedID))
  const failRecords = useSelector(state => state.failRecords)
  const dispatch = useDispatch()
  const bodyRef = useRef()
  const { redirect } = props

  useEffect(() => {
    mql.addListener(mediaQueryChanged)
    return () => mql.removeListener(mediaQueryChanged)
  })

  useEffect(() => {
    dispatch(changePage(pages.FEEDS))
  }, [dispatch])

  if (!activeGuild) {
    dispatch(changePage(pages.DASHBOARD))
    return <Redirect to={pages.DASHBOARD} />
  }

  const mediaQueryChanged = () => {
    setKeepSidebar(mql.matches)
  }

  const tableItems = []
  for (const feed of feeds) {
    tableItems.push(feed)
  }

  const channelDropdownOptions = []
  for (const channel of channels) {
    channelDropdownOptions.push({ text: '#' + channel.name, value: channel.id })
  }

  const onClickFeedRow = feed => {
    if (selectedFeedID === feed._id) {
      return setSelectedFeedID('')
    } else {
      return setSelectedFeedID(feed._id)
    }
  }

  const onSetOpen = op => {
    setSelectedFeedID()
  }

  const sidebarWidth = bodyRef.current ? Math.min(0.75 * bodyRef.current.offsetWidth, 425) : 425

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <Sidebar
        styles={{
          sidebar: {
            backgroundColor: '#2f3136',
            width: keepSidebar ? '425px' : `${sidebarWidth}px`
          }
        }}
        sidebar={
          <SidebarContent
            selectedFeed={selectedFeed}
            channelDropdownOptions={channelDropdownOptions}
            onDeletedFeed={() => setSelectedFeedID('')}
            redirect={redirect}
            smallerScreen={!mql.matches} />
        }
        docked={keepSidebar}
        open={!!selectedFeedID}
        onSetOpen={onSetOpen}
        pullRight
      >

        <Scrollbars>
          <MainContent ref={bodyRef}>
            <PageHeader heading='Feed Management' subheading='Manage and edit your feeds.' />
            <Divider />
            <SectionTitle heading='Current' subheading='View and your current feeds.' sideComponent={
              <FeedLimitContainer>
                <Popup
                  content={<span>Need more? <a href='https://www.patreon.com/discordrss' target='_blank' rel='noopener noreferrer'>Become a supporter!</a></span>}
                  position='left center'
                  hideOnScroll
                  hoverable
                  inverted
                  trigger={<span>{tableItems.length}/{activeGuild.limit === 0 ? '∞' : activeGuild.limit}</span>} />
                <a href='https://www.patreon.com/discordrss' target='_blank' rel='noopener noreferrer'><Icon color='green' name='arrow circle up' /></a>
              </FeedLimitContainer>
            } />
            <PaginatedTable.Table
              basic
              unstackable
              items={tableItems}
              compact={tableItems.length > 5}
              maxPerPage={tableItems.length > 5 ? 10 : 5}
              headers={['Status', 'Title', 'Link', 'Channel']}
              itemFunc={feed => {
                const channel = channels.find(c => c.id === feed.channel)
                const record = failRecords.find(r => r.url === feed.url)
                const failed = record && record.alerted
                return (
                  <PaginatedTable.Row
                    active={feed._id === selectedFeedID}
                    style={{ cursor: 'pointer' }}
                    key={feed._id}
                    onClick={e => onClickFeedRow(feed)}>
                    {/* <PaginatedTable.Cell collapsing>
                    <CheckboxWrapper>
                      <Checkbox />
                    </CheckboxWrapper>
                  </PaginatedTable.Cell> */}
                    <PaginatedTable.Cell collapsing>
                      { feed.disabled
                        ? <Icon name='warning circle' style={{ fontSize: '18px' }} color='yellow' />
                        : failed
                          ? <Icon name='dont' style={{ fontSize: '18px' }} color='red' />
                          : <Icon name='check circle' style={{ fontSize: '18px' }} color='green' />
                      }
                    </PaginatedTable.Cell>
                    <PaginatedTable.Cell>{feed.title}</PaginatedTable.Cell>
                    <PaginatedTable.Cell>{feed.url}</PaginatedTable.Cell>
                    <PaginatedTable.Cell>{channel ? `#${channel.name}` : `Unknown (${feed.channel})`}</PaginatedTable.Cell>
                  </PaginatedTable.Row>
                )
              }}
              searchFunc={(feed, search) => {
                for (const key in feed) {
                  if (typeof feed[key] === 'string' && feed[key].includes(search)) {
                    return true
                  }
                }
                return false
              }} />
            <Divider />
            <SectionTitle
              heading='Add'
              subheading={
                <span>
                  {`Add a new feed. You may have a maximum of ${activeGuild.limit === 0 ? '∞' : activeGuild.limit} feeds. Need more? `}
                  <a href='https://www.patreon.com/discordrss' target='_blank' rel='noopener noreferrer'>
                    Become a supporter!
                  </a></span>} />
            <AddFeed channelDropdownOptions={channelDropdownOptions} />
            <Divider />
          </MainContent>
        </Scrollbars>
      </Sidebar>
    </div>
  )
}

Feeds.propTypes = {
  redirect: PropTypes.func
}

export default Feeds
