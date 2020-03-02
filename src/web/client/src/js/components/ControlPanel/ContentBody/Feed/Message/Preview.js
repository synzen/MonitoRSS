import React from 'react'
import { useSelector } from 'react-redux'
import PropTypes from 'prop-types'
import colors from 'js/constants/colors'
import styled from 'styled-components'
import embedProperties from 'js/constants/embed'
import parser from '../../../utils/textParser'
import BoundedImage from 'js/components/utils/BoundedImage'
import testFilters from '../Filters/util/filters'
import { isHiddenProperty } from 'js/constants/hiddenArticleProperties'
import feedSelectors from 'js/selectors/feeds'

function numberToColour (number) {
  const r = (number & 0xff0000) >> 16
  const g = (number & 0x00ff00) >> 8
  const b = (number & 0x0000ff)
  return `rgb(${r},${g},${b})`
}

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  /* flex-direction: row; */
  background: #36393f;
  border-radius: 4px;
  border-style: solid;
  border-width: 1px;
  border-color: ${colors.discord.darkButNotBlack};
  padding: 20px 0;
  font-size: 16px;
`
const Username = styled.span`
  font-weight: 600;
  letter-spacing: 0;
`

const UserInfo = styled.div`
  display: flex;
  flex-direction: row;
  height: 22px;
  > div {
    height: 40px;
    width: 40px;
    border-radius: 50%;
    margin-top: -2px;
    /* margin-left: 20px; */
    margin-right: 20px;
    margin-bottom: 20px;
    margin-left: 20px;
    background-image: ${props => `url('${props.avatar}')`};
    background-size: 100%;
  }
  > h2 {
    color: white;
    font-size: 16px;
    margin: 0;
    white-space: nowrap;
    line-height: 16px;
    > span:first-child {
      line-height: 22px;
    }
  }
`

const Content = styled.div`
  margin-top: 0.5em;
  margin-left: 80px;
  margin-right: 10px;
  color: #dcddde;
  word-break: break-word;
  overflow-x: auto;
  font-size: 16px;
`

const EmbedContainer = styled.div`
  display: grid;
  grid-auto-flow: row;
  grid-row-gap: .25em;
  text-indent: 0;
  min-height: 0;
  min-width: 0;
  padding-top: .125em;
  padding-bottom: .125em;
`

const EmbedWrapper = styled.div`
  border-left: 4px solid ${props => props.pillColor != null ? numberToColour(props.pillColor) : '#4f545c'};
  border-radius: 4px;
  /* max-width: ${props => props.hasThumbnail ? '432px' : '520px'}; */
  max-width: 432px;
  display: grid;
  position: relative;
  box-sizing: border-box;
  white-space: break-spaces;
  word-wrap: break-word;
  user-select: text;
  font-weight: 400;
  color: white;
  background: rgb(47, 49, 54);
`

const EmbedGrid = styled.div`
  grid-template-columns: ${props => props.hasThumbnail ? 'auto min-content' : 'auto'};
  grid-template-rows: auto;
  display: inline-grid;
  padding: .5rem 1rem 1rem .75em;
`

const Author = styled.div`
  min-width: 0;
  display: flex;
  box-align: center;
  align-items: center;
  grid-column: 1/1;
  margin-top: 8px;
  > img {
    text-indent: -9999px;
    margin-right: 8px;
    width: 24px;
    height: 24px;
    object-fit: contain;
    border-radius: 50%;
  }
  > span, a {
    font-size: 0.875em;
    font-weight: 500;
    color: white;
  }
`

const Title = styled.a`
  min-width: 0;
  color: white;
  font-size: 1em;
  font-weight: 600;
  display: inline-block;
  grid-column: 1/1;
  margin-top: 8px;
`

const Description = styled.div`
  font-size: .875em;
  line-height: 1.125em;
  font-weight: 400;
  white-space: pre-line;
  grid-column: 1/1;
  margin-top: 8px;
  color: ${colors.discord.text};
`

const Image = styled.a`
  grid-column: ${props => props.hasThumbnail ? '1/3' : '1/1'};
  margin-top: 16px;
  border-radius: 4px;
  contain: paint;
  cursor: pointer;
  width: 100%;
  height: auto;
  max-width: 400px;
  max-height: 300px;
  > img {
    border-radius: 4px;
    /* position: absolute; */
    text-indent: -9999px;
  }
`

const Thumbnail = styled.a`
  max-width: 80px;
  max-height: 80px;
  grid-row: 1/8;
  grid-column: 2/2;
  margin-left: 16px;
  margin-top: 8px;
  flex-shrink: 0;
  justify-self: end;
  display: block;
  user-select: text;
  cursor: pointer;
  overflow: hidden;
  border-radius: 3px;
  > img {
    border-radius: 4px;
    text-indent: -9999px;
  }
