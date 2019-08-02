import React from 'react'
import colors from 'js/constants/colors'
import PropTypes from 'prop-types'
import moment from 'moment-timezone'

class ServerSettings extends React.PureComponent {
  render () {
    const { defaultConfig, timezone, dateFormat, invalidTimezone } = this.props
    const thisMoment = moment()

    return (
      <span style={{ fontSize: '20px' }}>{invalidTimezone ? <span style={{ color: colors.discord.red }}>Invalid Timezone</span> : thisMoment.tz(timezone || defaultConfig.timezone).format(dateFormat || defaultConfig.dateFormat)}</span>
    )
  }
}

ServerSettings.propTypes = {
  defaultConfig: PropTypes.object,
  timezone: PropTypes.string,
  dateFormat: PropTypes.string,
  invalidTimezone: PropTypes.bool
}

export default ServerSettings
