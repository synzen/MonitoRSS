import React, { useState, useEffect } from 'react'
import { useHistory, useLocation, useRouteMatch } from 'react-router-dom'
import pages from 'js/constants/pages'
import PageHeader from '../utils/PageHeader'
import SectionItemTitle from '../utils/SectionItemTitle'
import SectionTitle from '../utils/SectionTitle'
import SectionSubtitle from '../utils/SectionSubtitle'
import Wrapper from '../utils/Wrapper'
import parser from '../ControlPanel/utils/textParser'
import styled from 'styled-components'
import { Input, Divider, Popup, Image, Dropdown, Loader, Button } from 'semantic-ui-react'
import SectionSubtitleDescription from '../utils/SectionSubtitleDescription'
import posed, { PoseGroup } from 'react-pose'
import moment from 'moment-timezone'
import axios from 'axios'
import querystring from 'query-string'
import FeedInput from './FeedInput'
import colors from 'js/constants/colors'
import hljs from 'highlight.js'
import { isHiddenProperty } from '../../constants/hiddenArticleProperties'

const timezoneGuess = moment.tz(moment.tz.guess()).format('z')

const Header = styled.div`
  background-color: #26262b;
  width: 100%;
  height: 350px;
  padding: 0 30px;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  text-align: center;
  > div:first-child {
    padding-bottom: 10px;
  }
  > p {
    margin-bottom: 30px;
  }
  .ui.input {
    max-width: 700px;
    width: 100%;
  }
  .ui.dropdown {
    max-width: 700px;
    width: 100%;
  }
`

const ArticlesSection = styled.div`
  margin: 3em auto;
  max-width: 1450px;
  width: 100%;
`

const ArticlesSectionInner = styled.div`
  padding: 0 25px;
`

const ArticlesSectionSearch = styled.div`
  margin-bottom: 1em;
  .ui.input {
    margin-bottom: 1em;;
  }
`

const ArticlesHeaderContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  margin-bottom: 1em;
  @media only screen and (min-width: 650px) {
    flex-direction: row;
  }
`

const SearchFilterSection = posed.div({
  enter: { height: 'auto', opacity: 1 },
  exit: { height: 0, opacity: 0 }
})

const ViewOptions = styled.div`
  display: flex;
  flex-direction: column;
  
  > .ui.dropdown:first-child {
    flex-grow: 1;
    margin-bottom: 5px;
  }
  @media only screen and (min-width: 650px) {
    flex-direction: row;
    > .ui.dropdown:first-child {
      flex-grow: 0;
      margin-bottom: 0;
      margin-right: 10px;
    }
  }
`

const SortByContainerStyles = styled.div`
  display: flex;
  /* overflow: hidden; */
  > .ui.dropdown {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
    flex-grow: 1;
  }
  > .ui.button {
    border-radius: 0;
  }
  > .ui.button:last-child {
    border-top-right-radius: 4px;
    border-bottom-right-radius: 4px;
  }
  @media only screen and (min-width: 650px) {
    flex-direction: row;
    flex-grow: 0;
  }
`

const SortByContainer = posed(SortByContainerStyles)({
  enter: { width: 'auto', opacity: 1 },
  exit: { width: 0, opacity: 0 }
})

const ArticleImages = styled.div`
  a {
    display: inline-block;
    margin-right: 10px;
    margin-bottom: 5px;
    /* max-height: 100px; */
    > img {
      max-height: 100px;
    }
    &:last-child {
      margin-right: 0;
    }
  }
`

const ArticleStyle = styled.div`
  word-break: break-all;
`

const PosedDiv = posed(ArticleStyle)({
  enter: { opacity: 1 },
  exit: { opacity: 0 }
})

const PlaceholderTitle = styled(SectionSubtitle)`
  margin-top: 1em;
  /* color: white; */
`

const StatusMessage = styled.div`
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  margin: 25px 0;
  user-select: none;
`

const UrlDisplay = styled.div`
  display: flex;
  align-items: center;
  word-break: break-all;
  > label {
    margin-bottom: 0;
    margin-right: 1em;
  }
`

const OpacityTransition = posed.div({
  enter: { opacity: 1, height: '100%' },
  exit: { opacity: 0, height: 0 }
})

const XMLWrapperStyles = styled.pre`
  max-width: 100%;
  width: 100%;
