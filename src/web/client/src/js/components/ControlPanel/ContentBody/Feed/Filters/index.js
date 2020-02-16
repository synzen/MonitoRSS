import React, { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import styled from 'styled-components'
import PageHeader from 'js/components/utils/PageHeader'
import SectionTitle from 'js/components/utils/SectionTitle'
import SectionSubtitle from 'js/components/utils/SectionSubtitle'
import ArticleTable from '../../../utils/ArticleTable'
import AddFilter from '../../../utils/AddFilter'
import FiltersTable from '../../../utils/FiltersTable'
import testFilters from 'js/utils/testFilters'
import { Button, Divider, Icon, Popup } from 'semantic-ui-react'
import feedSelectors from 'js/selectors/feeds'
import { fetchEditFeed } from 'js/actions/feeds'
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

function Filters () {
  const feed = useSelector(feedSelectors.activeFeed)
  const editing = useSelector(feedSelectors.feedEditing)
  const [selectedArticle, setArticle] = useState()
  const dispatch = useDispatch()

  useEffect(() => {
    dispatch(changePage(pages.FILTERS))
  }, [dispatch])

  if (!feed) {
    dispatch(changePage(pages.DASHBOARD))
    return <Redirect to={pages.DASHBOARD} />
  }

  const feedFilters = feed.filters

  const removeFilter = async (filterType, filterWord) => {
    let filters = [ ...feedFilters[filterType] ]
    filters.splice(filters.indexOf(filterWord), 1)
    if (filters.length === 0) {
      filters = ''
    }
    await dispatch(fetchEditFeed(feed.guild, feed._id, {
      filters: {
        ...feedFilters,
        [filterType]: filters
      }
    }))
  }

  const addFilter = async (filterType, filterWord) => {
    const filters = feedFilters[filterType] ? [ ...feedFilters[filterType] ] : []
    if (filters.includes(filterWord)) {
      return toast.error(`The ${filterType} filter "${filterWord}" already exists!`)
    }
    filters.push(filterWord)
    await dispatch(fetchEditFeed(feed.guild, feed._id, {
      filters: {
        ...feedFilters,
        [filterType]: filters
      }
    }))
  }

  const selectedArticleFilterResults = selectedArticle ? testFilters(feedFilters, selectedArticle) : null
  // console.log(selectedArticleFilterResults)
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
            content={<Button color='red' onClick={e => removeFilter(filterType, filterWord)} content='Delete' />}
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
            content={<Button color='red' onClick={e => removeFilter(filterType, filterWord)} content='Delete' />}
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
      <FiltersTable filters={feedFilters} removeFilter={removeFilter} inProgress={editing} />
      <Divider />
      <SectionTitle heading='Add' subheading='Type a new filter and add it. Note that all filters are automatically lowercased.' />
      <AddFilter addFilter={addFilter} inProgress={editing} />
      <Divider />

      <SectionTitle heading='Classifications' subheading='See what current articles gets blocked or passes your current filters. Click on a row to see more in-depth details.' />
      <ArticleTable
        onClickArticle={article => setArticle(article)}
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

export default Filters
