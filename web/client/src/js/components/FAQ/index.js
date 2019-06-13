import React, { Component, useState, useEffect, useRef } from 'react'
import { Link, withRouter } from 'react-router-dom'
import SectionTitle from '../utils/SectionTitle'
import PageHeader from '../utils/PageHeader'
import styled from 'styled-components'
import { Button, Input, Divider, Breadcrumb } from 'semantic-ui-react'
import colors from '../../constants/colors'
import pages from '../../constants/pages'
import SectionItemTitle from '../utils/SectionItemTitle'
import SectionSubtitleDescription from '../utils/SectionSubtitleDescription'
import SectionSubtitle from '../utils/SectionSubtitle'
import { lighten, transparentize } from 'polished'
import { faq, invertedIndexes } from '../../constants/faq'
import Section from '../Home/Section'
import posed, { PoseGroup } from 'react-pose'
import PropTypes from 'prop-types'
import stemmer from 'stemmer'

const Header = styled.div`
  position: relative;
  background-color: #26262b;
  width: 100%;
  height: 350px;
  padding: 0 30px;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
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

const QAWrapper = posed.div({
  enter: { opacity: 1 },
  exit: { opacity: 0 }
})

const QAWrapperInner = styled.div`
  position: relative;
  display: flex;
  > div:first-child {
    display: ${props => props.show ? 'block' : 'none'};
    position: absolute;
    left: -15px;
    top: 0;
    width: 2px;
    border-left-color: ${colors.discord.blurple};
    border-left-width: 3px;
    border-left-style: solid;
    height: 100%;
  }
  > div:last-child {
    width: 100%;
  }
`

const SectionFAQStyles = styled.div`
  width: 100%;
  text-align: left;
  > div:first-child {
    > h2 {
      margin-bottom: 0;
    }
    display: flex;
    justify-content: space-between;
  }
  a {
    cursor: pointer;
    display: block;
    &:hover {
      text-decoration: none;
    }
  }
`

const SectionQuestionStyles = styled.div`
  width: 100%;
  text-align: left;
  > p {
    font-size: 18px;
  }
`

const SectionFAQ = posed(SectionFAQStyles)({
  enter: { y: 0, opacity: 1, transition: { duration: 100 } },
  exit: { y: 100, opacity: 0, transition: { duration: 100 } }
})

const SectionQuestion = posed(SectionQuestionStyles)({
  enter: { y: 0, opacity: 1, transition: { type: 'tween', delay: 75 } },
  exit: { y: -100, opacity: 0, transition: { type: 'tween' } }
})

const AnswerStyles = styled.div`
 > p {
   font-size: 18px;
   > a {
    display: inline;
  }
 }
 overflow: hidden;
`

const Answer = posed(AnswerStyles)({
  expand: { height: 'auto' },
  minimize: { height: 0 }
})

const TagContainer = styled.div`
  > span {
    margin-right: 3px;
    &:last-child {
      margin-right: 0;
    }
  }
`

const Tag = styled.span`
  display: inline-block;
  padding: 3px 5px;
  border-radius: 3px;
  color: ${transparentize(0.5, colors.discord.greyple)};
  border-style: solid;
  border-width: 1px;
  border-color: ${transparentize(0.5, colors.discord.greyple)};
  margin-right: 3px;
`

const FadeTextStyles = styled.p`
  position: absolute;
  bottom: 70px;
  @media only screen and (max-width: 400px) {
    bottom: 45px;
  }
