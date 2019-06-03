import React, { Component } from 'react'
import { withRouter, Link } from 'react-router-dom'
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
import articleId from '../ControlPanel/utils/articleId'
import posed, { PoseGroup } from 'react-pose'
import moment from 'moment-timezone'
import axios from 'axios'
import querystring from 'query-string'
import FeedInput from './FeedInput'
import colors from 'js/constants/colors'

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

const CleanLink = styled(Link)`
  &:hover {
    text-decoration: none;
  }
`

const Container = styled.div`
  padding: 20px;
  @media only screen and (min-width: 930px) {
    padding: 55px;
  }
  width: 100%;
  /* max-width: 840px; */
`
const ArticlesSection = styled.div`
  margin-top: 3em;
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
  @media only screen and (min-width: 450px) {
    flex-direction: row;
  }
`

const SortByContainer = styled.div`
  display: flex;
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
  @media only screen and (min-width: 450px) {
    flex-direction: row;
    flex-grow: 0;
  }
`

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
      sortDescending: parsedQuery.ascending === 'true' ? false : true
    }
  }

  componentWillMount () {
    this.props.setToThisPage()
  }

  componentDidMount () {
    if (this.state.url) this.getArticles()
  }

  fillSearchDropdown = (articleList, url, encodedUrl) => {
    const placeholdersSeen = {}
    const searchCategories = ['title'] // Title can always be shown regardless of whether articles have it or not. If there is no title, it will say as such.
    const searchDropdownOptions = []
    let firstValidCategory = ''
    articleList.forEach(placeholders => {
      for (const placeholder in placeholders) {
        if (!placeholders[placeholder]) continue
        if (placeholder === 'date') placeholders[placeholder] = moment(placeholders[placeholder]).local().format('DD MMMM Y hh:mm A (HH:mm) zz')
        if (placeholder.includes('image')) {
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
    this.setState({ searchDropdownOptions, searchCategories, loading: false, search: '', articleList, prevUrl: url, prevEncodedUrl: encodedUrl })
  }

  getArticles = (paramUrl) => {
    const url = paramUrl || this.state.url
    if (!url || this.state.loading) return
    this.setState({ loading: true, error: '' })
    const encodedUrl = encodeURIComponent(url)
    axios.get(`/api/feeds/${encodedUrl}`).then(res => {
      this.fillSearchDropdown(res.data, url, encodedUrl)
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
    this.setState({ sortBy: sortBy || '' })
    // this.props.history.push({
    //   pathname: `${pages.FEED_BROWSER}/${this.state.prevEncodedUrl}`,
    //   search: sortBy ? `?sort=${sortBy}` : ''
    // })
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
        <PosedDiv key={articleId(articleList, placeholders)}>
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



    return (
      <Container>
        <CleanLink to='/'><Button style={{ marginBottom: '1em' }}>Back</Button></CleanLink>
        <PageHeader heading='Feed Browser' subheading='Preview placeholders and browse their contents without adding them!' />
        <SectionTitle heading='URL' subheading='Enter a feed URL.' />
        {/* <Input fluid disabled={this.state.loading} onFocus={e => this.setState({ inputFocused: true })} onBlur={e => this.setState({ inputFocused: false })} action={<Button disabled={!this.state.url} content='Get' onClick={this.getArticles} />} onKeyPress={e => e.key === 'Enter' ? this.getArticles() : null} onChange={e => this.setState({ url: e.target.value }) } value={this.state.url}/> */}
        <FeedInput getArticles={this.getArticles} loading={this.state.loading} />
        <Divider />
        <ArticlesSection className='hello'>

          <OpacityTransition pose={this.state.loading || articleList.length === 0 ? 'exit' : 'enter'} className='world'>
            <SectionTitle heading='Result' subheading='You can filter out article details by selecting certain article categories. You may also filter articles by search.' />
            <UrlDisplay>
              <SectionSubtitle>
                URL
              </SectionSubtitle>
              <a href={this.state.prevUrl} rel='noopener noreferrer' target='_blank'>{this.state.prevUrl}</a>
            </UrlDisplay>
            <Divider />
            <SectionSubtitle>
              Search and Filter
            </SectionSubtitle>
            <ArticlesSectionSearch>
              <Input disabled={this.state.loading || articleList.length === 0} icon='search' fluid onChange={e => this.setState({ search: e.target.value })} placeholder='Search' loading={this.state.loading} />
              <Dropdown disabled={this.state.loading || articleList.length === 0} placeholder='Show Properties' selection fluid multiple options={this.state.searchDropdownOptions} value={this.state.searchCategories} onChange={(e, data) => data.value.length === 0 ? null : this.setState({ searchCategories: data.value }) } loading={this.state.loading} />
            </ArticlesSectionSearch>
            <Divider />
            <ArticlesHeaderContainer>
              <SectionSubtitle>{this.state.articleList.length} Articles</SectionSubtitle>
              <SortByContainer>
                <Dropdown selection value={this.state.sortBy} placeholder='Sort by' disabled={articleList.length === 0 || this.state.loading} onChange={(e, data) => this.sortBy(data.value)} options={this.state.searchDropdownOptions} />
                <Button icon='sort' disabled={!this.state.sortBy || articleList.length === 0 || this.state.loading} onClick={e => this.setState({ sortDescending: !this.state.sortDescending })} />
                <Button icon='cancel' disabled={!this.state.sortBy || articleList.length === 0 || this.state.loading} onClick={e => this.sortBy()} />
              </SortByContainer>
            </ArticlesHeaderContainer>
            </OpacityTransition>
          { this.state.error
            ? <StatusMessage><SectionSubtitleDescription style={{ color: colors.discord.red }} fontSize='20px'>{this.state.error}</SectionSubtitleDescription></StatusMessage>
            : this.state.loading || articleList.length === 0
            ? this.state.loading
              ? <StatusMessage>
                  <Loader active inverted size='massive' content={<SectionSubtitleDescription fontSize='20px'>Fetching...</SectionSubtitleDescription>}/>
                </StatusMessage>
              : this.state.prevUrl
                ? <StatusMessage><SectionSubtitleDescription fontSize='20px'>No articles were found :(</SectionSubtitleDescription></StatusMessage>
                : <StatusMessage><SectionSubtitleDescription fontSize='20px'>Enter a feed URL!</SectionSubtitleDescription></StatusMessage>
            : null
          }
          <PoseGroup animateOnMount>
            {this.state.loading ? [] : elems}
          </PoseGroup>
        </ArticlesSection>
      </Container>
    )
  }
}

FeedBrowser.propTypes = {
  articleList: PropTypes.array,
  setToThisPage: PropTypes.func
}

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(FeedBrowser))
