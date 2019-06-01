import React, { Component } from 'react'
import { withRouter } from 'react-router-dom'
import { connect } from 'react-redux'
import { changePage } from 'js/actions/index-actions'
import styled from 'styled-components'
import pages from 'js/constants/pages'
import colors from 'js/constants/colors'
import embedProperties from 'js/constants/embed'
import PropTypes from 'prop-types'
import parser from '../../../utils/textParser'
import testFilters from '../Filters/util/filters'

const mapStateToProps = state => {
  return {
    defaultConfig: state.defaultConfig,
    articleList: state.articleList,
    guildId: state.guildId,
    feedId: state.feedId,
    subscribers: state.subscribers,
    bot: state.bot
  }
}

const mapDispatchToProps = dispatch => {
  return {
    setToThisPage: () => dispatch(changePage(pages.MESSAGE))
  }
}

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
  padding-top: 5px;
  padding-bottom: 28px;
`
const Username = styled.span`
  font-weight: 500;
  letter-spacing: 0;
`

const UserInfo = styled.div`
  display: flex;
  flex-direction: row;
  height: 21px;
  margin-bottom: 3px;
  > div {
    height: 40px;
    width: 40px;
    border-radius: 50%;
    margin-top: -2px;
    /* margin-left: 20px; */
    margin-right: 20px;
    margin-bottom: 20px;
    background-image: ${props => `url('${props.avatar}')`};
    background-size: 100%;
  }
  > h2 {
    color: white;
    font-size: 1.1rem;
    margin: 0;
  }
`

const Content = styled.div`
  margin-top: 0.5em;
  margin-left: 60px;
  margin-right: 10px;
  color: #dcddde;
  word-break: break-word;
  overflow-x: auto;
`

const Embed = styled.div`
  display: flex;
  flex-direction: row;
  /* max-width: 426px; */
  margin-top: 8px;
  margin-bottom: 5px;
`
// ${props => props.appeaseImage ? '426px' : '520px'};
const Pill = styled.div`
  display: block;
  border-top-left-radius: 3px;
  border-bottom-left-radius: 3px;
  width: 4px;
  background-color: ${props => props.color ? numberToColour(props.color) : '#4f545c'};
`
const NonPill = styled.div`
  padding-left: 10px;
  padding-right: 10px;
  padding-top: 8px;
  padding-bottom: 8px;
  background-color: rgba(46,48,54,.3);
  border-bottom-right-radius: 3px;
  border-top-right-radius: 3px;
`

const BodyWrapper = styled.div`
  display: flex;
  flex-direction: row;
  max-width: ${props => props.appeaseImage ? '400px' : '516px'};
  transition: max-width 0.5s;
`

const Author = styled.div`
  display: flex;
  align-items: center;
  color: white;
  margin-bottom: 4px;
  word-break: break-all;
  img {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    margin-right: 8px;
  }
  a {
    color: white;
    &:hover {
      color: white;
    }
  }
`

const Title = styled.a`
  font-weight: 500;
  word-break: break-all;
`

const Description = styled.div`
  margin-top: 4px;
  color: hsla(0,0%,100%,.6);
`

const Image = styled.a`
  display: block;
  margin-top: 8px;
  img {
    max-width: 400px;
  }
`

const Thumbnail = styled.a`
  display: block;
  margin-left: 16px;
  img {
    max-width: 80px;
  }
`

const Footer = styled.div`
  display: flex;
  margin-top: 8px;
  font-size: 0.75rem;
  align-items: center;
  color: ${colors.discord.text};
  font-weight: 500;
  word-break: break-all;
  img {
    width: 20px;
    height: 20px;
    margin-right: 8px;
    border-radius: 50%;

  }
`

const BotTag = styled.span`
  background-color: rgb(114,117,217);
  border-radius: 3px;
  margin-left: 4.8px;
  padding: 1px 2px;
  text-transform: uppercase;
  font-size: 0.7em;
  font-weight: 500;
  line-height: 1.3;
`

const TimeTag = styled.span`
  color: hsla(0,0%,100%,0.2);
  font-size: 0.8rem;
  font-weight: 400;
  margin-left: 0.3rem;
