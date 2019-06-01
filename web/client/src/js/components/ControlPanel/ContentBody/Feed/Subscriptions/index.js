import React, { Component } from 'react'
import { withRouter, Redirect } from 'react-router-dom'
import { connect } from 'react-redux'
import { changePage } from 'js/actions/index-actions'
import pages from 'js/constants/pages'
import PropTypes from 'prop-types'
import styled from 'styled-components'
import PageHeader from 'js/components/utils/PageHeader'
import SectionTitle from 'js/components/utils/SectionTitle'
import FiltersTable from '../../..//utils/FiltersTable'
import AddFilter from '../../../utils/AddFilter'
import SectionSubtitle from 'js/components/utils/SectionSubtitle'
import testFilters from '../Filters/util/filters'
import { Divider, Input, Button, Popup, Dropdown } from 'semantic-ui-react'
import ArticleTable from '../../../utils/ArticleTable'
import { transparentize } from 'polished'
import colors from 'js/constants/colors'
import toast from '../../../utils/toast'
import posed, { PoseGroup } from 'react-pose';
import PopInButton from '../../../utils/PopInButton'
import axios from 'axios'
import Wrapper from 'js/components/utils/Wrapper'
const mapStateToProps = state => {
  return {
    guildId: state.guildId,
    feedId: state.feedId,
    roles: state.roles,
    subscribers: state.subscribers,
    csrfToken: state.csrfToken
  }
}

