import React from 'react'
import { connect } from 'react-redux'
import PropTypes from 'prop-types'
import PaginatedTable from './PaginatedTable'
import articleId from './articleId'
import { Dropdown, Loader } from 'semantic-ui-react'
import styled from 'styled-components'
import colors from 'js/constants/colors'
import SectionSubtitleDescription from 'js/components/utils/SectionSubtitleDescription';

const mapStateToProps = state => {
  return {
    feedId: state.feedId,
    articleList: state.articleList,
    articlesFetching: state.articlesFetching,
    articlesError: state.articlesError
  }
}

const StyledRow = styled(PaginatedTable.Row)`
  cursor: ${props => !props.clickable ? '' : 'pointer'};
  &:hover {
    cursor: ${props => !props.clickable ? '' : props.selected ? '' : 'pointer'};
  }
`

const LoadingBox = styled.div`
  position: relative;
  background-color: rgba(32,34,37,0.6);
  border-radius: 3px;
  padding: 3em;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 115px;
  ${props => props.error ? `color: ${colors.discord.red} !important;` : ''}
  text-align: center;
`

const ErrorText = styled.div`
  word-break: break-all;
  text-align: center;
`

class ArticleBrowser extends React.PureComponent {
  constructor () {
    super()
    this.state = {
      classificationsArticleProperty: '', 
      selectedArticleId: ''
    }
  }

  componentWillMount () {
    this.autosetClassificationArticleProperty()
  }

  changeClassificationsArticleProperty = value => {
    this.setState({ classificationsArticleProperty: value })
  }

  componentDidUpdate (prevProps) {
    if (prevProps.feedId !== this.props.feedId || (this.props.articleList.length > 0 && !this.state.classificationsArticleProperty)) this.autosetClassificationArticleProperty()
  }

  autosetClassificationArticleProperty = () => {
    const article = this.props.articleList[0]
    if (!article) return
    if (article.title && this.props.articleList[1] && this.props.articleList[1].title !== article.title) return this.setState({ classificationsArticleProperty: 'title' })
    for (const placeholder in article) {
      if (!placeholder) continue
      if (this.props.articleList[1]) {
        if (this.props.articleList[1][placeholder] !== article[placeholder]) return this.setState({ classificationsArticleProperty: placeholder }) // Try to select a placeholder where its content is different from other articles
      } else return this.setState({ classificationsArticleProperty: placeholder })        
    }

    this.setState({ classificationsArticleProperty: Object.keys(article)[0] }) // If the above fails, just use the duplicated property
  }

  onClickArticle = (article, id) => {
    const { onClickArticle } = this.props
    if (!onClickArticle) return
    onClickArticle(article)
    this.setState({ selectedArticleId: id })
  }

  render () {
    const { articleList, addColumns, positiveNegativeRowFunc, articlesFetching, articlesError } = this.props
    if (articlesError) {
      return (
        <LoadingBox>
          <ErrorText>
            <SectionSubtitleDescription style={{ color: colors.discord.red }}>Failed to Load Articles</SectionSubtitleDescription>
            <SectionSubtitleDescription>{articlesError || 'Unknwon Error'}</SectionSubtitleDescription>
          </ErrorText>
        </LoadingBox>
      )
    }

    if (articlesFetching) {
      return (
        <LoadingBox>
          <Loader inverted size='big' active />
        </LoadingBox>
      )
    }

    let addedHeaders = []
    let addedCellFuncs = []
    let collapsingCells = []
    if (addColumns) {
      for (const data of addColumns) {
        if (!data.headers) throw new Error('Missing added column headers')
        if (!data.cellFuncs) throw new Error('Missing added cell functions')
        addedHeaders = addedHeaders.concat(data.headers)
        addedCellFuncs = addedCellFuncs.concat(data.cellFuncs)
        collapsingCells = collapsingCells.concat(data.collapsing)
      }
    }
    const classificationsItems = articleList
    const classificationsDropdownOptions = []
    let added = {}
    for (const article of articleList) {
      for (const placeholder in article) {
        if (added[placeholder]) continue
        const isRegexPlaceholder = placeholder.includes('regex:')
        const prettyPlaceholderName = placeholder.replace('regex:', '')
        if (placeholder !== 'fullTitle' && placeholder !== 'fullDescription' && placeholder !== 'fullSummary') {
          classificationsDropdownOptions.push({ text: isRegexPlaceholder ? `${prettyPlaceholderName} (regex)` : prettyPlaceholderName, value: placeholder })
          added[placeholder] = true
        }
      }
    }

    const classificationsTableRowFunc = data => {
      const positive = positiveNegativeRowFunc ? positiveNegativeRowFunc(data) : null
      const id = articleId(articleList, data)
      return (
      <StyledRow
        clickable={(!!this.props.onClickArticle).toString()}
        onClick={e => this.onClickArticle(data, id)}
        active={this.state.selectedArticleId === id}
        key={id}
        positive={positive === true ? true : false}
        negative={positive === false ? true : false}
      >
        { addedCellFuncs.map((func, i) => <PaginatedTable.Cell collapsing={collapsingCells[i]} key={`cfun${i}`}>{func(data)}</PaginatedTable.Cell>) }
        <PaginatedTable.Cell>{data[this.state.classificationsArticleProperty]}</PaginatedTable.Cell>
      </StyledRow>
      )
    }

    const classificationsTableSearchFunc = (data, search) => data[this.state.classificationsArticleProperty] ? data[this.state.classificationsArticleProperty].toLowerCase().includes(search) : true

    return (
      <PaginatedTable.Table
        compact
        unstackable
        maxPerPage={10}
        items={classificationsItems}
        allowActiveRows
        headers={addedHeaders.concat([this.state.classificationsArticleProperty.replace('regex:', '')])}
        itemFunc={classificationsTableRowFunc}
        searchFunc={classificationsTableSearchFunc}
        button={<Dropdown selection options={classificationsDropdownOptions} onChange={(e, data) => this.changeClassificationsArticleProperty(data.value)} value={this.state.classificationsArticleProperty}  />}
      />
    )
  }
}

ArticleBrowser.propTypes = {
  setToThisPage: PropTypes.func,
  addColumns: PropTypes.array
}

export default connect(mapStateToProps)(ArticleBrowser)
