import React, { Component } from 'react'
import { withRouter } from 'react-router-dom'
import { connect } from 'react-redux'
import { changePage } from 'js/actions/index-actions'
import pages from 'js/constants/pages'
import PageHeader from '../utils/PageHeader'
import SectionItemTitle from '../utils/SectionItemTitle'
import SectionTitle from '../utils/SectionTitle'
import SectionSubtitle from '../utils/SectionSubtitle'
import Wrapper from '../utils/Wrapper'
import parser from '../ControlPanel/utils/textParser'
import PropTypes from 'prop-types'
import styled from 'styled-components'
import { Input, Divider, Popup, Image, Dropdown, Loader, Button } from 'semantic-ui-react'
import SectionSubtitleDescription from '../utils/SectionSubtitleDescription';
import posed, { PoseGroup } from 'react-pose'
import moment from 'moment-timezone'
import axios from 'axios'
import querystring from 'query-string'
import FeedInput from './FeedInput'
import colors from 'js/constants/colors'
import hljs from 'highlight.js'

const timezoneGuess = moment.tz(moment.tz.guess()).format('z')

const mapStateToProps = state => {
  return {
    feedId: state.feedId,
    articleList: state.articleList
  }
}

const mapDispatchToProps = dispatch => {
  return {
    setToThisPage: () => dispatch(changePage(pages.FEED_BROWSER))
  }
}

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

const viewTypeOptions = [{ text: 'Placeholders', value: 'placeholders' }, { text: 'Original XML', value: 'xml' }]

class FeedBrowser extends Component {
  constructor (props) {
    super()
    const parsedQuery = querystring.parse(props.location.search)
    this.state = {
      error: '',
      inputFocused: false,
      url: props.match.params.url ? decodeURIComponent(props.match.params.url) : '',
      prevUrl: '',
      prevEncodedUrl: '',
      search: '',
      loading: false,
      searchCategories: [],
      searchDropdownOptions: [],
      articleList: [],
      sortBy: parsedQuery.sort,
      sortDescending: parsedQuery.ascending === 'true' ? false : true,
      viewType: viewTypeOptions[0].value,
      loadingXML: false,
      xmlText: ''
    }
  }

  componentWillMount () {
    document.title = 'Discord.RSS - Feed Browser'
    this.props.setToThisPage()
  }

  componentDidMount () {
    // const sessionData = sessionStorage.getItem('feedbrowserData')
    // if (sessionData) {
      
    //   this.setState({ loading: true })
    //   return setTimeout(() => {
    //     const sessionDataParsed = JSON.parse(sessionData)
    //     this.fillSearchDropdown(sessionDataParsed.articleList, sessionDataParsed.prevUrl, sessionDataParsed.prevUrlEncoded, sessionDataParsed.xml)
    //   }, 0)
    // }
    if (this.state.url) this.getArticles()
  }