`
const XMLWrapper = posed(XMLWrapperStyles)()

const viewTypeOptions = [{ text: 'Placeholders', value: 'placeholders' }, { text: 'Original XML', value: 'xml' }]

function FeedBrowser () {
  const location = useLocation()
  const match = useRouteMatch()
  const history = useHistory()
  const parsedQuery = querystring.parse(location.search)
  const [viewType, setViewType] = useState('placeholders')
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [searchDropdownOptions, setSearchDropdownOptions] = useState([])
  const [searchCategories, setSearchCategories] = useState([])
  const [articleList, setArticleList] = useState([])
  const [error, setError] = useState()
  const [loadingXML, setLoadingXML] = useState(false)
  const [xmlText, setXMLText] = useState()
  const [sortBy, setSortBy] = useState(parsedQuery.sort)
  const [sortDescending, setSortDescending] = useState(parsedQuery.ascending !== 'true')
  const [prevUrl, setPrevUrl] = useState('')
  const [url] = useState(match.params.url ? decodeURIComponent(match.params.url) : '')

  useEffect(() => {
    if (url) {
      getArticles()
    }
  }, [])

  // const { articleList } = this.props
  const searchCategoriesHasImages = searchCategories.includes('images')
  const searchCategoriesHasAnchors = searchCategories.includes('anchors')
  const searchCategoriesHasTitle = searchCategories.includes('title')
  const searchCategoriesHasDescription = searchCategories.includes('description')
  const searchCategoriesHasDate = searchCategories.includes('date')
  const searchCategoriesHasLink = searchCategories.includes('link')

  const elems = (!sortBy || !searchCategories.includes(sortBy)
    ? articleList
    : [ ...articleList ].sort((a, b) => {
      const result = a[sortBy] > b[sortBy] ? 1 : -1
      return sortDescending ? result : result * -1
    })
  ).map(placeholders => {
    const images = []
    const anchors = []
    let include = false
    // First see if there's a search
    if (!search) include = true
    else {
      for (const placeholder in placeholders) {
        if (include) continue
        const val = placeholders[placeholder]
        if (searchCategories.includes(placeholder) || (searchCategoriesHasImages && placeholder.includes('image')) || (searchCategoriesHasAnchors && placeholder.includes('anchor'))) {
          if (val.toString().toLowerCase().includes(search)) include = true
        }
      }
    }

    if (!include) return null

    // Generate the image and anchor elements
    if (searchCategoriesHasAnchors || searchCategoriesHasImages) {
      const uniqueImages = new Set()
      for (const placeholder in placeholders) {
        const val = placeholders[placeholder]
        if (searchCategoriesHasImages && placeholder.includes('image') && !uniqueImages.has(val) && !placeholder.startsWith('raw')) {
          uniqueImages.add(val)
          images.push(<Popup
            key={val}
            on='hover'
            inverted
            hideOnScroll
            trigger={<a rel='noopener noreferrer' href={val} target='_blank'><Image src={val} key={val} /></a>}
            content={`{${placeholder}}`} />)
        } else if (searchCategoriesHasAnchors && placeholder.includes('anchor')) {
          anchors.push(
            <div key={val + 'genned'}>
              <PlaceholderTitle>{placeholder.replace(/^([a-z]*):[a-z]*(\d)/, '$1 anchor $2')}</PlaceholderTitle>
              <Popup on='hover' inverted hideOnScroll trigger={<a rel='noopener noreferrer' href={val} target='_blank'>{val}</a>} content={`{${placeholder}}`} />
            </div>
          )
        }
      }
    }
    // console.log(images)

    const singleLineElements = []
    if (searchCategoriesHasLink) singleLineElements.push(<div key={placeholders.link + 'sl'}><PlaceholderTitle>Link</PlaceholderTitle><Popup position='left center' hideOnScroll trigger={<a rel='noopener noreferrer' target='_blank' href={placeholders.link}>{placeholders.link}</a>} inverted content='{link}' on='hover' /></div>)
    for (const category of searchCategories) {
      // Skip the below categories since these must be manually added below to preserve their ordering. Anchors and images don't have to be ordered, but they're already handled in the above for loop for efficiency
      if (category === 'title' || category === 'date' || category === 'link' || category === 'description' || category === 'anchors' || category === 'images') continue
      singleLineElements.push(<div key={placeholders[category] + 'sll'}><PlaceholderTitle>{category}</PlaceholderTitle><Popup position='left center' hideOnScroll trigger={<p>{parser.parseAllowLinks(placeholders[category])}</p>} inverted content={`{${category}}`} on='hover' /></div>)
    }

    return (
      <PosedDiv key={placeholders._id} className='hodunk'>
        <Wrapper>
          { searchCategoriesHasDate
            ? placeholders.date
              ? <Popup position='left center' hideOnScroll trigger={<SectionSubtitleDescription>{placeholders.date + timezoneGuess}</SectionSubtitleDescription>} on='focus' inverted content='{date}' />
              : null
            : null
          }
          { searchCategoriesHasTitle
            ? placeholders.title
              ? <Popup position='left center' hideOnScroll trigger={<SectionItemTitle>{parser.parseAllowLinks(placeholders.title)}</SectionItemTitle>} on='focus' inverted content='{title}' />
              : <SectionItemTitle>No Title Available</SectionItemTitle>
            : null
          }
          { searchCategoriesHasDescription
            ? placeholders.description
              ? <Popup position='left center' hideOnScroll trigger={<p>{parser.parseAllowLinks(placeholders.description || placeholders.summary)}</p>} inverted content='{summary}' on='focus' />
              : null
            : null
          }
          {singleLineElements.length > 0 ? <Divider /> : null}
          {singleLineElements}
          { anchors }
          { images.length > 0
            ? <div>
              <PlaceholderTitle>Images</PlaceholderTitle>
              <ArticleImages>
                {images}
              </ArticleImages>
            </div>
            : null
          }
        </Wrapper>
        <Divider />
      </PosedDiv>
    )
  })

  const notPlaceholdersViewType = viewType !== 'placeholders'

  const fillSearchDropdown = (articleList, url, encodedUrl, xmlText) => {
    const placeholdersSeen = {}
    const searchCategories = ['title'] // Title can always be shown regardless of whether articles have it or not. If there is no title, it will say as such.
    const searchDropdownOptions = []
    let firstValidCategory = ''
    articleList.forEach(placeholders => {
      for (const placeholder in placeholders) {
        if (!placeholders[placeholder] || isHiddenProperty(placeholder)) continue
        if (placeholder === 'date') {
          placeholders[placeholder] = moment(placeholders[placeholder]).local().format('DD MMMM Y hh:mm A (HH:mm) zz')
          if (!placeholdersSeen.date) {
            placeholdersSeen.date = true
            searchDropdownOptions.push({ text: 'date', value: 'date' })
          }
        } else if (placeholder.includes('image')) {
          if (!placeholdersSeen.images) {
            placeholdersSeen.images = true
            searchDropdownOptions.push({ text: 'images', value: 'images' })
          }
        } else if (placeholder.includes('anchor')) {
          if (!placeholdersSeen.anchors) {
            placeholdersSeen.anchors = true
            searchDropdownOptions.push({ text: 'anchors', value: 'anchors' })
          }
        } else if (!placeholdersSeen[placeholder]) {
          if (!firstValidCategory) firstValidCategory = placeholder
          placeholdersSeen[placeholder] = true
          searchDropdownOptions.push({ text: placeholder, value: placeholder })
        }
      }
    })
    if (placeholdersSeen.date) searchCategories.push('date')
    if (placeholdersSeen.description) searchCategories.push('description')
    if (placeholdersSeen.link) searchCategories.push('link')
    if (searchCategories.length === 0) searchCategories.push(firstValidCategory)

    const pathname = `${pages.FEED_BROWSER}/${encodedUrl}`
    // console.log(this.props.history)
    if (history.location.pathname !== pathname) {
      history.push({
        pathname //,
        // search: this.state.sortBy && searchCategories.includes(this.state.sortBy) ? `?sort=${this.state.sortBy}` : undefined
      })
    }
    setSearchDropdownOptions(searchDropdownOptions)
    setSearchCategories(searchCategories)
    setLoading(false)
    setSearch('')
    setArticleList(articleList)
    setPrevUrl(url)
    setXMLText(xmlText)
  }

  const getArticles = (paramUrl) => {
    const targetURL = paramUrl || url
    if (!targetURL || loading) return
    setLoading(true)
    setError('')
    setViewType(viewTypeOptions[0].value)
    setXMLText('')
    setLoadingXML(false)
    const encodedUrl = encodeURIComponent(targetURL)
    axios.get(`/api/feeds/${encodedUrl}`).then(res => {
      console.log(res.data)
      fillSearchDropdown(res.data.placeholders, targetURL, encodedUrl, res.data.xml)
      sessionStorage.setItem('feedbrowserData', JSON.stringify({ articleList: res.data.placeholders, xml: res.data.xml, prevUrl: targetURL }))
      // this.setState({ loading: false, articleList: res.data, prevUrl: url })
    }).catch(err => {
      console.log(err.response || err.message)
      const errMessage = err.response && err.response.data && err.response.data.message ? err.response.data.message : err.response && err.response.data ? err.response.data : err.message
      console.log(errMessage)
      setError(errMessage)
    })
  }

  const changeViewType = newViewType => {
    if (!prevUrl || viewType === newViewType) return
    if (newViewType === 'placeholders') {
      setViewType(newViewType)
      setError('')
      return
    }
    if (xmlText) {
      setViewType(newViewType)
    }
  }

  const changeSortBy = newSortBy => {
    if (newSortBy !== sortBy) {
      setSortBy(newSortBy || '')
    }
  }
  return (
    <div>
      <Header>
        <PageHeader heading='Feed Browser' />
        <p>Preview placeholders and browse their contents without adding them!</p>
        <FeedInput getArticles={getArticles} loading={loading} />
      </Header>

      <ArticlesSection className='hello'>
        <ArticlesSectionInner>
          <OpacityTransition pose={loading || articleList.length === 0 ? 'exit' : 'enter'} className='world'>
            <SectionTitle heading='Result' subheading='You can filter out article details by selecting certain article categories. You may also filter articles by search.' />
            <UrlDisplay>
              <SectionSubtitle>
                URL
              </SectionSubtitle>
              <a href={prevUrl} rel='noopener noreferrer' target='_blank'>{prevUrl}</a>
            </UrlDisplay>
            <Divider />
            <SearchFilterSection pose={notPlaceholdersViewType ? 'exit' : 'enter'}>
              <SectionSubtitle>
                Search and Filter
              </SectionSubtitle>
              <ArticlesSectionSearch>
                <Input disabled={loading || articleList.length === 0} icon='search' fluid onChange={e => setSearch(e.target.value)} placeholder='Search' loading={loading} />
                <Dropdown disabled={loading || articleList.length === 0} placeholder='Show Properties' selection fluid multiple options={searchDropdownOptions} value={searchCategories} onChange={(e, data) => data.value.length === 0 ? null : setSearchCategories(data.value)} loading={loading} />
              </ArticlesSectionSearch>
              <Divider />
            </SearchFilterSection>
            <ArticlesHeaderContainer>
              <SectionSubtitle>{articleList.length} Articles</SectionSubtitle>
              <ViewOptions>
                <Dropdown selection placeholder='View type' options={viewTypeOptions} value={viewType} onChange={(e, data) => changeViewType(data.value)} />
                <SortByContainer pose={notPlaceholdersViewType ? 'exit' : 'enter'} style={articleList.length === 0 ? { overflow: 'hidden' } : {}}>
                  <Dropdown selection value={sortBy} placeholder='Sort by' disabled={notPlaceholdersViewType || articleList.length === 0 || loading} onChange={(e, data) => changeSortBy(data.value)} options={searchDropdownOptions} />
                  <Button icon='sort' disabled={notPlaceholdersViewType || !sortBy || articleList.length === 0 || loading} onClick={e => setSortDescending(!sortDescending)} />
                  <Button icon='cancel' disabled={notPlaceholdersViewType || !sortBy || articleList.length === 0 || loading} onClick={e => changeSortBy()} />
                </SortByContainer>
              </ViewOptions>
            </ArticlesHeaderContainer>
          </OpacityTransition>
          { error
            ? <StatusMessage><SectionSubtitleDescription style={{ color: colors.discord.red }} fontSize='20px'>{error}</SectionSubtitleDescription></StatusMessage>
            : loading || articleList.length === 0 || loadingXML
              ? (loading || loadingXML)
                ? <StatusMessage>
                  <Loader active inverted size='massive' content={<SectionSubtitleDescription fontSize='20px'>Fetching...</SectionSubtitleDescription>} />
                </StatusMessage>
                : prevUrl
                  ? <StatusMessage><SectionSubtitleDescription fontSize='20px'>No articles were found :(</SectionSubtitleDescription></StatusMessage>
                  : null
              : null
          }
          <PoseGroup animateOnMount>
            {loading || loadingXML
              ? []
              : notPlaceholdersViewType && xmlText
                ? [
                  <XMLWrapper key='xml'>
                    <code dangerouslySetInnerHTML={{ __html: hljs.highlight('xml', xmlText).value }} />
                  </XMLWrapper>
                ]
                : elems
            }
          </PoseGroup>
        </ArticlesSectionInner>
      </ArticlesSection>
    </div>
  )
}

export default FeedBrowser
