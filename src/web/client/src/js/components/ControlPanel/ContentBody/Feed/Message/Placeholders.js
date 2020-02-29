import React, { useState, useEffect } from 'react'
import { Divider, Loader, Dropdown, ButtonGroup, Button, Input } from 'semantic-ui-react'
import styled from 'styled-components'
import colors from 'js/constants/colors'
import PropTypes from 'prop-types'
import Wrapper from 'js/components/utils/Wrapper'
import { useSelector } from 'react-redux'
import parser from '../../../utils/textParser'
import modal from 'js/components/utils/modal'
import SectionSubtitleDescription from 'js/components/utils/SectionSubtitleDescription'
import posed from 'react-pose'
import SectionSubtitle from 'js/components/utils/SectionSubtitle'
import { Scrollbars } from 'react-custom-scrollbars'
import { isHiddenProperty } from 'js/constants/hiddenArticleProperties'
import feedSelectors from 'js/selectors/feeds'

// const PlaceholdersContainer = styled.div`
//   scrollbar-width: thin;
//   color: ${colors.discord.text};
//   height: 350px;
//   min-height: 350px;
//   resize: vertical;
//   overflow: auto;
//   background-color: rgba(32, 34, 37, 0.6);
//   border-color: #202225;
//   border-style: solid;
//   border-width: 1px;
//   border-radius: 5px;
//   padding-top: 1em;
//   padding-bottom: 1em;
//   padding-left: 1em;
//   padding-right: 1em;
//   width: 100%;
//   p {
//     word-break: break-word;
//   }
// `

const ArticleBox = styled.div`
  margin-bottom: 1.5em;
  > .ui.dropdown:first-child {
    margin-bottom: 1em;
  }
  > div > .ui.dropdown {
    margin-bottom: 0;
    margin-right: 1em;
  }
`

const PlaceholdersContainerStyles = styled(Wrapper)`
  margin-top: 1em;
  scrollbar-width: thin;
  color: ${colors.discord.text};
  resize: vertical;
  background: #18191c;
  /* overflow: auto; */
  /* background-color: rgba(32, 34, 37, 0.6); */
  padding: 0;
  border-color: #202225;
  border-style: solid;
  border-width: 1px;
  border-radius: 5px;
  width: 100%;
  p {
    word-break: break-word;
  }
`

const PlaceholdersContainerInner = styled.div`
  padding-top: 1em;
  padding-bottom: 1em;
  padding-left: 1em;
  padding-right: 1em;
  height: 100%;
  ${props => props.small
    ? `display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;`
    : ''}
`

const PlaceholdersContainer = posed(PlaceholdersContainerStyles)({
  small: { minHeight: 150, height: 150 },
  big: { minHeight: 350, height: 350 }
})

const PlaceholderImage = styled.div`
  > div {
    img {
      cursor: pointer;
      display: block;
      width: 100%;
      height: auto;
      margin-top: 1em;
      max-width: 450px;
    }
    @media only screen and (min-width: 450px) {
      display: flex;
      justify-content: space-between;
      img {
        margin-top: 0;
        padding-left: 1em;
      }
    }
  }
`

const PlaceholderNameContainer = styled.div`
  display: flex;
  margin-bottom: 0.5em;
  > p {
    margin-right: 1em;
    font-family: monospace;
    font-weight: bold;
    margin-bottom: 0;
  }
`

const RegexTag = styled.span`
  display: inline-block;
  background-color: ${colors.discord.greyple};
  padding: 1px 2px;
  border-radius: 4px;
  text-transform: uppercase;
  font-size: 0.7em;
  color: black;
`

