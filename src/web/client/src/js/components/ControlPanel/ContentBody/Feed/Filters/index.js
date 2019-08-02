import React, { Component } from 'react'
import { connect } from 'react-redux'
import { Redirect } from 'react-router-dom'
import { changePage } from 'js/actions/index-actions'
import pages from 'js/constants/pages'
import PropTypes from 'prop-types'
import styled from 'styled-components'
import PageHeader from 'js/components/utils/PageHeader'
import SectionTitle from 'js/components/utils/SectionTitle'
import SectionSubtitle from 'js/components/utils/SectionSubtitle'
import ArticleTable from '../../../utils/ArticleTable'
import AddFilter from '../../../utils/AddFilter'
import FiltersTable from '../../../utils/FiltersTable'
import toast from '../../../utils/toast'
import testFilters from './util/filters'
import { Button, Divider, Icon, Popup } from 'semantic-ui-react'
import axios from 'axios'

const mapStateToProps = state => {
  return {
    filters: state.filters,
    feedId: state.feedId,
    guildId: state.guildId,
    articleList: state.articleList,
    csrfToken: state.csrfToken
  }
}

const mapDispatchToProps = dispatch => {
  return {
    setToThisPage: () => dispatch(changePage(pages.FILTERS)),
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

const FilterDetails = styled.div`
  margin-top: 1em;
`

const FilterExplanation = styled.div`
  background-color: rgba(32,34,37,0.6);
  border-radius: 3px;
  padding: 1em;
`

const FilterTagContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  > div {
    margin-top: 1em;
    > a {
      color: white;
      margin-right: 5px;
      margin-bottom: 5px;
      cursor: pointer;
      &:last-child {
        margin-right: 0;
      }
      &:hover {
        text-decoration: none;
        color: white;
      }
    }
  }
`

const FilterTag = styled.a`
  display: inline-block;
  padding: 3px 5px;
  color: white;
  border-radius: 3px;
  background-color: ${props => props.color};
`

class Filters extends Component {
  constructor () {
    super()
    this.state = {
      selectedArticle: ''
    }
  }

  componentWillMount () {
    this.props.setToThisPage()
  }

  removeFilter = (type, term) => {
    const payload = { type, term }
    const { csrfToken, guildId, feedId } = this.props
    this.setState({ removing: payload })
    axios.delete(`/api/guilds/${guildId}/feeds/${feedId}/filters`, { data: payload }, { headers: { 'CSRF-Token': csrfToken } })
    .then(() => {
      toast.success(`Removed filter ${term}`)
      this.setState({ removing: null })
    }).catch(err => {
      this.setState({ removing: null })
      if (err.response && err.response.status === 304) return toast.success('No changes detected')
      const errMessage = err.response && err.response.data && err.response.data.message ? err.response.data.message : err.response && err.response.data ? err.response.data : err.message
      toast.error(<p>Failed to remove filter<br/><br/>{errMessage ? typeof errMessage === 'object' ? JSON.stringify(errMessage, null, 2) : errMessage : 'No details available'}</p>)
      console.log(err.response || err.message)
    })
  }

  render () {
    const { filters, guildId, feedId } = this.props
    if (!feedId) {
      this.props.toDashboard()
      return <Redirect to='/' />
    }
    const feedFilters = filters[guildId] && filters[guildId][feedId] ? filters[guildId][feedId] : {}
    const selectedArticleFilterResults = this.state.selectedArticle ? testFilters(feedFilters, this.state.selectedArticle) : null

    const invertedFilterTags = []
    const regularFilterTags = []
    if (selectedArticleFilterResults) {
      const matches = selectedArticleFilterResults.matches
      for (const filterType in matches) {
        const words = []
        for (const filterWord of matches[filterType]) {
          words.push(
            <Popup
              on='click'
              inverted
              hideOnScroll
              trigger={<FilterTag color='rgba(67,181,129,.3)'>{filterWord}</FilterTag>}
              content={<Button color='red' onClick={e => this.removeFilter(filterType, filterWord)} content='Delete' />}
            />
          )
        }
        regularFilterTags.push(<div><SectionSubtitle>{filterType}</SectionSubtitle>{words}</div>)
      }
      const invertedMatches = selectedArticleFilterResults.invertedMatches
      for (const filterType in invertedMatches) {
        const words = []
        for (const filterWord of invertedMatches[filterType]) {
          words.push(
            <Popup
              on='click'
              inverted
              hideOnScroll
              trigger={<FilterTag color='rgba(100,31,31,.35)'>{filterWord}</FilterTag>}
              content={<Button color='red' onClick={e => this.removeFilter(filterType, filterWord)} content='Delete' />}
            />
          )
        }
        invertedFilterTags.push(<div><SectionSubtitle>{filterType}</SectionSubtitle>{words}</div>)
      }
    }

    return (
      <Container>
        <PageHeader>
          <h2>Filters</h2>
          <p>Set up filters to decide which articles should be sent to Discord.</p>
        </PageHeader>
        <Divider />
        <SectionTitle heading='Current' subheading='Your current filters are listed here.' />
        <FiltersTable filters={feedFilters} removeApiUrl={`/api/guilds/${guildId}/feeds/${feedId}/filters`} />
        <Divider />
        <SectionTitle heading='Add' subheading='Type a new filter and add it. Note that all filters are automatically lowercased.' />
        <AddFilter addApiUrl={`/api/guilds/${guildId}/feeds/${feedId}/filters`} />
        <Divider />

        <SectionTitle heading='Classifications' subheading='See what current articles gets blocked or passes your current filters. Click on a row to see more in-depth details.' />
        <ArticleTable
          onClickArticle={article => this.setState({ selectedArticle: article })}
          positiveNegativeRowFunc={data => !!testFilters(feedFilters, data).passed}
          addColumns={[
            {
              collapsing: true,
              headers: ['Passed'],
              cellFuncs: [
                article => {
                  const passedFilters = testFilters(feedFilters, article).passed
                  return passedFilters ? <Icon name='check' color='green' /> : <Icon name='x' color='red' />
                }
              ]
            }
          ]}
        />
          {
            !selectedArticleFilterResults
              ? null
              : <FilterDetails>
                <SectionSubtitle>Filter Result Explanation</SectionSubtitle>
                  <FilterExplanation>
                    {!selectedArticleFilterResults.passed
                      ? Object.keys(selectedArticleFilterResults.invertedMatches).length === 0
                        ? <p>This article would not have been sent to Discord because there were no matching filters.</p>
                        : <p>This article would not have been sent to Discord because the following negated filters blocked it: {<FilterTagContainer>{invertedFilterTags}</FilterTagContainer>}</p>
                      : Object.keys(selectedArticleFilterResults.matches).length === 0
                        ? <p>This article would have been sent because there are no filters to negate it.</p>
                        : <p>This article would have been sent because the following filters were matched, with no negated filters: {<FilterTagContainer>{regularFilterTags}</FilterTagContainer>}</p>
                    }
                  </FilterExplanation>
                </FilterDetails>
          }
        <Divider />

      </Container>
    )
  }
}

Filters.propTypes = {
  setToThisPage: PropTypes.func
}

export default connect(mapStateToProps, mapDispatchToProps)(Filters)