`

const FadeText = posed(FadeTextStyles)({
  enter: { opacity: 1, transition: { duration: 150 } },
  exit: { opacity: 0, transition: { duration: 150 } },
})

const allTags = new Set()
for (const item of faq) {
  for (const tag of item.t) allTags.add(tag)
}
const allTagsOptions = []
for (const tag of allTags) {
  allTagsOptions.push({ key: tag, text: tag, value: tag })
}

const allQuestions = faq.map(item => item.qe)
const itemsPerPage = 10
const pageByQuestions = {}
faq.forEach((item, index) => {
  pageByQuestions[item.q] = Math.floor(index / itemsPerPage)
})

function FAQ (props) {
  const [ searchTerm, setSearch ] = useState('')
  const [ topOffsets, setTopOffsets ] = useState({})
  const [ page, setPage ] = useState(0)

  const paramQuestion = props.match.params.question
  const [ selectedQuestion, setQuestion ] = useState(allQuestions.includes(paramQuestion) ? faq.find(item => item.qe === paramQuestion) : null)

  // Scroll to selected item when the ref and scrollbar are defined
  useEffect(() => {
    if (props.scrollbar && selectedQuestion && topOffsets[selectedQuestion.qe]) {
      props.scrollbar.scrollTop(topOffsets[selectedQuestion.qe])
    }
  }, [!!props.scrollbar && !!selectedQuestion && !!topOffsets[selectedQuestion.qe]])

  // Scroll after searching an item
  useEffect(() => {
    if (searchTerm === '' && props.scrollbar && selectedQuestion && topOffsets[selectedQuestion.qe]) {
      props.scrollbar.scrollTop(topOffsets[selectedQuestion.qe])
    }
  }, [ searchTerm ])

  const searchTermSplit = new Set(searchTerm.split(' ').map(stemmer).filter(item => item))
  const searchTermSplitSize = searchTermSplit.size
  const intersectingDocumentIndexes = []
  const documentCounts = {}
  const documentPoints = {}
  for (const term of searchTermSplit) {
    if (!invertedIndexes[term]) continue
    for (const arr of invertedIndexes[term]) {
      const documentIndex = arr[0]
      const points = arr[1]
      if (!documentCounts[documentIndex]) {
        documentCounts[documentIndex] = 1
        documentPoints[documentIndex] = points
      } else {
        ++documentCounts[documentIndex]
        documentPoints[documentIndex] += points
      }
    }
  }

  for (const docIndex in documentCounts) {
    if (documentCounts[docIndex] === searchTermSplitSize) intersectingDocumentIndexes.push([ docIndex, documentPoints[docIndex] ])
  }
  const contentClone = searchTermSplitSize === 0 ? faq : intersectingDocumentIndexes.sort((a, b) => b[1] - a[1]).map((item, index) => faq[item[0]]) // 0th index is the document index, 1st index is the number of points (weight)
  // contentClone.sort((a, b) => b.p - a.p)

  let addedTopOffset = false
  const items = contentClone.map((item, index) => (
    <QAWrapper key={item.q} ref={elem => {
      if (!topOffsets[item.qe]) topOffsets[item.qe] = elem.offsetTop
    }}>
      <QAWrapperInner show={selectedQuestion && selectedQuestion.qe === item.qe}>
        <div />
        <div>
          <Link to={pages.FAQ + `/${item.qe}`} onClick={e => setQuestion(selectedQuestion && selectedQuestion.qe === item.qe ? null : item)}>
            <SectionItemTitle as='span' style={{ fontSize: '18px', lineHeight: '30px' }}>{item.q}</SectionItemTitle>
          </Link>
          <Answer pose={selectedQuestion && selectedQuestion.qe === item.qe ? 'expand' : 'minimize'} initialPose='minimize'>
            <p>{item.a}</p>
            <SectionSubtitle>Keywords</SectionSubtitle>
            <TagContainer>
              {selectedQuestion ? selectedQuestion.t.map((tag, i) => <Tag key={i}>{tag}</Tag>) : []}
            </TagContainer>
          </Answer>
        </div>

      </QAWrapperInner>
      <Divider />
    </QAWrapper>
  ))

  if (addedTopOffset) setTopOffsets(topOffsets)

  const displayPage = page + 1
  const lastItem = displayPage * itemsPerPage
  return (
    <div>
      <Header>
        <PageHeader heading='Frequently Asked Questions' style={{ textAlign: 'center' }} />
        <p style={{ textAlign: 'center' }}>A labyrinth of information, at your disposal.<br /><span style={{ color: colors.discord.yellow }}>This is an incomplete section. More content will be added.</span></p>
        <Input icon='search' iconPosition='left' onKeyDown={e => {
          if (e.keyCode !== 13 || !searchTerm || contentClone.length === 0) return
          setQuestion(contentClone[0])
          setPage(pageByQuestions[contentClone[0].q])
          console.log('page is ', pageByQuestions)
          setSearch('')
          props.history.push(`${pages.FAQ}/${contentClone[0].qe}`)
        }} onChange={e => {
          setSearch(e.target.value)
        }} value={searchTerm} />
        <FadeText pose={searchTerm && items.length > 0 ? 'enter' : 'exit'} style={{ paddingTop: '1em', color: colors.discord.green }}>Click Enter to see the first article</FadeText>
        {/* <Dropdown multiple search selection options={allTagsOptions} /> */}
      </Header>
      <Section>
        <SectionFAQ pose='enter' key='faq'>
          <div>
            <h2>{ searchTerm ? 'Search Results' : 'Top Questions' }</h2>
            <Button.Group>
              <Button size='large' icon='caret left' disabled={page === 0} onClick={e => page <= 0 ? null : setPage(page - 1)} />
              <Button.Or text={displayPage} />
              <Button size='large' icon='caret right' disabled={lastItem >= items.length} onClick={e => lastItem >= items.length ? null : setPage(displayPage)} />
            </Button.Group>
          </div>
          <br />
          <PoseGroup flipMove>
            {items.slice(lastItem - itemsPerPage, lastItem)}
          </PoseGroup>
        </SectionFAQ>
        <span>Page {displayPage}/{1 + Math.floor(items.length / itemsPerPage)}</span>
      </Section>
    </div>
  )
}

export default withRouter(FAQ)
