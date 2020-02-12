import React, { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import pages from 'js/constants/pages'
import PropTypes from 'prop-types'
import styled from 'styled-components'
import AlertBox from 'js/components/utils/AlertBox'
import colors from 'js/constants/colors'
import SectionTitle from 'js/components/utils/SectionTitle'
import PageHeader from 'js/components/utils/PageHeader'
import { Divider, Button, Loader, Icon, Popup } from 'semantic-ui-react'
import SectionSubtitle from 'js/components/utils/SectionSubtitle'
import axios from 'axios'
import moment from 'moment-timezone'
import filters from 'js/utils/testFilters'
import { hiddenProperties } from 'js/constants/hiddenArticleProperties'
import DetailButton from './DetailButton'
import modal from 'js/components/utils/modal'
import hljs from 'highlight.js'
import feedSelector from 'js/selectors/feeds'
import { changePage } from 'js/actions/page'
import { Redirect } from 'react-router-dom'

const Container = styled.div`
  padding: 20px;
  position: relative;
  @media only screen and (min-width: 930px) {
    padding: 55px;
  }
  width: 100%;
  max-width: 840px;
`

const ErrorWrapper = styled.div`
  > h1 {
    color: ${colors.discord.red};
  }

`

const InfoRowBox = styled.div`
  display: flex;
  justify-content: space-between;

  > div {
    &:first-child {
      margin-right: 10px;
    }
    &:last-child {
      margin-left: 10px;
    }
    max-width: 50%;
    width: 100%;
    > span {
      word-break: break-all;
      /* margin-right: 20px; */
    }
    > div {
      margin-bottom: 8px;
      label {
        display: inline;
        padding-right: 5px;
      }
    }
  }
`

const LoaderWrapper = styled.div`
  position: relative;
  height: 100px;
`

const MoreSupportButtons = styled.div`
  .ui.button {
    margin-bottom: 8px;
  }
`

function articleToString (article) {
  const clone = { ...article }
  for (const prop of hiddenProperties) {
    delete clone[prop]
  }
  return JSON.stringify(clone, null, 2)
}

function getDiff (dateStr) {
  const now = moment()
  const original = moment(dateStr)
  const secondsDiff = now.diff(original, 'seconds')
  if (secondsDiff < 60) return `${secondsDiff}s`
  const minutesDiff = now.diff(original, 'minutes')
  if (minutesDiff < 60) return `${minutesDiff}m ${secondsDiff - (60 * minutesDiff)}s`
  const hoursDiff = now.diff(original, 'hours')
  if (hoursDiff < 24) return `${hoursDiff}h ${minutesDiff - (60 * hoursDiff)}m`
  const daysDiff = now.diff(original, 'days')
  const monthsDiff = now.diff(original, 'months')
  if (monthsDiff >= 1) return `${monthsDiff}mo`
  return `${daysDiff}d ${hoursDiff - (24 * daysDiff)}h`
}

const jsonViewModalProps = {
  transparentBody: true,
  transparentFooter: true,
  fullWidth: true,
  footer: <Button fluid content='Close' onClick={e => modal.hide()} />
}

const autoFetch = 0

function Debugger (props) {
  const schedules = useSelector(state => state.schedules)
  const feed = useSelector(feedSelector.activeFeed)
  const channels = useSelector(state => state.channels)
  const channel = channels.find(c => c.id === feed.channel)
  const articleList = useSelector(state => state.articles)
  const articlesError = useSelector(feedSelector.articlesFetchErrored)
  const articlesFetching = useSelector(feedSelector.articlesFetching)
  const botConfig = useSelector(state => state.botConfig)
  const dispatch = useDispatch()
  const [ loadingState, setLoadingState ] = useState(autoFetch) // 0 = await user start, 1 = waiting for request and article fetch, 2 = fetched feed data OR articles, 3 = fetched all data
  const [ loadError, setLoadError ] = useState()
  const [ feedData, setFeedData ] = useState()
  const articleListById = {}
  for (const article of articleList) {
    articleListById[article._id] = article
  }
  const refreshRate = feed && schedules[feed._id] ? schedules[feed._id].refreshRateMinutes : null
  const waitDuration = !feed
    ? 'unknown'
    : !refreshRate
      ? botConfig.refreshRateMinutes < 1
        ? `${botConfig.refreshRateMinutes * 60} second(s)`
        : `${botConfig.refreshRateMinutes} minute(s)`
      : refreshRate < 1 ? `${refreshRate * 60} second(s)` : `${refreshRate} minute(s)`

  useEffect(() => {
    dispatch(changePage(pages.DEBUGGER))
  }, [dispatch])

  useEffect(() => {
    if (!feed) {
      return
    }
    if (!articlesFetching && (loadingState === 2 || loadingState === 3)) {
      setLoadingState(loadingState + 1)
    }
  }, [ feed, articlesFetching, loadingState ])

  useEffect(() => {
    if (loadingState !== 1 || !feed) return
    setFeedData()
    setLoadError()
    axios.get(`/api/guilds/${feed.guild}/feeds/${feed._id}/database`)
      .then(res => {
        setFeedData(res.data)
        setLoadingState(loadingState + 1)
      }).catch(err => {
        console.log(err.response || err)
        const errMessage = err.response && err.response.data && err.response.data.message ? err.response.data.message : err.response && err.response.data ? err.response.data : err.message
        console.log(errMessage)
        setLoadError(errMessage)
      })
  }, [ loadingState, feed ])

  // When the feed changes and articles are being fetched, set loading state to 1 to fetch feed data again
  useEffect(() => {
    if (feed && articlesFetching && loadingState >= 3) {
      setLoadingState(1)
    }
  }, [ feed, articlesFetching, loadingState ])

  if (!feed) {
    dispatch(changePage(pages.DASHBOARD))
    return <Redirect to={pages.DASHBOARD} />
  }

  const customComparisonsEnabled = feed && Array.isArray(feed.customComparisons) && feed.customComparisons.length > 0

  // These arrays all old feed IDs
  const oldArticles = []
  const newArticles = []
  const newArticlesToBeSent = []
  const blockedByTitleChecks = []
  const blockedByDateChecks = []
  const blockedByFilters = []
  const passedCustomComparisons = []

  const maxAge = botConfig.cycleMaxAge
  const cutoffDay = moment().subtract(maxAge, 'days')

  const globalDateCheck = botConfig.checkDates
  const localDateCheck = feed ? feed.checkDates : globalDateCheck
  const checkDate = typeof localDateCheck !== 'boolean' ? globalDateCheck : localDateCheck

  const globalTitleCheck = botConfig.checkTitles
  const localTitleCheck = feed ? feed.checkTitles : globalTitleCheck
  const checkTitle = typeof globalTitleCheck !== 'boolean' ? globalTitleCheck : localTitleCheck

  let allArticlesHaveDates = true

  if (feedData && articleList.length > 0 && botConfig) {
    // const customComparisons = feed.customComparisons // array of names
    const dbIds = new Set()
    const dbTitles = new Set()
    const dbCustomComparisons = {}
    // First store the database entries as reference
    for (const item of feedData) {
      dbIds.add(item.id)
      dbTitles.add(item.title)
      const docCustomComparisons = item.customComparisons
      if (docCustomComparisons !== undefined && Object.keys(docCustomComparisons).length > 0) {
        for (var n in docCustomComparisons) { // n = customComparison's name (such as description, author, etc.)
          if (!dbCustomComparisons[n]) dbCustomComparisons[n] = [docCustomComparisons[n]]
          else dbCustomComparisons[n].push(docCustomComparisons[n])
        }
      }
    }

    // Then make the important decisions
    const seenTitles = new Set()

    for (let a = articleList.length - 1; a >= 0; --a) {
      const article = articleList[a]
      const notInitialized = dbIds.size === 0 && articleList.length !== 1
      const idMatched = dbIds.has(article._id)
      const titleMatched = checkTitle && (dbTitles.has(article._fullTitle) || seenTitles.has(article._fullTitle))
      const dateMatched = checkDate && (!article.date || (article.date && moment(article._fullDate) < cutoffDay)) // If date exists, then _fullDate must exists. `.date` is formatted so it won't work for moment - use _fullDate string instead
      if (!article.date) allArticlesHaveDates = false // For a date check misc option alert
      if (!notInitialized && !idMatched) {
        newArticles.push(article._id)
        if (titleMatched) blockedByTitleChecks.push(article._id)
        else if (dateMatched) blockedByDateChecks.push(article._id)
        else {
          if (checkTitle && article._fullTitle) seenTitles.add(article._fullTitle) // To make sure articles within the same cycle with the same titles aren't sent
          const passedFilters = !feed.filters ? true : filters(feed.filters, article).passed
          if (!passedFilters) blockedByFilters.push(article._id)
          else newArticlesToBeSent.push(article._id)
        }
      } else {
        oldArticles.push(article._id)
      }
    }

    // Now deal with custom comparisons
    // if (customComparisonsEnabled) {
    //   const blockedArticles = [ ...oldArticles, ...blockedByDateChecks, ...blockedByFilters, ...blockedByTitleChecks ]
    //   for (const articleID of blockedArticles) {
    //     const article = articleListById[articleID]
    //     for (var z = 0; z < customComparisons.length; ++z) {
    //       const comparisonName = customComparisons[z]
    //       const dbCustomComparisonValues = dbCustomComparisons[comparisonName] // Might be an array of descriptions, authors, etc.
    //       const articleCustomComparisonValue = article[comparisonName]
    //       if (!dbCustomComparisonValues || dbCustomComparisonValues.includes(articleCustomComparisonValue) || !articleCustomComparisonValue) {
    //         continue // The comparison must either be uninitialized or invalid (no such comparison exists in any articles from the request), handled by a previous function. OR it exists in the db
    //       }
    //       passedCustomComparisons.push(articleID)
    //       break
    //     }
    //   }
    // }
  }

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone

  const articleListView = (articleArray, symbolType) => articleArray.map(articleID => {
    const article = articleListById[articleID]
    console.log(article)
    return (
      <li key={article._id}>
        <div>
          { symbolType === 1
            ? <Icon name='ellipsis horizontal' style={{ color: colors.discord.yellow, fontSize: '16px' }} />
            : symbolType === 2
              ? <Icon name='x' style={{ color: colors.discord.red, fontSize: '16px' }} />
              : <Icon name='check' style={{ color: colors.discord.green, fontSize: '16px' }} />
          }
          <SectionSubtitle>ID -</SectionSubtitle>{article._id + '149r5237ut859ujti835498yth35yt3598h'}
          <span style={{ color: colors.discord.subtext }}>{article.date ? ` (${getDiff(article.date)} ago)` : ''}</span>
        </div>
        <Button icon='code' basic size='tiny' onClick={e => modal.show(jsonViewModalProps, <pre style={{ width: '100%', maxWidth: '100%' }}><code dangerouslySetInnerHTML={{ __html: hljs.highlight('json', articleToString(article)).value }} /></pre>)} />

      </li>
    )
  })

  let etaAvailable = null
  if (feed && (newArticlesToBeSent.length > 0 || passedCustomComparisons.length > 0)) {
    const toBeDelivered = [ ...newArticlesToBeSent, ...passedCustomComparisons ]
    let earliestArticleMoment
    for (const articleID of toBeDelivered) {
      const article = articleListById[articleID]
      if (!article.date) continue
      const articleMoment = moment(article._fullDate)
      if (!earliestArticleMoment || (articleMoment < earliestArticleMoment)) earliestArticleMoment = articleMoment
    }
    if (!earliestArticleMoment) etaAvailable = 'Unresolvable'
    else {
      const toAdd = refreshRate || botConfig.refreshRateMinutes
      earliestArticleMoment.add(toAdd, 'minutes')
      etaAvailable = `${earliestArticleMoment.diff(moment(), 'minutes')} minutes`
    }
  }

  let latestArticleMoment = null
  let referenceDatabaseMoment = null
  let latestDatabaseMoment = null
  let dataseArticlesWithin5s = true
  let noDatabaseDate = false
  if (feed && feedData) {
    for (const article of articleList) {
      const mom = moment(article._fullDate)
      if (!latestArticleMoment || mom > latestArticleMoment) latestArticleMoment = mom
    }

    for (const item of feedData) {
      if (!item.date || noDatabaseDate) {
        noDatabaseDate = true
        continue
      }
      const mom = moment(item.date)
      if (!latestDatabaseMoment) {
        latestDatabaseMoment = mom
        referenceDatabaseMoment = mom
      } else {
        if (mom > latestDatabaseMoment) {
          latestDatabaseMoment = mom
        }
        const diff = Math.abs(mom.diff(referenceDatabaseMoment, 'minutes'))
        // console.log(mom, referenceDatabaseMoment)
        if (dataseArticlesWithin5s && diff > 3) {
          dataseArticlesWithin5s = false
        }
      }
    }
  }

  if (noDatabaseDate || dataseArticlesWithin5s) {
    latestDatabaseMoment = null
  }

  const mainBody = (
    <div>
      <SectionTitle heading='General Info' />
      <InfoRowBox>
        <div>
          <SectionSubtitle>URL</SectionSubtitle>
          <span>{ feed ? <a href={feed.link} target='_blank' rel='noopener noreferrer'>{feed.url}</a> : null }</span>
        </div>
        <div>
          <SectionSubtitle>Added At</SectionSubtitle>
          <span>{ feed && feed.addedAt ? moment(feed.addedAt).tz(tz).format('ddd, D MMMM YYYY, h:mm A z') : null }</span>
        </div>
      </InfoRowBox>
      <br />
      <InfoRowBox>
        <div>
          <SectionSubtitle>Channel</SectionSubtitle>
          <span>{ channel ? `#${channel.name}` : <span style={{ color: colors.discord.red }}>Missing</span> }</span>
        </div>
        <div>
          <SectionSubtitle>Refresh Rate</SectionSubtitle>
          <span>{waitDuration}</span>
        </div>
      </InfoRowBox>
      {/* <SectionSubtitleDescription>After a feed is added, at least 10 minutes must pass before any new articles are sent (if there are any).</SectionSubtitleDescription> */}
      {/* <AlertBox warn>Yes</AlertBox> */}
      <br />
      <InfoRowBox>
        <div>
          <div>
            <SectionSubtitle>Database Articles</SectionSubtitle>
            <Popup inverted basic content='Number of articles stored by the as reference' trigger={<Icon name='question circle' style={{ fontSize: '.9em' }} />} />
          </div>
          <span>{ feedData ? feedData.length : '-' }</span>
        </div>
        <div>
          <div>
            <SectionSubtitle>Feed Articles</SectionSubtitle>
            <Popup inverted basic content='Number of articles currently in the feed itself' trigger={<Icon name='question circle' style={{ fontSize: '.9em' }} />} />
          </div>
          <span>{ articleList.length }</span>
        </div>
      </InfoRowBox>
      <br />

      {/* <SectionSubtitle>Last Article Delivered At</SectionSubtitle>
      <span>{ feedData ? moment(feedData[feedData.length - 1].date).tz(tz).format('ddd, D MMMM YYYY, h:mm A z') : null}</span> */}

      { !allArticlesHaveDates && checkDate ? <AlertBox warn>Date checking is turned on but some articles in this feed have missing dates. Date checking will cause such articles to never be delivered - be sure to turn it off in Misc Options.</AlertBox> : null }
      <Divider />
      <SectionTitle heading='Details' subheading={<span>Note that these are predictions, and may not be indicative of actual behavior. New articles are defined as new if they are added to the feed <b>past the time of addition</b>.</span>} />

      <SectionSubtitle>Default Algorithm</SectionSubtitle>
      <DetailButton title='New Articles' number={newArticles.length} numberColor={newArticles.length > 0 ? colors.discord.yellow : null}>
        <ul>{ articleListView(newArticles, 1) }</ul>
      </DetailButton>
      <br />
      <DetailButton disabled={!checkDate} popupText={!checkDate ? 'Date checks are not enabled for this feed' : ''} title='Blocked by Date Checks' number={blockedByDateChecks.length * -1} numberColor={blockedByDateChecks.length > 0 ? colors.discord.red : null}>
        <ul>{ articleListView(blockedByDateChecks, 2) }</ul>
      </DetailButton>
      <DetailButton disabled={!checkTitle} popupText={!checkTitle ? 'Title checks are not enabled for this feed' : ''} title='Blocked by Title Checks' number={blockedByTitleChecks.length * -1} numberColor={blockedByTitleChecks.length > 0 ? colors.discord.red : null}>
        <ul>{ articleListView(blockedByTitleChecks, 2) }</ul>
      </DetailButton>
      <DetailButton disabled={!feed || !feed.filters} popupText={!feed || !feed.filters ? 'There are no filters set for this feed.' : ''} title='Blocked by Filters' number={blockedByFilters.length * -1} numberColor={blockedByFilters.length > 0 ? colors.discord.red : null}>
        <ul>{ articleListView(blockedByFilters, 2) }</ul>
      </DetailButton>
      <br />
      <DetailButton title='Pending Article Deliveries' number={newArticlesToBeSent.length} numberColor={newArticlesToBeSent.length > 0 ? colors.discord.green : null}>
        <ul>{ articleListView(newArticlesToBeSent, 3) }</ul>
      </DetailButton>
      <br /><br />

      <SectionSubtitle>Custom Comparisons Algorithm</SectionSubtitle>
      <DetailButton disabled={!customComparisonsEnabled} popupText={!customComparisonsEnabled ? 'Custom comparisons are not enabled for this feed' : ''} title='Pending Article Deliveries' number={passedCustomComparisons.length} numberColor={passedCustomComparisons.length > 0 ? colors.discord.green : null}>
        <ul>{ articleListView(passedCustomComparisons, 3) }</ul>
      </DetailButton>
      <Divider />
      <SectionTitle heading='Summary' />
      <p style={{ fontSize: '16px' }}>
        { newArticles.length === 0 && passedCustomComparisons.length === 0
          ? `No new articles detected at this time.${latestArticleMoment ? ` The newest article currently in the feed was posted ${getDiff(latestArticleMoment)} ago.` : ``}${latestDatabaseMoment ? ` The date at which the latest article was recognized by the bot was ${getDiff(latestDatabaseMoment)} ago.` : ``} ${latestDatabaseMoment && latestArticleMoment && latestDatabaseMoment < latestArticleMoment ? `There appears to be a problem. No new articles were recognized by the algorithm, but there appears to be new articles in the current feed.` : `Once new articles are found, please wait at least ${waitDuration} for them to be delivered.`}`
          : newArticles.length === 0 && passedCustomComparisons.length > 0
            ? `New articles were found through custom comparisons (while none were found through the default algorithm). Please wait at least ${waitDuration} for them to be delivered.`
            : newArticles.length > 0 && passedCustomComparisons.length > 0
              ? `New articles were found through both the default algorithm and custom comparisons. Please wait at least ${waitDuration} for them to be delivered.`
              : newArticlesToBeSent.length < newArticles.length
                ? newArticlesToBeSent.length === 0
                  ? `New articles were found, but they were all blocked by one of the following conditions above.`
                  : `New articles were found. Not all of them will be delivered since some of them were blocked by the above conditions. Please wait at least ${waitDuration} for delivery.`
                : `New articles were found. Please wait at least ${waitDuration} for delivery.`
        }
      </p>
      { etaAvailable
        ? <div>
          <br />
          <SectionSubtitle>Rough ETA</SectionSubtitle>
          {etaAvailable}
        </div>
        : ''
      }
      {/* <br /><br /> */}
      {/* <SectionSubtitle>New Articles</SectionSubtitle> */}
      {/* <SectionSubtitleDescription>Articles stored in the database are used as reference to determine whether articles are old or new.</SectionSubtitleDescription> */}
      {/* <Button content='Refresh' fluid onClick={e => {
        setActiveFeed(feedId)
        fetchDebug()
      }} /> */}
    </div>
  )

  return (
    <Container>
      <PageHeader heading='Debugger' subheading='Understand why your feed may not be working as expected.' />
      <Divider />

      { feed && feed.disabled
        ? <AlertBox warn >This feed has been disabled for the following reason: <strong>{feed.disabled || 'No reason specified'}</strong></AlertBox>
        : articlesError
          ? <ErrorWrapper><h1>Failed to load feed articles</h1><h3>{articlesError}</h3></ErrorWrapper>
          : loadError
            ? <ErrorWrapper><h1>Failed to fetch debug data</h1><h3>{loadError}</h3></ErrorWrapper>
            : loadingState === 0
              ? <Button size='huge' fluid color='black' content='Begin Debugging' onClick={e => {
                setLoadingState(1)
              }} />
              : loadingState === 1 || loadingState === 2
                ? <LoaderWrapper><Loader active content='Loading' /></LoaderWrapper>
                : mainBody}
      <Divider />
      <SectionTitle heading='More Help' />
      <MoreSupportButtons>
        <Button fluid icon labelPosition='right' onClick={e => props.history.push('/faq')}>
          Frequently Asked Questions
          <Icon name='right arrow' />
        </Button>
        <Button fluid icon labelPosition='right' onClick={e => props.history.push(`${pages.FEED_BROWSER}/${encodeURIComponent(feed ? feed.link : '')}`)}>
          Feed Browser
          <Icon name='right arrow' />
        </Button>
        <Button as='a' fluid icon labelPosition='right' target='_blank' href='https://discord.gg/pudv7Rx'>
          Support Server
          <Icon name='external' />
        </Button>
      </MoreSupportButtons>
    </Container>
  )
}

Debugger.propTypes = {
  history: PropTypes.object
}

export default Debugger