  fillSearchDropdown = (articleList, url, encodedUrl, xmlText) => {
    const placeholdersSeen = {}
    const searchCategories = ['title'] // Title can always be shown regardless of whether articles have it or not. If there is no title, it will say as such.
    const searchDropdownOptions = []
    let firstValidCategory = ''
    articleList.forEach(placeholders => {
      for (const placeholder in placeholders) {
        if (!placeholders[placeholder] || placeholder === 'id') continue
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
        // } else if (placeholder !== 'fullDescription' && placeholder !== 'fullSummary' && placeholder !== 'fullTitle' && !placeholdersSeen[placeholder]) {
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
    this.props.history.push({
      pathname: `${pages.FEED_BROWSER}/${encodedUrl}` //,
      // search: this.state.sortBy && searchCategories.includes(this.state.sortBy) ? `?sort=${this.state.sortBy}` : undefined
    })
    this.setState({ searchDropdownOptions, searchCategories, loading: false, search: '', articleList, prevUrl: url, prevUrlEncoded: encodedUrl, xmlText })
  }

  getArticles = (paramUrl) => {
    const url = paramUrl || this.state.url
    if (!url || this.state.loading) return
    this.setState({ loading: true, error: '', viewType: viewTypeOptions[0].value, xmlText: '', loadingXML: false })
    const encodedUrl = encodeURIComponent(url)
    axios.get(`/api/feeds/${encodedUrl}`).then(res => {
      this.fillSearchDropdown(res.data.placeholders, url, encodedUrl, res.data.xml)
      sessionStorage.setItem('feedbrowserData', JSON.stringify({ articleList: res.data.placeholders, xml: res.data.xml, prevUrl: url, prevUrlEncoded: encodedUrl }))
      // this.setState({ loading: false, articleList: res.data, prevUrl: url })
    }).catch(err => {
      console.log(err.response || err.message)
      const errMessage = err.response && err.response.data && err.response.data.message ? err.response.data.message : err.response && err.response.data ? err.response.data : err.message
      console.log(errMessage)
      this.setState({ loading: false, error: errMessage })
      // toast.error(<p>Failed to fetch feed<br/><br/>{errMessage ? typeof errMessage === 'object' ? JSON.stringify(errMessage, null, 2) : errMessage : 'No details available'}</p>)
    })
  }

  sortBy = sortBy => {
    if (this.state.sortBy !== sortBy) this.setState({ sortBy: sortBy || '' })
    // this.props.history.push({
    //   pathname: `${pages.FEED_BROWSER}/${this.state.prevEncodedUrl}`,
    //   search: sortBy ? `?sort=${sortBy}` : ''
    // })
  }

  viewType = viewType => {
    const { prevUrl } = this.state
    if (!prevUrl || viewType === this.state.viewType) return
    if (viewType === 'placeholders') {
      this.setState({ viewType, error: '' })
      return
    }
    if (this.state.xmlText) return this.setState({ viewType })
  }

  render () {
    const { search, searchCategories, articleList } = this.state
    // const { articleList } = this.props
    const searchCategoriesHasImages = searchCategories.includes('images')
    const searchCategoriesHasAnchors = searchCategories.includes('anchors')
    const searchCategoriesHasTitle = searchCategories.includes('title')
    const searchCategoriesHasDescription = searchCategories.includes('description')
    const searchCategoriesHasDate = searchCategories.includes('date')
    const searchCategoriesHasLink = searchCategories.includes('link')

    const elems = (!this.state.sortBy || !searchCategories.includes(this.state.sortBy)
      ? articleList
      : [ ...articleList ].sort((a, b) => {
          const result = a[this.state.sortBy] > b[this.state.sortBy] ? 1 : -1
          return this.state.sortDescending ? result : result * -1
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
        for (const placeholder in placeholders) {
          const val = placeholders[placeholder]
          if (searchCategoriesHasImages && placeholder.includes('image')) images.push(<Popup key={val + 'genned'} on='hover' inverted hideOnScroll trigger={<a rel="noopener noreferrer" href={val} target='_blank'><Image src={val} key={val} /></a>} content={`{${placeholder}}`} />)
          else if (searchCategoriesHasAnchors && placeholder.includes('anchor')) anchors.push(
            <div key={val + 'genned'}>
              <PlaceholderTitle>{placeholder.replace(/^([a-z]*):[a-z]*(\d)/, '$1 anchor $2')}</PlaceholderTitle>
              <Popup on='hover' inverted hideOnScroll trigger={<a rel="noopener noreferrer" href={val} target='_blank'>{val}</a>} content={`{${placeholder}}`} />
            </div>
          )
        }
      }

      const singleLineElements = []
      if (searchCategoriesHasLink) singleLineElements.push(<div key={placeholders.link + 'sl'}><PlaceholderTitle>Link</PlaceholderTitle><Popup position='left center' hideOnScroll trigger={<a rel="noopener noreferrer" target='_blank' href={placeholders.link}>{placeholders.link}</a>} inverted content='{link}' on='hover' /></div>)
      for (const category of searchCategories) {
        // Skip the below categories since these must be manually added below to preserve their ordering. Anchors and images don't have to be ordered, but they're already handled in the above for loop for efficiency
        if (category === 'title' || category === 'date' || category === 'link' || category === 'description' || category === 'anchors' || category === 'images') continue
        singleLineElements.push(<div key={placeholders[category] + 'sll'}><PlaceholderTitle>{category}</PlaceholderTitle><Popup position='left center' hideOnScroll trigger={<p>{parser.parseAllowLinks(placeholders[category])}</p>} inverted content={`{${category}}`} on='hover' /></div>)
      }

      return (
        <PosedDiv key={placeholders.id}>
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


    const notPlaceholdersViewType = this.state.viewType !== 'placeholders'
    return (
      <div>
        <Header>
        <PageHeader heading='Feed Browser' />
        <p>Preview placeholders and browse their contents without adding them!</p>
        {/* <SectionTitle heading='URL' subheading='Enter a feed URL.' /> */}
        {/* <Input fluid disabled={this.state.loading} onFocus={e => this.setState({ inputFocused: true })} onBlur={e => this.setState({ inputFocused: false })} action={<Button disabled={!this.state.url} content='Get' onClick={this.getArticles} />} onKeyPress={e => e.key === 'Enter' ? this.getArticles() : null} onChange={e => this.setState({ url: e.target.value }) } value={this.state.url}/> */}
        <FeedInput getArticles={this.getArticles} loading={this.state.loading} />
        </Header>

        <ArticlesSection className='hello'>
          <ArticlesSectionInner>
            <OpacityTransition pose={this.state.loading || articleList.length === 0 ? 'exit' : 'enter'} className='world'>
              <SectionTitle heading='Result' subheading='You can filter out article details by selecting certain article categories. You may also filter articles by search.' />
              <UrlDisplay>
                <SectionSubtitle>
                  URL
                </SectionSubtitle>
                <a href={this.state.prevUrl} rel='noopener noreferrer' target='_blank'>{this.state.prevUrl}</a>
              </UrlDisplay>
              <Divider />
              <SearchFilterSection pose={notPlaceholdersViewType ? 'exit' : 'enter'}>
                <SectionSubtitle>
                  Search and Filter
                </SectionSubtitle>
                <ArticlesSectionSearch>
                  <Input disabled={this.state.loading || articleList.length === 0} icon='search' fluid onChange={e => this.setState({ search: e.target.value })} placeholder='Search' loading={this.state.loading} />
                  <Dropdown disabled={this.state.loading || articleList.length === 0} placeholder='Show Properties' selection fluid multiple options={this.state.searchDropdownOptions} value={this.state.searchCategories} onChange={(e, data) => data.value.length === 0 ? null : this.setState({ searchCategories: data.value }) } loading={this.state.loading} />
                </ArticlesSectionSearch>
                <Divider />
              </SearchFilterSection>
              <ArticlesHeaderContainer>
                <SectionSubtitle>{this.state.articleList.length} Articles</SectionSubtitle>
                <ViewOptions>
                  <Dropdown selection placeholder='View type' options={viewTypeOptions} value={this.state.viewType} onChange={(e, data) => this.viewType(data.value)} />
                  <SortByContainer pose={notPlaceholdersViewType ? 'exit' : 'enter'}>
                    <Dropdown selection value={this.state.sortBy} placeholder='Sort by' disabled={notPlaceholdersViewType || articleList.length === 0 || this.state.loading} onChange={(e, data) => this.sortBy(data.value)} options={this.state.searchDropdownOptions} />
                    <Button icon='sort' disabled={notPlaceholdersViewType || !this.state.sortBy || articleList.length === 0 || this.state.loading} onClick={e => this.setState({ sortDescending: !this.state.sortDescending })} />
                    <Button icon='cancel' disabled={notPlaceholdersViewType || !this.state.sortBy || articleList.length === 0 || this.state.loading} onClick={e => this.sortBy()} />
                  </SortByContainer>
                </ViewOptions>
              </ArticlesHeaderContainer>
            </OpacityTransition>
            { this.state.error
              ? <StatusMessage><SectionSubtitleDescription style={{ color: colors.discord.red }} fontSize='20px'>{this.state.error}</SectionSubtitleDescription></StatusMessage>
              : this.state.loading || articleList.length === 0 || this.state.loadingXML
              ? (this.state.loading || this.state.loadingXML)
                ? <StatusMessage>
                    <Loader active inverted size='massive' content={<SectionSubtitleDescription fontSize='20px'>Fetching...</SectionSubtitleDescription>}/>
                  </StatusMessage>
                : this.state.prevUrl
                  ? <StatusMessage><SectionSubtitleDescription fontSize='20px'>No articles were found :(</SectionSubtitleDescription></StatusMessage>
                  : null
              : null
            }
            <PoseGroup animateOnMount>
              {notPlaceholdersViewType || this.state.loading || this.state.loadingXML ? [] : elems}
            </PoseGroup>
            <OpacityTransition pose={notPlaceholdersViewType && this.state.xmlText && !this.state.loading && !this.state.loadingXML ? 'enter' : 'exit'}>
              <pre style={{ maxWidth: '100%', width: '100%' }}>
                <code dangerouslySetInnerHTML={{ __html: hljs.highlight('xml', this.state.xmlText).value}} />
              </pre>
            </OpacityTransition>

          </ArticlesSectionInner>
        </ArticlesSection>
      </div>
    )
  }
}

FeedBrowser.propTypes = {
  articleList: PropTypes.array,
  setToThisPage: PropTypes.func
}

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(FeedBrowser))