`

const Footer = styled.div`
  min-width: 0;
  display: flex;
  align-items: center;
  grid-row: auto/auto;
  grid-column: ${props => props.hasThumbnail ? '1/3' : '1/1'};
  margin-top: 8px;
  > img {
    text-indent: -9999px;
    margin-right: 8px;
    width: 20px;
    height: 20px;
    object-fit: contain;
    border-radius: 50%;
  }
  > span {
    font-size: 0.75em;
    line-height: 1em;
    font-weight: 400;
    color: ${colors.discord.subtext}
  }
`

const BotTag = styled.span`
  background-color: rgb(114,117,217);
  border-radius: 3px;
  margin-left: 4.8px;
  margin-top: 0.75px;
  padding: 1.152px 4.4px;
  text-transform: uppercase;
  font-size: 10px;
  font-weight: 500;
  line-height: 1.3;
`

const TimeTag = styled.span`
  color: hsla(0,0%,100%,0.2);
  font-size: 12px;
  font-weight: 400;
  margin-left: 0.3em;
`

const EmbedFields = styled.div`
  margin-top: 8px;
  /* display: flex; */
  /* flex-direction: row; */
  /* flex-wrap: wrap; */
  grid-column: 1/1;
  display: grid;
  grid-gap: 8px;
  /* line-height: 18px; */
`

const EmbedField = styled.div`
  font-size: 0.875em;
  line-height: 1.125em;
  min-width: 0;
  grid-column: ${props => props.gridColumns};
`

const EmbedFieldTitle = styled.div`
  color: ${colors.discord.subtext};
  font-weight: 500;
  margin-bottom: 2px;
  font-size: 0.875em;
  line-height: 1.125em;
  min-width: 0;
`

const EmbedFieldValue = styled.div`
  line-height: 1.125em;
  color: ${colors.discord.text};
  font-weight: 400;
  white-space: pre-line;
  font-size: 0.875em;
  min-width: 0;
