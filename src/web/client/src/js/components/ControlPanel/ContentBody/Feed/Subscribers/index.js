import React, { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import styled from 'styled-components'
import PageHeader from 'js/components/utils/PageHeader'
import SectionTitle from 'js/components/utils/SectionTitle'
import FiltersTable from '../../..//utils/FiltersTable'
import AddFilter from '../../../utils/AddFilter'
import SectionSubtitle from 'js/components/utils/SectionSubtitle'
import testFilters from 'js/utils/testFilters'
import { Divider, Input, Button, Dropdown } from 'semantic-ui-react'
import ArticleTable from '../../../utils/ArticleTable'
import { transparentize } from 'polished'
import colors from 'js/constants/colors'
import posed, { PoseGroup } from 'react-pose'
import PopInButton from '../../../utils/PopInButton'
import Wrapper from 'js/components/utils/Wrapper'
import feedSelector from 'js/selectors/feeds'
import subscriberSelector from 'js/selectors/subscribers'
import { fetchAddSubscriber, fetchDeleteSubscriber, fetchEditSubscriber } from 'js/actions/subscribers'
import { changePage } from 'js/actions/page'
import pages from 'js/constants/pages'
import { Redirect } from 'react-router-dom'
import toast from 'js/components/ControlPanel/utils/toast'

const Container = styled.div`
  padding: 20px;
  @media only screen and (min-width: 930px) {
    padding: 55px;
  }
  width: 100%;
  max-width: 840px;
`

const SubscriberSearchWrapper = styled.div`
  margin-bottom: 1em;
`

const SubscriberListWrapper = styled(Wrapper)`
  padding-top: 0;
  margin-bottom: 1em;
  padding-left: 1em;
  padding-right: 1em;
  min-height: 250px;
  height: 250px;
  resize: vertical;
  overflow-y: auto;
  scrollbar-width: thin;
  .ui.input {
    margin-bottom: 1em;
  }
`

const SubscriberList = styled.ul`
  list-style-type: none;
  margin: 0;
  padding: 0;
  user-select: none;
  word-break: break-word;
  /* a {
    text-decoration: none;
    color: ${colors.discord.text};
    &:hover {
      text-decoration: none !important;
      color: ${colors.discord.text};
    }
  } */
`

const SubscriberListItem = styled.li`
    cursor: ${props => props.selected ? 'default' : 'pointer'};
    text-decoration: none;
    display: flex;
    margin-top: 0.25em;
    margin-bottom: 0.25em;
    outline: none;
    -webkit-tap-highlight-color: transparent;
    position: relative;
    /* &:after {
      position: absolute;
      content: '';
      border-bottom: 1px solid ${transparentize(0.9, colors.discord.text)};
      width: 100%;
      bottom: -.125em;
    } */
    > div {
      display: flex;
      flex-direction: column;
      justify-content: center;
      width: 60px;

      > label {
        justify-content: center;
        display: flex;
        /* border-right-style: solid;
        border-right-width: 1px; */
        align-items: center;

        margin-bottom: 0;
      }
    }
    > button {
      position: relative;
      text-align: left;
      cursor: ${props => props.selected ? 'default' : 'pointer'};
      border-style: none;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      margin-right: 5px;
      flex-grow: 1;
      padding: 10px 15px;
      max-width: calc(100% - 65px);
      display: block;
      color: ${props => props.selected ? 'white' : props.color || colors.discord.text};
      border-radius: 3px;
      background-color: ${props => props.selected ? props.color || colors.discord.blurple : 'transparent'};
      &:hover {
        background-color: ${props => props.selected ? (props.color || colors.discord.blurple) : props.color ? transparentize(0.8, props.color) : 'rgba(185,187,190,.1)'};
        text-decoration: none;
        color: ${props => props.selected ? 'white' : props.color || 'white'};
      }
      &:active {
        background-color: ${props => props.selected ? (props.color || colors.discord.blurple) : transparentize(0.8, props.color || colors.discord.text)};
      }
      &:focus {
        outline: none;
      }
    }
    &:first-child {
      margin-top: 0.5em;
    }
    &:last-child {
      margin-bottom: 0.5em;
    }
`

const SubscriberBox = styled(Wrapper)`
  height: 55px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  padding: 10px;
  border-radius: 3px;
  > div {
    > div {
      display: inline-block;
    }
  }
  span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: calc(100% - 180px);
      color: ${props => props.color || colors.discord.text};
    }
    .ui.button {
      &:first-child {
        margin-left: 5px;
      }
      &:last-child {
        margin-left: 5px;
      }
    }
`

const SubscriberInfoStyled = styled(Wrapper)`
  box-shadow: 0 2px 0px 0 rgba(0,0,0,0.2) !important;
  padding: 15px 20px;
  border-radius: 3px;
`

const SubscriberInfo = posed(SubscriberInfoStyled)({
  enter: { opacity: 1, maxHeight: '730px' },
  exit: { opacity: 0, maxHeight: 0 }
})

const SubscriberFilterTable = posed.div({
  enter: { scale: 1, opacity: 1, maxHeight: '688px' },
  exit: { scale: 0, opacity: 0, maxHeight: 0 }
})

const AddSubscribersInputs = styled.div`
  display: flex;
  flex-direction: column;
  .ui.dropdown:first-child {
    flex-grow: 1;
    margin-right: 0;
    margin-bottom: 1em;
  }
  > .ui.dropdown {
    flex-grow: 1;
  }
  > .ui.input {
    flex-grow: 1;
  }

  @media only screen and (min-width: 500px) {
    flex-direction: row;
    .ui.dropdown:first-child {
      flex-grow: 0;
      margin-right: 1em;
      margin-bottom: 0;
    }
  }
`

const AddSubscriberButtonContainer = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-top: 1.5em;
  > .ui.button {
    flex-grow: 1;
  }

  @media only screen and (min-width: 500px) {
    > .ui.button {
      flex-grow: 0;
    }
  }
`

const ArticleSubscribers = styled.div`
  margin-top: 1em;
  > a {
    margin-right: 5px;
    margin-bottom: 5px;
    &:last-child {
      margin-right: 0;
    }
  }
`

const SubscriberTagStyled = styled.a`
  padding: 5px 10px;
  display: inline-block;
  color: white;
  border-radius: 3px;
  background-color: ${props => props.color || colors.discord.blurple};
  cursor: pointer;
  &:hover {
    background-color: ${props => (props.color || colors.discord.blurple)};
    text-decoration: none;
    color: white;
    transform: scale(1.1);
  }
  &:active {
    background-color: ${props => (props.color || colors.discord.blurple)};
  }
`

const SubscriberTag = posed(SubscriberTagStyled)({
  enter: { scale: 1, opacity: 1 },
  exit: { scale: 0, opacity: 0 }
})

function Subscribers () {
  const roles = useSelector(state => state.roles)
  const subscribers = useSelector(state => state.subscribers)
  const feed = useSelector(feedSelector.activeFeed)
  const editing = useSelector(subscriberSelector.editing)
  const adding = useSelector(subscriberSelector.adding)
  const deleting = useSelector(subscriberSelector.deleting)
  const [search, setSearch] = useState('')
  const [selectedSubscriberID, setSelectedSubscriberID] = useState()
  const [subscribersMentioned, setSubscribersMentioned] = useState([])
  const [showSubscriberFilters, setShowSubscriberFilters] = useState(false)
  const [addType, setAddType] = useState('role')
  const [addInput, setAddInput] = useState('')
  const dispatch = useDispatch()

  useEffect(() => {
    dispatch(changePage(pages.SUBSCRIBERS))
  }, [dispatch])

  if (!feed) {
    dispatch(changePage(pages.DASHBOARD))
    return <Redirect to={pages.DASHBOARD} />
  }

  const feedSubscribers = subscribers.filter(s => s.feed === feed._id)
  const subscribersArr = []
  let selectedSubscriber = {}
  let selectedSubscriberFilterItems = []

  const existingSubscribers = new Set()
  if (feedSubscribers.length > 0) {
    for (const subscriber of feedSubscribers) {
      if (subscriber.type === 'role') {
        const role = roles.find(r => r.id === subscriber.id) || {}
        subscribersArr.push({ ...subscriber, ...role })
      } else {
        subscribersArr.push({ ...subscriber, hexColor: '' })
      }
      existingSubscribers.add(subscriber.id)
    }
    const currentSubscriber = feedSubscribers.find(s => s.id === selectedSubscriberID)
    if (currentSubscriber) {
      const role = roles.find(r => r.id === selectedSubscriberID) || {}
      selectedSubscriber = {
        ...currentSubscriber,
        hexColor: currentSubscriber.type === 'role' ? role.hexColor : colors.discord.text
      }
      const subscriberFilters = currentSubscriber.filters
      if (subscriberFilters) {
        for (const filterType in subscriberFilters) {
          for (const value of subscriberFilters[filterType]) {
            selectedSubscriberFilterItems.push({ type: filterType, value })
          }
        }
      }
    }
  }

  const addSubscriberList = roles.filter(r => r.guildID === feed.guild && r.name !== '@everyone' && !existingSubscribers.has(r.id))
  const selectedSubscriberChosen = Object.keys(selectedSubscriber).length > 0
  const selectedArticleSubscribers = subscribersMentioned.map(subscriber => (
    <SubscriberTag
      onClick={e => setSelectedSubscriberID(subscriber.id)}
      key={subscriber.id}
      color={subscriber.hexColor}>
      {subscriber.name}
    </SubscriberTag>))

  const addSubscriber = async () => {
    if (!addType || !addInput) {
      return
    }
    await dispatch(fetchAddSubscriber(feed.guild, feed._id, {
      feed: feed._id,
      type: addType,
      id: addInput
    }))
  }

  const deleteSubscriber = async () => {
    if (!selectedSubscriberID) {
      return
    }
    await dispatch(fetchDeleteSubscriber(feed.guild, feed._id, selectedSubscriberID))
  }

  const addFiltersToSubscriber = async (type, value) => {
    const filterValues = selectedSubscriber.filters[type] ? [...selectedSubscriber.filters[type]] : []
    if (filterValues.includes(value)) {
      return toast.error(`The ${type} filter "${value}" already exists!`)
    }
    filterValues.push(value)
    const data = {
      filters: {
        [type]: filterValues
      }
    }
    await dispatch(fetchEditSubscriber(feed.guild, feed._id, selectedSubscriber.id, data))
  }

  const deleteFiltersFromSubscriber = async (type, value) => {
    let filterValues = selectedSubscriber.filters[type]
    filterValues.splice(filterValues.indexOf(value), 1)
    if (filterValues.length === 0) {
      filterValues = ''
    }
    const data = {
      filters: {
        [type]: filterValues
      }
    }
    await dispatch(fetchEditSubscriber(feed.guild, feed._id, selectedSubscriber.id, data))
  }

  return (
    <Container>
      <PageHeader>
        <h2>Subscribers</h2>
        <p>Set up user or role subscribers for your feed to notify them when an article is delivered.</p>
      </PageHeader>
      <Divider />
      <SectionTitle heading='Current' subheading='See the current users and roles that have subscriptions.' />
      <SubscriberSearchWrapper>
        <Input fluid icon='search' iconPosition='left' placeholder='Search...' onChange={e => setSearch(e.target.value)} />
      </SubscriberSearchWrapper>
      <SubscriberListWrapper>
        <SubscriberList>
          {
            subscribersArr.map(subscriber => {
              if (search && !subscriber.name.toLowerCase().includes(search)) return null
              return (
                <SubscriberListItem key={subscriber.id} color={subscriber.hexColor} selected={subscriber.id === selectedSubscriberID}>
                  <button onClick={e => setSelectedSubscriberID(subscriber.id)}>
                    {subscriber.name}
                  </button>
                  <div>
                    <SectionSubtitle>
                      {subscriber.filters && Object.keys(subscriber.filters).length > 0 ? 'Filtered' : ''}
                    </SectionSubtitle>
                    <SectionSubtitle>
                      {subscriber.type}
                    </SectionSubtitle>
                  </div>
                </SubscriberListItem>
              )
            })
          }
        </SubscriberList>
      </SubscriberListWrapper>
      <SectionSubtitle>Subscriber Details</SectionSubtitle>
      <SubscriberBox color={selectedSubscriber.hexColor}>
        {selectedSubscriberChosen ? <span>{selectedSubscriber.name}</span> : 'None selected'}
        <div>
          <PopInButton
            pose={selectedSubscriberChosen ? 'enter' : 'exit'}
            content={showSubscriberFilters ? 'Hide Filters' : 'Show Filters'}
            onClick={e => setShowSubscriberFilters(!showSubscriberFilters)} />
          <PopInButton
            pose={selectedSubscriberChosen ? 'enter' : 'exit'}
            icon='trash'
            color='red'
            onClick={deleteSubscriber}
            disabled={deleting} />
        </div>
      </SubscriberBox>
      <SubscriberInfo pose={showSubscriberFilters && selectedSubscriberChosen ? 'enter' : 'exit'} color={selectedSubscriber.hexColor}>
        <SubscriberFilterTable pose={selectedSubscriberFilterItems.length > 0 ? 'enter' : 'exit'}>
          <SectionSubtitle>Current Filters</SectionSubtitle>
          <FiltersTable removeFilter={deleteFiltersFromSubscriber} inProgress={editing} filters={selectedSubscriber.filters} />
          <Divider />
        </SubscriberFilterTable>
        <SectionSubtitle>Add filter</SectionSubtitle>
        <AddFilter addFilter={addFiltersToSubscriber} inProgress={editing} />
      </SubscriberInfo>
      <Divider />
      <SectionTitle heading='Add' subheading='Add a new subscriber! You may add filters to a subscriber only after they are added here.' />
      <AddSubscribersInputs>
        <Dropdown
          selection
          options={[{ text: 'Role', value: 'role' }, { text: 'User', value: 'user' }]}
          value={addType}
          onChange={(e, data) => {
            if (addType !== data.value) {
              setAddType(data.value)
              setAddInput('')
            }
          }}
        />
        {addType === 'role'
          ? <Dropdown
            selection
            search={(options, query) => options.filter((option) => option.subname.includes(query.toLowerCase()))}
            placeholder='Select a Role'
            options={addSubscriberList.map(subscriber => ({
              subname: subscriber.name,
              text: <span style={{ color: subscriber.hexColor }}>{subscriber.name}</span>,
              value: subscriber.id }))
            }
            onChange={(e, data) => setAddInput(data.value)} value={addInput}
            onKeyPress={e => e.key === 'Enter' ? addSubscriber() : null}
          />
          : <Input
            value={addInput}
            disabled
            placeholder='Currently unsupported on this interface'
            onChange={e => isNaN(e.target.value) ? null : setAddInput(e.target.value)}
            onKeyPress={e => e.key === 'Enter' ? addSubscriber() : null} />
        }
      </AddSubscribersInputs>
      <AddSubscriberButtonContainer>
        <Button
          color='green'
          content='Add'
          disabled={!addInput || !addType || adding}
          onClick={addSubscriber} />
      </AddSubscriberButtonContainer>
      <Divider />
      <SectionTitle
        heading='Preview'
        subheading='See what users or roles will get mentioned for all current articles. Click an article to see exactly who will get mentioned.' />
      <ArticleTable
        onClickArticle={article => {
          const matched = []
          for (const subscriber of subscribersArr) {
            if (!subscriber.filters) {
              matched.push(subscriber)
            } else if (testFilters(subscriber.filters, article).passed) {
              matched.push(subscriber)
            }
          }
          setSubscribersMentioned(matched)
        }}
        addColumns={[
          {
            collapsing: true,
            headers: ['Subscribers'],
            cellFuncs: [
              article => {
                let subscribersPassed = 0
                for (const subscriber of subscribersArr) {
                  if (!subscriber.filters) {
                    subscribersPassed++
                  } else if (testFilters(subscriber.filters, article).passed) {
                    ++subscribersPassed
                  }
                }
                return subscribersPassed
              }
            ]
          }
        ]}
      />
      {selectedArticleSubscribers.length > 0
        ? <ArticleSubscribers>
          <SectionSubtitle>Subscribers Mentioned</SectionSubtitle>
          <PoseGroup animateOnMount>
            {selectedArticleSubscribers}
          </PoseGroup>
        </ArticleSubscribers>
        : null
      }
      <Divider />
    </Container>
  )
}

export default Subscribers
