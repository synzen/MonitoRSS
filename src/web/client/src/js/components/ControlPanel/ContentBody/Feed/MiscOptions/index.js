import React, { useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import styled from 'styled-components'
import PopInButton from '../../../utils/PopInButton'
import colors from 'js/constants/colors'
import SectionItemTitle from 'js/components/utils/SectionItemTitle'
import PageHeader from 'js/components/utils/PageHeader'
import { Divider, Checkbox, Button } from 'semantic-ui-react'
import SectionSubtitle from 'js/components/utils/SectionSubtitle'
import feedSelectors from 'js/selectors/feeds'
import { fetchEditFeed } from 'js/actions/feeds'
import { changePage } from 'js/actions/page'
import pages from 'js/constants/pages'
import { Redirect } from 'react-router-dom'

const Container = styled.div`
  padding: 20px;
  @media only screen and (min-width: 930px) {
    padding: 55px;
  }
  width: 100%;
  max-width: 840px;
`

const MiscOptionContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  > div {
    max-width: calc(100% - 80px);
  }
`

const SaveButtonContainer = styled.div`
  display: flex;
  justify-content: flex-end;
  .ui.button {
    margin-left: 1em;
  }
`

const Categories = styled.div`
  > div {
    margin-top: 50px;
    &:first-child {
      margin-top: 30px;
    }
  }
`

const Description = styled.p`
  color: ${colors.discord.text};
`

const boolToText = bool => bool ? 'Enabled' : 'Disabled'
const configKeyNames = {
  checkTitles: 'checkTitles',
  checkDates: 'checkDates',
  imgPreviews: 'imgPreviews',
  imgLinksExistence: 'imgLinksExistence',
  formatTables: 'formatTables',
  toggleRoleMentions: 'toggleRoleMentions'
}

function MiscOptions () {
  const botConfig = useSelector(state => state.botConfig)
  const editing = useSelector(feedSelectors.feedEditing)
  const feed = useSelector(feedSelectors.activeFeed)
  const [userValues, setUserValues] = useState({})
  const dispatch = useDispatch()
  const unsaved = Object.keys(userValues).length > 0

  if (!feed) {
    dispatch(changePage(pages.DASHBOARD))
    return <Redirect to={pages.DASHBOARD} />
  }

  const getOriginalPropertyValue = (property) => {
    if (!feed || feed[property] === undefined) {
      return botConfig[property]
    } else {
      return feed[property]
    }
  }

  const matchesOriginalProperty = (property, value) => {
    return value === getOriginalPropertyValue(property)
  }

  const updateProperty = (property, value) => {
    if (matchesOriginalProperty(property, value)) {
      const clone = { ...userValues }
      delete clone[property]
      setUserValues(clone)
    } else {
      setUserValues({
        ...userValues,
        [property]: value
      })
    }
  }

  const apply = async () => {
    if (!unsaved) {
      return
    }
    await dispatch(fetchEditFeed(feed.guild, feed._id, userValues))
    reset()
  }

  const reset = () => {
    setUserValues({})
  }

  const checkTitles = userValues.checkTitles === undefined ? getOriginalPropertyValue('checkTitles') : userValues.checkTitles
  const checkDates = userValues.checkDates === undefined ? getOriginalPropertyValue('checkDates') : userValues.checkDates
  const imgPreviews = userValues.imgPreviews === undefined ? getOriginalPropertyValue('imgPreviews') : userValues.imgPreviews
  const imgLinksExistence = userValues.imgLinksExistence === undefined ? getOriginalPropertyValue('imgLinksExistence') : userValues.imgLinksExistence
  const formatTables = userValues.formatTables === undefined ? getOriginalPropertyValue('formatTables') : userValues.formatTables
  const toggleRoleMentions = userValues.toggleRoleMentions === undefined ? getOriginalPropertyValue('toggleRoleMentions') : userValues.toggleRoleMentions

  return (
    <Container>
      <PageHeader>
        <h2>Misc Options</h2>
        <Description>Miscellaneous options that changes various aspects of your feed.</Description>
      </PageHeader>
      <Categories>
        <div>
          <SectionSubtitle>Algorithms</SectionSubtitle>
          <MiscOptionContainer>
            <div>
              <SectionItemTitle>Title Checks</SectionItemTitle>
              <Description>ONLY ENABLE THIS IF NECESSARY! Title checks will ensure no article with the same title as a previous one will be sent for a specific feed.</Description>
              <Description>Default: {boolToText(botConfig.checkTitles)}</Description>
            </div>
            <Checkbox checked={checkTitles} toggle onChange={(e, data) => updateProperty(configKeyNames.checkTitles, data.checked)} />
          </MiscOptionContainer>
          <Divider />
          <MiscOptionContainer>
            <div>
              <SectionItemTitle>Date Checks</SectionItemTitle>
              <Description>Date checking ensures that articles that are either older than {botConfig.cycleMaxAge} day{botConfig.cycleMaxAge > 1 ? 's' : ''} or has invalid/no published dates are never sent. This MUST be enabled for feeds with no {`{date}`} placeholder.</Description>
              <Description>Default: {boolToText(botConfig.checkDates)}</Description>
            </div>
            <Checkbox checked={checkDates} toggle onChange={(e, data) => updateProperty(configKeyNames.checkDates, data.checked)} />
          </MiscOptionContainer>
          <Divider />
        </div>

        <div>
          <SectionSubtitle>Formatting</SectionSubtitle>
          <MiscOptionContainer>
            <div>
              <SectionItemTitle>Image Links Preview</SectionItemTitle>
              <Description>Toggle automatic Discord image link embedded previews for image links found inside placeholders such as {`{description}`}.</Description>
              <Description>Default: {boolToText(botConfig.imgPreviews)}</Description>
            </div>
            <Checkbox checked={imgPreviews} toggle onChange={(e, data) => updateProperty(configKeyNames.imgPreviews, data.checked)} />
          </MiscOptionContainer>
          <Divider />
          <MiscOptionContainer>
            <div>
              <SectionItemTitle>Image Links Existence</SectionItemTitle>
              <Description>Remove image links found inside placeholders such as {`{description}`}. If disabled, all image src links in such placeholders will be removed.</Description>
              <Description>Default: {boolToText(botConfig.imgLinksExistence)}</Description>
            </div>
            <Checkbox checked={imgLinksExistence} toggle onChange={(e, data) => updateProperty(configKeyNames.imgLinksExistence, data.checked)} />
          </MiscOptionContainer>
          <Divider />
          <MiscOptionContainer>
            <div>
              <SectionItemTitle>Tables Support</SectionItemTitle>
              <Description>If table formatting is enabled, they should be enclosed in code blocks to ensure uniform spacing.</Description>
              <Description>Default: {boolToText(botConfig.formatTables)}</Description>
            </div>
            <Checkbox checked={formatTables} toggle onChange={(e, data) => updateProperty(configKeyNames.formatTables, data.checked)} />
          </MiscOptionContainer>
          <Divider />
        </div>

        <div>
          <SectionSubtitle>Other</SectionSubtitle>
          <MiscOptionContainer>
            <div>
              <SectionItemTitle>Role Mentioning</SectionItemTitle>
              <Description>Turns on role mentionability for any subscribed roles to a feed when articles are about to send, then immediately turns their mentionability off after the article has been sent.</Description>
              <Description>Default: {boolToText(botConfig.toggleRoleMentions)}</Description>
            </div>
            <Checkbox checked={toggleRoleMentions} toggle onChange={(e, data) => updateProperty(configKeyNames.toggleRoleMentions, data.checked)} />
          </MiscOptionContainer>
          <Divider />
        </div>
      </Categories>
      <SaveButtonContainer>
        <PopInButton pose={editing ? 'exit' : unsaved ? 'enter' : 'exit'} basic inverted content='Reset' onClick={reset} />
        <Button disabled={!unsaved || editing} content='Save' color='green' onClick={apply} />
      </SaveButtonContainer>
    </Container>
  )
}

export default MiscOptions