`

const EmbedFields = styled.div`
  margin-top: 4px;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
`

const EmbedField = styled.div`
  margin-top: 4px;
  flex: ${props => props.inline ? 1 : 0};
  min-width: ${props => props.inline ? '150px' : '100%'};
  ${props => props.inline ? 'flex-basis: auto' : ''};
`

const EmbedFieldTitle = styled.div`
  color: white;
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 4px;
`

const EmbedFieldValue = styled.div`
  color: hsla(0, 0%, 100%, .6);
  font-size: 0.875rem;
  font-weight: 400;
  white-space: pre-line;
`

class Message extends Component {
  convertKeywords (word) {
    const { articleId, articleList, guildId, feedId, subscribers } = this.props
    const article = articleList[articleId]

    if (word.length === 0) return word
    let content = word
    for (const placeholderName in article) {
      if (placeholderName === 'fullTitle' || placeholderName === 'fullDescription' || placeholderName === 'fullSummary') continue
      if (placeholderName === 'subscriptions') continue
      const sanitizedPlaceholderName = `{${placeholderName.replace('regex:', '')}}`
      // console.log('replacing', sanitizedPlaceholderName, 'with', article[placeholderName])
      content = content.replace(sanitizedPlaceholderName, article[placeholderName])
    }
    // Do not replace it with article.subscriptions since it may be outdated after updating subscriptions from the subscriptions page. It will not be updated until another article fetch has occurred.
    if (content.includes('{subscriptions}') && feedId && guildId) {
      const feedSubscribers = []
      const thisSubscribers = subscribers[guildId][feedId]
      for (const id in thisSubscribers) {
        const subscriber = thisSubscribers[id]
        const hasFilters = subscriber.filters && typeof subscriber.filters === 'object' && Object.keys(subscriber.filters).length > 0
        if (!hasFilters) feedSubscribers.push(`<@${id}> `)
        else if (article && testFilters(subscriber.filters, article).passed) feedSubscribers.push(`<@${id}>`)
      }
      content = content.replace('{subscriptions}', feedSubscribers.length > 0 ? feedSubscribers.join(' ') : '')
    }
    return content
  }

  render () {
    const { embeds, message, articleId, articleList, bot, defaultConfig } = this.props
    const embedElements = []
    const article = articleList[articleId]
    let hasEmbeds = false

    for (let i = 0; i < embeds.length; ++i) {
      const properties = embeds[i]
      const parsedProperties = {}
      let populatedEmbed = false
      for (const propertyName in embedProperties) {
        const propName = embedProperties[propertyName]
        if (properties[propName] === undefined) continue
        parsedProperties[propName] = article && propName !== 'color' ? this.convertKeywords(properties[propName]) : properties[propName] // color is a number
        populatedEmbed = populatedEmbed || !!properties[propName]
      }
      const fields = properties.fields
      const fieldElements = []
      if (fields) {
        for (let i = 0; i < fields.length; ++i) {
          const field = fields[i]
          if (!field.title || !field.value) continue
          if (!populatedEmbed) populatedEmbed = true
          fieldElements.push(
            <EmbedField key={`field${i}`} inline={field.inline}>
              <EmbedFieldTitle>{parser.parseEmbedTitle(this.convertKeywords(field.title))}</EmbedFieldTitle>
              <EmbedFieldValue>{parser.parseAllowLinks(this.convertKeywords(field.value))}</EmbedFieldValue>
            </EmbedField>
          )
        }
      }
      if (populatedEmbed) {
        if (!hasEmbeds) hasEmbeds = true
        embedElements.push(
          <Embed key={`embed_preview${i}`}>
            <Pill color={properties[embedProperties.color]} />
            <NonPill>
              <BodyWrapper appeaseImage={!!(properties[embedProperties.imageUrl] || properties[embedProperties.imageUrlCamelCase])}>
                <div>
                  { properties[embedProperties.authorName] || properties[embedProperties.authorNameCamelCase]
                    ? <Author>
                      { properties[embedProperties.authorIconUrl] || properties[embedProperties.authorIconUrlCamelCase] ? <img alt='Embed Author Icon' src={parsedProperties[embedProperties.authorIconUrl] || parsedProperties[embedProperties.authorIconUrlCamelCase]} /> : null }
                      { parsedProperties[embedProperties.authorUrl] || parsedProperties[embedProperties.authorUrlCamelCase] ? <a target='_blank' rel='noopener noreferrer' href={parsedProperties[embedProperties.authorUrl] || parsedProperties[embedProperties.authorUrlCamelCase]}>{parsedProperties[embedProperties.authorName] || parsedProperties[embedProperties.authorNameCamelCase]}</a> : parsedProperties[embedProperties.authorName] || parsedProperties[embedProperties.authorNameCamelCase] }
                    </Author>
                    : undefined }

                  <Title as={properties[embedProperties.url] ? 'a' : 'span'} href={parsedProperties[embedProperties.url]} target='_blank' >
                    {parser.parseEmbedTitle(parsedProperties[embedProperties.title])}
                  </Title>
                  <Description>{parser.parseAllowLinks(parsedProperties[embedProperties.description])}</Description>
                  { fieldElements.length > 0
                    ? <EmbedFields>{fieldElements}</EmbedFields>
                    : [] }
                </div>
                { properties[embedProperties.thumbnailUrl] || properties[embedProperties.thumbnailUrlCamelCase]
                  ? <Thumbnail href={parsedProperties[embedProperties.thumbnailUrl] || parsedProperties[embedProperties.thumbnailUrlCamelCase]} target='_blank'>
                    <img src={parsedProperties[embedProperties.thumbnailUrl] || parsedProperties[embedProperties.thumbnailUrlCamelCase]} alt='Embed Thumbnail' />
                  </Thumbnail>
                  : undefined }
              </BodyWrapper>
              { properties[embedProperties.imageUrl] || properties[embedProperties.imageUrlCamelCase]
                ? <Image href={parsedProperties[embedProperties.imageUrl] || parsedProperties[embedProperties.imageUrlCamelCase]} target='_blank' >
                  <img src={parsedProperties[embedProperties.imageUrl] || parsedProperties[embedProperties.imageUrlCamelCase]} alt='Embed MainImage' />
                </Image>
                : undefined }

              { properties[embedProperties.footerText] || properties[embedProperties.footerTextCamelCase] || (parsedProperties[embedProperties.timestamp] && parsedProperties[embedProperties.timestamp] !== 'none')
                ? <Footer>
                  { parsedProperties[embedProperties.footerIconUrl] || parsedProperties[embedProperties.footerIconUrlCamelCase] ? <img src={parsedProperties[embedProperties.footerIconUrl] || parsedProperties[embedProperties.footerIconUrlCamelCase]} alt='Embed Footer Icon' /> : null }
                  {properties[embedProperties.footerText] || properties[embedProperties.footerTextCamelCase]}{(parsedProperties[embedProperties.timestamp] && parsedProperties[embedProperties.timestamp] !== 'none') ? `${parsedProperties[embedProperties.footerText] || parsedProperties[embedProperties.footerTextCamelCase] ? ' • ' : ''}[${parsedProperties[embedProperties.timestamp] === 'article' ? 'ARTICLE TIMESTAMP' : 'NOW TIMESTAMP'}]` : '' }
                </Footer>
                : undefined }
            </NonPill>
          </Embed>
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
          { (message || defaultConfig.defaultMessage) === '{empty}' && hasEmbeds ? '' : article ? parser.parse(this.convertKeywords(message || defaultConfig.defaultMessage || ''), true, {}, parser.jumboify) : parser.parse(message || defaultConfig.defaultMessage || '', true, {}, parser.jumboify) }
          {embedElements}
        </Content>
      </Wrapper>
    )
  }
}

Message.propTypes = {
  embeds: PropTypes.array,
  message: PropTypes.string,
  articleId: PropTypes.number,
  articleList: PropTypes.array,
  guildId: PropTypes.string,
  feedId: PropTypes.string,
  subscribers: PropTypes.object,
  bot: PropTypes.object,
  defaultConfig: PropTypes.object
}

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(Message))
