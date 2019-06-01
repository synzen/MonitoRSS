import React, { Component } from 'react'
import { withRouter } from 'react-router-dom'
import { connect } from 'react-redux'
import { changePage } from 'js/actions/index-actions'
import PageHeader from 'js/components/utils/PageHeader'
import colors from 'js/constants/colors'
import SectionSubtitle from 'js/components/utils/SectionSubtitle'
import PopInButton from '../../../utils/PopInButton'
import SectionTitle from 'js/components/utils/SectionTitle'
import { Dropdown, Input, Divider, Button } from 'semantic-ui-react'
import pages from 'js/constants/pages'
import PropTypes from 'prop-types'
import styled from 'styled-components'
import moment from 'moment-timezone'
import axios from 'axios'
import toast from '../../../utils/toast'
import fileDonwload from 'js-file-download'
import Date from './Date'

const mapStateToProps = state => {
  return {
    guild: state.guild,
    guildId: state.guildId,
    defaultConfig: state.defaultConfig,
    csrfToken: state.csrfToken
  }
}

const mapDispatchToProps = dispatch => {
  return {
    setToThisPage: () => dispatch(changePage(pages.SERVER_SETTINGS))
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

const InputDescription = styled.div`
  margin-top: 8px;
  color: ${colors.discord.subtext};
`

const LargeDivider = styled(Divider)`
  margin-top: 40px !important;
  margin-bottom: 40px !important;
`

const ButtonContainer = styled.div`
  display: flex;
  justify-content: flex-end;
  .ui.button {
    margin-left: 1em;
  }
`

const BackupButtonContainer = styled.div`
  display: flex;
  .ui.button:first-child {
    margin-right: 1em;
  }
`

class ServerSettings extends Component {
  constructor () {
    super()
    this.state = {
      unsaved: false,
      saving: false,
      downloadingBackup: false,
      invalidTimezone: false,
      dateLanguage: '',
      dateFormat: '',
      timezone: '',
      prefix: '',
      defaults: {
        prefix: '',
        dateLanguage: '',
        dateLanguageList: [],
        dateFormat: '',
        timezone: ''
      }
    }
  }

  componentWillMount () {
    this.props.setToThisPage()
  }

  componentDidMount () {
    this.resetValues()
  }

  componentDidUpdate (prevProps) {
    if (prevProps.guildId !== this.props.guildId) return this.resetValues()
    const toCompare = ['prefix', 'dateLanguage', 'dateFormat', 'timezone']
    for (const key of toCompare) {
      if (prevProps.guild[key] !== this.props.guild[key]) return this.resetValues()
    }

    // Now check if it should update it to be unsaved
    if (this.state.unsaved) return
    const { defaultConfig, guild } = this.props
    const defaultPrefix = guild.prefix || ''
    if (this.state.prefix !== defaultPrefix) return this.setState({ unsaved: true })
    for (let i = 1; i < toCompare.length; ++i) {
      const key = toCompare[i]
      const defaultValue = this.state.defaults[key]
      if (this.state[key] !== defaultValue && this.state[key] !== defaultConfig[key]) {
        if (key === 'timezone') {
          const thisResolved = moment.tz.zone(this.state[key])
          const defaultResolved = moment.tz.zone(defaultValue)
          if ((!thisResolved && defaultResolved) || (thisResolved && !defaultResolved) || (thisResolved && defaultResolved && thisResolved.name !== defaultResolved.name)) return this.setState({ unsaved: true })
        } else return this.setState({ unsaved: true })
      }
    }
  }

  resetValues = () => {
    const { defaultConfig, guild } = this.props
    const timezone = guild.timezone ? moment.tz.zone(guild.timezone) : ''
    const newState = {
      unsaved: false,
      invalidTimezone: false,
      prefix: guild.prefix || '',
      dateLanguage: guild.dateLanguage || defaultConfig.dateLanguage,
      dateFormat: guild.dateFormat || '',
      timezone: timezone ? timezone.name : ''
    }
    newState.defaults = { ...newState, dateLanguageList: defaultConfig.dateLanguageList }
    this.setState(newState)
  }

  updateSetting = (key, val) => {
    const { defaultConfig } = this.props
    const newState = { [key]: val, unsaved: false }
    const guildDefault = this.state.defaults[key]
    const configDefault = key === 'prefix' ? '' : defaultConfig[key]
    if (key === 'timezone') {
      let differentFromGuild = false
      let differentFromConfig = false
      const resolved = moment.tz.zone(val)

      const guildDefaultResolved = moment.tz.zone(guildDefault)
      if ((!resolved && guildDefaultResolved) || (resolved && !guildDefaultResolved) || (resolved && guildDefaultResolved && resolved.name !== guildDefaultResolved.name)) differentFromGuild = true
      else if (!resolved && !guildDefaultResolved && !guildDefault && val !== '') differentFromGuild = true

      if (differentFromGuild) {
        const configDefaultResolved = moment.tz.zone(configDefault)
        if ((!resolved && configDefaultResolved) || (resolved && !configDefaultResolved) || (resolved && configDefaultResolved && resolved.name !== configDefaultResolved.name)) differentFromConfig = true
        else if (!resolved && !configDefaultResolved && val !== configDefault) differentFromConfig = true
      }

      if (differentFromConfig && differentFromGuild) {
        newState.unsaved = true
        if (val === '' && this.state.invalidTimezone) newState.invalidTimezone = false
        else {
          if (!this.state.invalidTimezone && !resolved) newState.invalidTimezone = true
          else if (this.state.invalidTimezone && resolved) newState.invalidTimezone = false
        }
      } else if (this.state.invalidTimezone) newState.invalidTimezone = false
      if (resolved) newState[key] = resolved.name
    } else if (val !== guildDefault && val !== configDefault) newState.unsaved = true
    this.setState(newState)
  }

  downloadBackup = () => {
    const { guildId, csrfToken } = this.props
    this.setState({ downloadingBackup: true })
    axios.get(`/api/guilds/${guildId}`, { headers: { 'CSRF-Token': csrfToken } }).then(({ data }) => {
      fileDonwload(JSON.stringify(data, null, 2), `${guildId}.json`)
      this.setState({ downloadingBackup: false })
    }).catch(err => {
      this.setState({ downloadingBackup: false })
      console.log(err.response || err.message)
      const errMessage = err.response && err.response.data && err.response.data.message ? err.response.data.message : err.response && err.response.data ? err.response.data : err.message
      toast.error(<p>Failed to download backup<br/><br/>{errMessage ? typeof errMessage === 'object' ? JSON.stringify(errMessage, null, 2) : errMessage : 'No details available'}</p>)
    })
  }

  save = () => {
    if (!this.state.unsaved) return
    const { guildId, csrfToken } = this.props
    const { timezone, dateFormat, dateLanguage, prefix } = this.state
    const payload = {
      timezone,
      dateFormat,
      dateLanguage,
      prefix
    }
    this.setState({ saving: true })
    axios.patch(`/api/guilds/${guildId}`, payload, { headers: { 'CSRF-Token': csrfToken } }).then(({ data }) => {
      toast.success('Saved!')
      this.setState({ saving: false })
    }).catch(err => {
      this.setState({ saving: false })
      if (err.response && err.response.status === 304) return toast.success('No changes detected')
      console.log(err.response || err.message)
      const errMessage = err.response && err.response.data && err.response.data.message ? err.response.data.message : err.response && err.response.data ? err.response.data : err.message
      toast.error(<p>Failed to save settings<br/><br/>{errMessage ? typeof errMessage === 'object' ? JSON.stringify(errMessage, null, 2) : errMessage : 'No details available'}</p>)
    })
  }

  render () {
    const { defaultConfig } = this.props

    return (
      <Container>
        <PageHeader heading='Server Settings' subheading='These settings will apply to all the feeds in this server.' />
        <Divider />
        <SectionTitle heading='Dates' subheading='These settings will all apply to the {date} placeholder. If no {date} placeholders are used in any feeds, these settings will have no effect.'/>
        <SectionSubtitle>Preview</SectionSubtitle>
        <Date defaultConfig={defaultConfig} timezone={this.state.timezone} dateFormat={this.state.dateFormat} invalidTimezone={this.state.invalidTimezone} />
        <Divider />
        <SectionSubtitle>Timezone</SectionSubtitle>
        <Input fluid onChange={e => this.updateSetting('timezone', e.target.value)} error={this.state.invalidTimezone} value={this.state.timezone} placeholder={defaultConfig.timezone} />
        <InputDescription>This will change the timezone of the {`{date}`} placeholder to the one you specify. <a href='https://en.wikipedia.org/wiki/List_of_tz_database_time_zones' target='_blank' rel='noopener noreferrer'>See here for a list of valid timezones under the "TZ database name" column.</a></InputDescription>
        <Divider />
        <SectionSubtitle>Date Language</SectionSubtitle>
        <Dropdown selection fluid options={this.state.defaults.dateLanguageList.map(lang => { return { text: lang, value: lang } })} value={this.state.dateLanguage} onChange={(e, data) => this.updateSetting('dateLanguage', data.value)} />
        <InputDescription>Only a certain number of languages are manually supported for dates. To request your language to be supported, please contact the developer on the support server.</InputDescription>
        <Divider />
        <SectionSubtitle>Date Format</SectionSubtitle>
        <Input fluid value={this.state.dateFormat} onChange={e => this.updateSetting('dateFormat', e.target.value)} placeholder={defaultConfig.dateFormat} />
        <InputDescription>This will dictate how the {`{date}`} placeholder will be formatted. <a href='https://momentjs.com/docs/#/displaying/' target='_blank' rel='noopener noreferrer'>See here on how to customize your date formats.</a>.</InputDescription>
        <LargeDivider />
        <SectionTitle heading='Command Prefix' subheading='If specified, this prefix will replace the default prefix used before all commands. This setting can only be configured through Discord commands at this time.' />
        <Input fluid onChange={e => this.updateSetting('prefix', e.target.value)} value={this.state.prefix} disabled />
        <LargeDivider />
        <SectionTitle heading='Alerts' subheading='Set up direct messaging to specific users when a feed has problems. This setting can only be configured through Discord commands at this time.' />
        <LargeDivider />
        <SectionTitle heading='Backup' subheading='Download a copy of all your server feeds and settings for safekeeping. This is highly, HIGHLY recommended in case there is data loss, or if you wish to import/overwrite your settings at a later point. Restorations can only be done by requesting through the support server.' />
        <BackupButtonContainer>
          <Button basic content='Download Backup' onClick={this.downloadBackup} disabled={this.state.downloadingBackup} />
          <Button basic content='Send Backup to Discord' disabled onClick={this.downloadBackup} />
        </BackupButtonContainer>
        <LargeDivider />
        <ButtonContainer>
          <PopInButton content='Reset' basic inverted pose={this.state.saving ? 'exit' : this.state.unsaved ? 'enter' : 'exit'} onClick={this.resetValues} />
          <Button content='Save' color='green' disabled={this.state.invalidTimezone || !this.state.unsaved || this.state.saving} onClick={this.save} />
        </ButtonContainer>
      </Container>
    )
  }
}

ServerSettings.propTypes = {
  setToThisPage: PropTypes.func
}

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(ServerSettings))
