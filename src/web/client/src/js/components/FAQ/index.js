import React, { useState, useEffect } from 'react'
import { Link, withRouter } from 'react-router-dom'
import PageHeader from '../utils/PageHeader'
import styled from 'styled-components'
import { Button, Input, Divider } from 'semantic-ui-react'
import colors from '../../constants/colors'
import pages from '../../constants/pages'
import SectionItemTitle from '../utils/SectionItemTitle'
import SectionSubtitle from '../utils/SectionSubtitle'
import { lighten, transparentize } from 'polished'
import { faq, searchFAQ } from '../../constants/faq'
import Section from '../Home/Section'
import posed, { PoseGroup } from 'react-pose'
import PropTypes from 'prop-types'
import textParser from '../ControlPanel/utils/textParser'
import querystring from 'query-string'
import modal from '../utils/modal'

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
  > div:last-child {
    width: 100%;
  }
`

const BlueSidebar = styled.div`
  display: ${props => props.show ? 'block' : 'none'};
  position: absolute;
  left: 0px;
  top: 0;
  width: 2px;
  margin-top: 7px;
  border-left-color: ${colors.discord.blurple};
  border-left-width: 3px;
  border-left-style: solid;
  height: 100%;
  z-index: 1000;
`

const SectionFAQ = styled.div`
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

const AnswerStyles = styled.div`
  position: relative;
  padding-left: 15px;
 > p {
   padding-top: 5px;
   
   font-size: 18px;
   > a {
    display: inline;
  }
 }
 overflow: hidden;
`

const Answer = posed(AnswerStyles)({
  expand: { height: 'auto', opacity: 1 },
  minimize: { height: 0, opacity: 0 }
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
  bottom: -30px;
  color: ${colors.discord.green};
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
  item.a = textParser.parseAllowLinks(item.a)
})

// const CopyIcon = styled(Icon)`
//   position: absolute;
//   left: -20px;
//   top: 5px;
// `

function FAQ (props) {
  const [ searchTerm, setSearch ] = useState('')
  const [ topOffsets, setTopOffsets ] = useState({})

  const paramQuestion = props.match.params.question
  const [ selectedQuestion, setQuestion ] = useState(allQuestions.includes(paramQuestion) ? faq.find(item => item.qe === paramQuestion) : null)
  const [ page, setPage ] = useState(selectedQuestion ? pageByQuestions[selectedQuestion.q] : 0)

  // Scroll to selected item when the ref and scrollbar are defined
  useEffect(() => {
    if (props.scrollbar && selectedQuestion && topOffsets[selectedQuestion.qe]) {
      props.scrollbar.scrollTop(topOffsets[selectedQuestion.qe])
    }
  }, [ props.scrollbar, selectedQuestion, topOffsets ])

  // Scroll after searching an item
  useEffect(() => {
    if (searchTerm === '' && props.scrollbar && selectedQuestion && topOffsets[selectedQuestion.qe]) {
      props.scrollbar.scrollTop(topOffsets[selectedQuestion.qe])
    }
  }, [ searchTerm, props.scrollbar, selectedQuestion, topOffsets ])

  useEffect(() => {
    const focused = querystring.parse(props.location.search).focus
    if (!focused || !selectedQuestion) return
    const modalProps = {
      header: <h2>{selectedQuestion.q}</h2>,
      footer: <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <SectionSubtitle>Keywords</SectionSubtitle>
          <TagContainer>{selectedQuestion.t.map((tag, i) => <Tag key={i}>{tag}</Tag>)}</TagContainer>
        </div>
        <Button content='Ok' onClick={e => modal.hide()} />
      </div>
    }
    const modalChildren = (
      <Answer pose='expand' style={{ paddingLeft: 0 }}>
        <p>{selectedQuestion.a}</p>
      </Answer>
    )
    modal.show(modalProps, modalChildren)
  }, [ props.history, props.location.search, selectedQuestion ])

  useEffect(() => {
    if (selectedQuestion) document.title = `Discord.RSS - FAQ - ${selectedQuestion.q}`
    else document.title = `Discord.RSS - FAQ`
  }, [selectedQuestion])

  const contentClone = searchFAQ(searchTerm)

  let addedTopOffset = false
  const items = contentClone.map((item, index) => {
    const selected = selectedQuestion && selectedQuestion.qe === item.qe
    return (
      <QAWrapper key={item.q} ref={elem => {
        if (!topOffsets[item.qe]) topOffsets[item.qe] = elem.offsetTop
      }}>
        <QAWrapperInner>
          {/* <CopyIcon name='copy' /> */}
          <div>
            <Link to={selected ? pages.FAQ : `${pages.FAQ}/${item.qe}`} onClick={e => setQuestion(selected ? null : item)}>
              <SectionItemTitle as='span' style={{ fontSize: '18px', lineHeight: '30px', fontWeight: selected ? 600 : 'normal', color: selected ? lighten(0.125, colors.discord.blurple) : colors.discord.text }}>{item.q}</SectionItemTitle>
            </Link>
            <Answer pose={selected ? 'expand' : 'minimize'} initialPose='minimize'>
              <BlueSidebar show={selected} />
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
    )
  })

  if (addedTopOffset) setTopOffsets(topOffsets)

  const displayPage = page + 1
  const lastItem = displayPage * itemsPerPage
  return (
    <div>
      <Header>
        <PageHeader heading='Frequently Asked Questions' style={{ textAlign: 'center' }} />
        <p style={{ textAlign: 'center' }}>A labyrinth of information, at your disposal.<br /><span style={{ color: colors.discord.yellow }}>This is an incomplete section. More content will be added.</span></p>
        <div style={{ width: '100%', display: 'flex', justifyContent: 'center', position: 'relative' }}>
          <Input icon='search' iconPosition='left' onKeyDown={e => {
            if (e.keyCode !== 13 || !searchTerm || contentClone.length === 0) return
            setQuestion(contentClone[0])
            setPage(pageByQuestions[contentClone[0].q])
            setSearch('')
            // props.history.push(`${pages.FAQ}/${contentClone[0].qe}`)
          }} onChange={e => {
            if (page !== 0) setPage(0)
            setSearch(e.target.value)
          }} value={searchTerm} />
          <FadeText pose={searchTerm && items.length > 0 ? 'enter' : 'exit'}>Click Enter to see the first article</FadeText>
        </div>
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

FAQ.propTypes = {
  scrollbar: PropTypes.object,
  history: PropTypes.object,
  location: PropTypes.object,
  match: PropTypes.object
}

export default withRouter(FAQ)