`

function Preview (props) {
  const feed = useSelector(feedSelectors.activeFeed)
  const bot = useSelector(state => state.botUser)
  const subscribers = useSelector(state => state.subscribers)
  const articleList = useSelector(state => state.articles)
  const botConfig = useSelector(state => state.botConfig)
  const { embeds, message, articleID } = props
  const article = articleList[articleID]

  const convertKeywords = (word) => {
    if (word.length === 0) {
      return word
    }
    let content = word
    for (const placeholderName in article) {
      if (isHiddenProperty(placeholderName)) continue
      if (placeholderName === 'subscriptions') continue
      const sanitizedPlaceholderName = `{${placeholderName.replace('regex:', '')}}`
      // console.log('replacing', sanitizedPlaceholderName, 'with', article[placeholderName])
      content = content.replace(sanitizedPlaceholderName, article[placeholderName])
    }
    // Do not replace it with article.subscriptions since it may be outdated after updating subscriptions from the subscriptions page. It will not be updated until another article fetch has occurred.
    if (content.includes('{subscriptions}')) {
      const feedSubscribers = []
      const thisSubscribers = subscribers.filter(s => s.feed === feed._id)
      for (const subscriber of thisSubscribers) {
        const id = subscriber.id
        const hasFilters = Object.keys(subscriber.filters).length > 0
        if (!hasFilters) {
          feedSubscribers.push(`<@${id}> `)
        } else if (article && testFilters(subscriber.filters, article).passed) {
          feedSubscribers.push(`<@${id}>`)
        }
      }
      content = content.replace('{subscriptions}', feedSubscribers.length > 0 ? feedSubscribers.join(' ') : '')
    }
    return content
  }

  const embedElements = []
  let hasEmbeds = false

  for (let i = 0; i < embeds.length; ++i) {
    const properties = embeds[i]
    const parsedProperties = {}
    let populatedEmbed = false
    for (const propertyName in embedProperties) {
      const propName = embedProperties[propertyName]
      if (properties[propName] === undefined) continue
      parsedProperties[propName] = article && propName !== 'color' ? convertKeywords(properties[propName]) : properties[propName] // color is a number
      populatedEmbed = populatedEmbed || !!properties[propName]
    }
    const fields = properties.fields
    const fieldElements = []
    if (fields) {
      const validFields = fields.filter(field => field.name && field.value)
      const lookedAt = new Set()
      const gridColumnValues = []
      for (let i = 0; i < validFields.length; ++i) {
        const field = validFields[i]
        if (!populatedEmbed) {
          populatedEmbed = true
        }
        const nextFieldInline = validFields[i + 1] && validFields[i + 1].inline
        const nextNextFieldInline = validFields[i + 2] && validFields[i + 2].inline
        if (!lookedAt.has(i)) {
          if (field.inline && nextFieldInline) {
            lookedAt.add(i).add(i + 1)
            if (nextNextFieldInline) {
              lookedAt.add(i + 2)
              gridColumnValues.push('1/5', '5/9', '9/13')
            } else {
              gridColumnValues.push('1/7', '7/13')
            }
          } else {
            lookedAt.add(i)
            gridColumnValues.push('1/13')
          }
        }
        fieldElements.push(
          <EmbedField key={`field${i}`} gridColumns={gridColumnValues[i]}>
            <EmbedFieldTitle>{parser.parseEmbedTitle(convertKeywords(field.name))}</EmbedFieldTitle>
            <EmbedFieldValue>{parser.parseAllowLinks(convertKeywords(field.value))}</EmbedFieldValue>
          </EmbedField>
        )
      }
    }
    if (populatedEmbed) {
      const hasThumbnail = !!properties[embedProperties.thumbnailURL]
      if (!hasEmbeds) {
        hasEmbeds = true
      }
      embedElements.push(
        <EmbedContainer key={`embed_preview${i}`}>
          <EmbedWrapper pillColor={properties[embedProperties.color]} hasThumbnail={hasThumbnail}>
            <EmbedGrid hasThumbnail={hasThumbnail}>
              { properties[embedProperties.authorName]
                ? <Author>
                  { properties[embedProperties.authorIconUrl] || properties[embedProperties.authorIconURL] ? <img alt='Embed Author Icon' src={parsedProperties[embedProperties.authorIconURL]} /> : null }
                  { parsedProperties[embedProperties.authorUrl] || parsedProperties[embedProperties.authorURL] ? <a target='_blank' rel='noopener noreferrer' href={parsedProperties[embedProperties.authorURL]}>{parsedProperties[embedProperties.authorName]}</a> : <span>{parsedProperties[embedProperties.authorName]}</span> }
                </Author>
                : undefined }

              {parsedProperties[embedProperties.title]
                ? <Title as={properties[embedProperties.url] ? 'a' : 'div'} href={parsedProperties[embedProperties.url]} target='_blank' >
                  {parser.parseEmbedTitle(parsedProperties[embedProperties.title])}
                </Title>
                : null
              }

              {parsedProperties[embedProperties.description]
                ? <Description>{parser.parseAllowLinks(parsedProperties[embedProperties.description])}</Description>
                : null
              }

              { fieldElements.length > 0
                ? <EmbedFields>{fieldElements}</EmbedFields>
                : [] }

              { properties[embedProperties.imageURL]
                ? <Image href={parsedProperties[embedProperties.imageURL]} target='_blank' hasThumbnail={hasThumbnail} >
                  <BoundedImage width={400} height={300} src={parsedProperties[embedProperties.imageURL]} alt='Embed MainImage' />
                </Image>
                : undefined }

              { properties[embedProperties.thumbnailURL]
                ? <Thumbnail href={parsedProperties[embedProperties.thumbnailURL]} target='_blank'>
                  <BoundedImage width={80} height={80} src={parsedProperties[embedProperties.thumbnailURL]} alt='Embed Thumbnail' />
                </Thumbnail>
                : undefined }

              { properties[embedProperties.footerText] || (parsedProperties[embedProperties.timestamp] && parsedProperties[embedProperties.timestamp] !== 'none')
                ? <Footer hasThumbnail={hasThumbnail}>
                  { parsedProperties[embedProperties.footerIconURL] ? <img src={parsedProperties[embedProperties.footerIconURL]} alt='Embed Footer Icon' /> : null }
                  <span>{properties[embedProperties.footerText] || properties[embedProperties.footerText]}{(parsedProperties[embedProperties.timestamp] && parsedProperties[embedProperties.timestamp] !== 'none') ? `${parsedProperties[embedProperties.footerText] ? ' • ' : ''}[${parsedProperties[embedProperties.timestamp] === 'article' ? 'ARTICLE TIMESTAMP' : 'NOW TIMESTAMP'}]` : '' }</span>
                </Footer>
                : undefined }
            </EmbedGrid>
          </EmbedWrapper>
        </EmbedContainer>
      )
    }
  }

  return (
    <Wrapper>
      <UserInfo avatar={bot ? bot.displayAvatarURL : ''} >
        <div />
        <h2>
          <Username>{bot ? bot.username : 'Unknown'}</Username>
          <BotTag>BOT</BotTag>
          <TimeTag>Today at 12:00 AM</TimeTag>
        </h2>
      </UserInfo>
      <Content>
        { (message || botConfig.defaultText) === '{empty}' && hasEmbeds
          ? ''
          : article
            ? parser.parse(convertKeywords(message || botConfig.defaultText || '').trim(), true, {}, parser.jumboify)
            : parser.parse((message || botConfig.defaultText || '').trim(), true, {}, parser.jumboify)
        }
        {embedElements}
      </Content>
    </Wrapper>
  )
}

Preview.propTypes = {
  embeds: PropTypes.array,
  message: PropTypes.string,
  articleID: PropTypes.number
}

export default Preview