const mapDispatchToProps = dispatch => {
  return {
    setToThisPage: () => dispatch(changePage(pages.SUBSCRIPTIONS)),
    toDashboard: () => dispatch(changePage(pages.DASHBOARD))
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

const SubscriberSearchWrapper = styled.div`
  margin-bottom: 1em;
`

// const SubscriberListWrapper = styled.div`
//   background-color: rgba(32,34,37,0.6);
//   /* border-bottom-left-radius: 3px; */
//   border-radius: 3px;
//   /* border-bottom-right-radius: 3px; */
//   /* padding-left: 0.25em; */
//   margin-bottom: 1em;
//   padding-left: 1em;
//   padding-right: 1em;
//   min-height: 250px;
//   height: 250px;
//   resize: vertical;
//   overflow-y: auto;
//   scrollbar-width: thin;
//   .ui.input {
//     margin-bottom: 1em;
//   }
// `

const SubscriberListWrapper = styled(Wrapper)`
  /* background-color: rgba(32,34,37,0.6); */
  /* border-bottom-left-radius: 3px; */
  /* border-radius: 3px; */
  /* border-bottom-right-radius: 3px; */
  /* padding-left: 0.25em; */
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
// const SubscriberBox = styled.div`
//   background-color: rgba(32,34,37,0.6);
//   height: 55px;
//   display: flex;
//   justify-content: space-between;
//   align-items: center;
//   margin-bottom: 10px;
//   padding: 10px;
//   border-radius: 3px;
//   > div {
//     > div {
//       display: inline-block;
//     }
//   }
//   span {
//       overflow: hidden;
//       text-overflow: ellipsis;
//       white-space: nowrap;
//       max-width: calc(100% - 180px);
//       color: ${props => props.color || colors.discord.text};
//     }
//     .ui.button {
//       &:first-child {
//         margin-left: 5px;
//       }
//       &:last-child {
//         margin-left: 5px;
//       }
//     }
// `

const SubscriberBox = styled(Wrapper)`
  /* background-color: rgba(32,34,37,0.6); */
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


// const SubscriberInfoStyled = styled.div`
//   background-color: rgba(32,34,37,0.6);
//   box-shadow: 0 2px 0px 0 rgba(0,0,0,0.2) !important;
//   padding: 15px 20px;
//   border-radius: 3px;
// `

const SubscriberInfoStyled = styled(Wrapper)`
  /* background-color: rgba(32,34,37,0.6); */
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


class Subscriptions extends Component {
  constructor () {
    super()
    this.state = {
      search: '',
      selectedSubscriber: '',
      openFiltersModal: false,
      showSubscriberFilters: false,
      articleSubscribersMentioned: [],
      addSubscriberType: 'role',
      addSubscriberId: '',
      addingSubscriber: false,
      deletingSubscriber: false
    }
  }

  componentWillMount () {
    this.props.setToThisPage()
  }

  addSubscriber = () => {
    const type = this.state.addSubscriberType
    const id = this.state.addSubscriberId
    if (!type || !id) return
    const { guildId, feedId, csrfToken } = this.props
    this.setState({ addingSubscriber: true })
    const payload = { type, id }
    axios.put(`/api/guilds/${guildId}/feeds/${feedId}/subscribers`, payload, { headers: { 'CSRF-Token': csrfToken } }).then(() => {
      toast.success(`Added a new subscriber!`)
      this.setState({ addingSubscriber: false, addSubscriberId: '', selectedSubscriber: id })
    }).catch(err => {
      this.setState({ addingSubscriber: false })
      if (err.response && err.response.status === 304) return toast.success('No changes detected')
      if (err.response && err.response.status === 404 && this.state.addSubscriberType === 'user') return toast.error('That user was not found for this server.')
      console.log(err.response || err.message)
      const errMessage = err.response && err.response.data && err.response.data.message ? err.response.data.message : err.response && err.response.data ? err.response.data : err.message
      toast.error(<p>Failed to add subscriber<br/><br/>{errMessage ? typeof errMessage === 'object' ? JSON.stringify(errMessage, null, 2) : errMessage : 'No details available'}</p>)
    })
  }

  removeSubscriber = () => {
    const id = this.state.selectedSubscriber
    if (!id) return
    const { guildId, feedId, csrfToken } = this.props
    this.setState({ deletingSubscriber: true })
    axios.delete(`/api/guilds/${guildId}/feeds/${feedId}/subscribers/${id}`, { headers: { 'CSRF-Token': csrfToken } }).then(() => {
      toast.success('Removed subscriber')
      this.setState({ deletingSubscriber: false })
    }).catch(err => {
      this.setState({ deletingSubscriber: false })
      if (err.response && err.response.status === 304) return toast.success('No changes detected')
      console.log(err.response || err.message)
      const errMessage = err.response && err.response.data && err.response.data.message ? err.response.data.message : err.response && err.response.data ? err.response.data : err.message
      toast.error(<p>Failed to remove subscriber<br/><br/>{errMessage ? typeof errMessage === 'object' ? JSON.stringify(errMessage, null, 2) : errMessage : 'No details available'}</p>)
    })
  }

  render () {
    const { guildId, feedId, roles, subscribers } = this.props
    if (!feedId) {
      this.props.toDashboard()
      return <Redirect to='/' />
    }
    const rolesById = roles[guildId]
    const subscribersArr = []
    // const subscribers = (subscriptions[guildId] && subscriptions[guildId][feedId] ? subscriptions[guildId][feedId] : []).map(subscriber => {
    //   if (subscriber.type !== 'role') return { ...subscriber, hexColor: colors.discord.text }
    //   return { ...subscriber, ...rolesById[subscriber.id] }
    // })
    let selectedSubscriber = {}
    let selectedSubscriberFilterItems = []

    const existingSubscribers = {}
    if (subscribers[guildId] && subscribers[guildId][feedId]) {
      const feedSubscribers = subscribers[guildId][feedId]
      for (const subscriberId in feedSubscribers) {
        const subscriber = feedSubscribers[subscriberId]
        if (subscriber.type === 'role') subscribersArr.push({ ...subscriber, ...rolesById[subscriber.id] })
        else subscribersArr.push({ ...subscriber, hexColor: '' })
        existingSubscribers[subscriberId] = true
      }
      const currentSubscriber = feedSubscribers[this.state.selectedSubscriber]
      if (currentSubscriber) {
        selectedSubscriber = { ...currentSubscriber, hexColor: currentSubscriber.type === 'role' ? rolesById[this.state.selectedSubscriber].hexColor : colors.discord.text }
        const subscriberFilters = currentSubscriber.filters
        if (subscriberFilters) {
          for (const filterType in subscriberFilters) {
            for (const value of subscriberFilters[filterType]) selectedSubscriberFilterItems.push({ type: filterType, value })
          }
        }
      }
    }

    const addSubscriberList = guildId && roles[guildId] ? Object.keys(roles[guildId]).filter(id => !existingSubscribers[id] && rolesById[id].name !== '@everyone').map(id => rolesById[id]) : []
    const selectedSubscriberChosen = Object.keys(selectedSubscriber).length > 0
    const selectedArticleSubscribers = this.state.articleSubscribersMentioned.map(subscriber => <SubscriberTag onClick={e => this.setState({ selectedSubscriber: subscriber.id })} key={subscriber.id} color={subscriber.hexColor}>{subscriber.name}</SubscriberTag>)
    return (
      <Container>
        <PageHeader>
          <h2>Subscriptions</h2>
          <p>Set up subscriptions for your feed to notify roles or users when an article is delivered.</p>
        </PageHeader>
        <Divider />
        <SectionTitle heading='Current' subheading='See the current users and roles that have subscriptions.' />
        <SubscriberSearchWrapper>
          <Input fluid icon='search' iconPosition='left' placeholder='Search...' onChange={e => this.setState({ search: e.target.value })} />
        </SubscriberSearchWrapper>
        <SubscriberListWrapper>
          <SubscriberList>
            {
              subscribersArr.map(subscriber => {
                if (this.state.search && !subscriber.name.toLowerCase().includes(this.state.search)) return null
                return (
                  <SubscriberListItem key={subscriber.id} color={subscriber.hexColor} selected={subscriber.id === this.state.selectedSubscriber}>
                    <button onClick={e => this.setState({ selectedSubscriber: subscriber.id })}>
                      {subscriber.name}
                    </button>
                    <Popup
                      hideOnScroll
                      trigger={<div>
                        <SectionSubtitle>
                          {subscriber.filters && Object.keys(subscriber.filters).length > 0 ? 'Filtered' : 'Global'}
                        </SectionSubtitle>
                        <SectionSubtitle>
                          {subscriber.type}
                        </SectionSubtitle>
                      </div>}
                      inverted
                      position='top right'
                      content='A subscriber is filtered if they have filters applied to them'
                    />
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
            <PopInButton pose={selectedSubscriberChosen ? 'enter' : 'exit'} content={this.state.showSubscriberFilters ? 'Hide Filters' : 'Show Filters'} onClick={e => this.setState({ showSubscriberFilters: !this.state.showSubscriberFilters })} />
            <PopInButton pose={selectedSubscriberChosen ? 'enter' : 'exit'} icon='trash' color='red' onClick={this.removeSubscriber} disabled={this.state.deletingSubscriber} />
          </div>
        </SubscriberBox>
        <SubscriberInfo pose={this.state.showSubscriberFilters && selectedSubscriberChosen ? 'enter' : 'exit'} color={selectedSubscriber.hexColor}>
          <SubscriberFilterTable pose={selectedSubscriberFilterItems.length > 0 ? 'enter' : 'exit'}>
            <SectionSubtitle>Current Filters</SectionSubtitle>
            <FiltersTable removeApiUrl={`/api/guilds/${guildId}/feeds/${feedId}/subscribers/${selectedSubscriber.id}/filters`} filters={selectedSubscriber.filters} />
            <Divider />
          </SubscriberFilterTable>
          <SectionSubtitle>Add filter</SectionSubtitle>
          <AddFilter addApiUrl={`/api/guilds/${guildId}/feeds/${feedId}/subscribers/${selectedSubscriber.id}/filters`} />
        </SubscriberInfo>
        <Divider />
        <SectionTitle heading='Add' subheading='Add a new subscriber! You may add filters to a subscriber only after they are added here.' />
        <AddSubscribersInputs>
          <Dropdown selection options={[{ text: 'Role', value: 'role' }, { text: 'User', value: 'user' }]} value={this.state.addSubscriberType} onChange={(e, data) => this.state.addSubscriberType === data.value ? null : this.setState({ addSubscriberType: data.value, addSubscriberId: '' })} />
          {this.state.addSubscriberType === 'role'
          ? <Dropdown selection search placeholder='Select a Role' options={addSubscriberList.map(subscriber => { return { text: <span style={{ color: subscriber.hexColor }}>{subscriber.name}</span>, value: subscriber.id } })} onChange={(e, data) => this.setState({ addSubscriberId: data.value })} value={this.state.addSubscriberId} />
          : <Input value={this.state.addSubscriberId} disabled placeholder='Currently unsupported' onChange={e => isNaN(e.target.value) ? null : this.setState({ addSubscriberId: e.target.value })} onKeyPress={e => e.key === 'Enter' ? this.addSubscriber() : null} />
          }
        </AddSubscribersInputs>
        <AddSubscriberButtonContainer>
          <Button color='green' content='Add' disabled={!this.state.addSubscriberId || !this.state.addSubscriberType || this.state.addingSubscriber} onClick={this.addSubscriber} />
        </AddSubscriberButtonContainer>
        <Divider />
        <SectionTitle heading='Preview' subheading='See what users or roles will get mentioned for all current articles. Click an article to see exactly who will get mentioned.' />
        <ArticleTable
          onClickArticle={article => {
            const matched = []
            for (const subscriber of subscribersArr) {
              if (!subscriber.filters) matched.push(subscriber)
              else if (testFilters(subscriber.filters, article).passed) matched.push(subscriber)
            }
            this.setState({ articleSubscribersMentioned: matched })
          }}
          addColumns={[
            {
              collapsing: true,
              headers: ['Subscribers'],
              cellFuncs: [
                article => {
                  let subscribersPassed = 0
                  for (const subscriber of subscribersArr) {
                    if (!subscriber.filters) subscribersPassed++
                    else if (testFilters(subscriber.filters, article).passed) ++subscribersPassed
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
}

Subscriptions.propTypes = {
  setToThisPage: PropTypes.func
}

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(Subscriptions))