const DropdownWithButtons = styled.div`
  display: flex;
`
function Placeholders (props) {
  const { updateArticleID } = props
  const [articleID, setArticleID] = useState(0)
  const [showArticleBy, setShowArticleBy] = useState()
  const [searchPlaceholder, setSearchPlaceholder] = useState('')
  const [seenPlaceholders, setSeenPlaceholders] = useState(new Set())
  const articleList = useSelector(state => state.articles)
  const articlesError = useSelector(feedSelectors.articlesFetchErrored)
  const articlesFetching = useSelector(feedSelectors.articlesFetching)
  const placeholderElements = []
  const article = articleList[articleID]

  const onClickNextArticle = () => {
    if (articleID === articleList.length - 1) {
      return
    }
    setArticleID(articleID + 1)
  }

  const onClickPreviousArticle = () => {
    if (articleID === 0) {
      return
    }
    setArticleID(articleID - 1)
  }

  useEffect(() => {
    updateArticleID(articleID)
  }, [articleID, updateArticleID])

  useEffect(() => {
    const seen = new Set()
    for (const article of articleList) {
      for (const placeholder in article) {
        if (placeholder.startsWith('regex:') || isHiddenProperty(placeholder) || placeholder.startsWith('raw:')) {
          continue
        }
        if (article[placeholder]) {
          seen.add(placeholder)
        }
      }
    }
    setSeenPlaceholders(seen)
  }, [articleList])

  useEffect(() => {
    if (showArticleBy || seenPlaceholders.size === 0) {
      return
    }
    if (seenPlaceholders.has('title')) {
      setShowArticleBy('title')
    } else {
      setShowArticleBy(Array.from(seenPlaceholders.keys())[0])
    }
  }, [showArticleBy, seenPlaceholders])

  const showArticleByOptions = Array.from(seenPlaceholders.keys()).map(placeholder => ({
    text: placeholder,
    value: placeholder
  }))

  // Articles
  const articleDropdownOptions = articleList.map((placeholders, index) => ({
    text: placeholders[showArticleBy],
    value: index
  }))

  // List of placeholders
  if (article) {
    for (const placeholderName in article) {
      const content = article[placeholderName]
      if (!content || placeholderName.startsWith('raw:') || placeholderName.startsWith('_')) continue
      const phname = placeholderName.replace('regex:', '') // The {regex: in the beginning is for internal reference only
      if ((searchPlaceholder && !phname.includes(searchPlaceholder)) || phname.startsWith('_')) continue
      placeholderElements.push(
        <PlaceholderImage key={`${placeholderName}`}>
          <div>
            <div>
              <PlaceholderNameContainer>
                <p className='preview-placeholder-name'>{`{${phname}}`}</p>
                { placeholderName.startsWith('regex') ? <RegexTag>Regex</RegexTag> : null }
              </PlaceholderNameContainer>
              {/* { phname === 'link' || phname.includes('image') || phname.includes('anchor')
                ? <a href={content} target='_blank' rel='noopener noreferrer'><p>{content}</p></a>
                :  */}
              <p>{parser.parse(content)}</p>
              {/* } */}
            </div>
            { phname.includes('image') ? <div><img onClick={e => modal.showImage(content, phname)} alt={phname} src={content} /></div> : null }
          </div>
          <Divider />
        </PlaceholderImage>
      )
    }
  }

  const disabledDropdown = !!(articlesFetching || !!articlesError)
  const smallPlaceholderContainer = articlesFetching || articlesError || (!articlesFetching && placeholderElements.length === 0)
  return (
    <div>
      <SectionSubtitle>Article Selection</SectionSubtitle>
      <ArticleBox>
        <Dropdown selection fluid options={showArticleByOptions} value={showArticleBy} onChange={(e, data) => setShowArticleBy(data.value)} disabled={disabledDropdown} loading={articlesFetching} placeholder={articleDropdownOptions.length === 0 && !articlesFetching ? 'No articles in feed' : 'Show article by...'} />
        <DropdownWithButtons>
          <Dropdown search selection fluid options={articleDropdownOptions} value={articleID} onChange={(e, data) => setArticleID(data.value)} disabled={disabledDropdown} loading={articlesFetching} placeholder={articleDropdownOptions.length === 0 && !articlesFetching ? 'No articles in feed' : 'Select an article'} />
          <ButtonGroup>
            <Button icon='arrow up' onClick={onClickPreviousArticle} disabled={articleID === 0 || articleList.length === 0} />
            <Button icon='arrow down' onClick={onClickNextArticle} disabled={articleID === articleList.length - 1 || articleList.length === 0} />
          </ButtonGroup>
        </DropdownWithButtons>
      </ArticleBox>
      <SectionSubtitle>Placeholders</SectionSubtitle>
      <Input fluid icon='search' iconPosition='left' placeholder='Placeholder name' onChange={e => setSearchPlaceholder(e.target.value)} value={searchPlaceholder} />
      <PlaceholdersContainer pose={smallPlaceholderContainer ? 'small' : 'big'}>
        <Scrollbars>
          <PlaceholdersContainerInner small={smallPlaceholderContainer}>
            {articlesFetching
              ? <Loader inverted size='big' active />
              : articlesError
                ? <div>
                  <SectionSubtitleDescription style={{ color: colors.discord.red }}>Failed to Load Articles</SectionSubtitleDescription>
                  <SectionSubtitleDescription>{articlesError || 'Unknown Error'}</SectionSubtitleDescription>
                </div>
                : placeholderElements.length === 0
                  ? <SectionSubtitleDescription>No articles in feed</SectionSubtitleDescription>
                  : placeholderElements}
          </PlaceholdersContainerInner>
        </Scrollbars>
      </PlaceholdersContainer>

    </div>
  )
}

Placeholders.propTypes = {
  updateArticleID: PropTypes.func
}

export default Placeholders
