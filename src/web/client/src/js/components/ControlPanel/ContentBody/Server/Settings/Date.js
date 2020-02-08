import React from 'react'
import colors from 'js/constants/colors'
import PropTypes from 'prop-types'
import moment from 'moment-timezone'

class ServerSettings extends React.PureComponent {
  render () {
    const { botConfig, timezone, dateFormat, invalidTimezone } = this.props
    const thisMoment = moment()

    const timezone = timezone || botConfig.timezone
    const dateFormat = dateFormat || botConfig.dateFormat

    return (
      <span style={{ fontSize: '20px' }}>
        {invalidTimezone
          ? <span style={{ color: colors.discord.red }}>Invalid Timezone</span>
          : thisMoment.tz(timezone).format(dateFormat)}
      </span>
    )
  }
}

ServerSettings.propTypes = {
  botConfig: PropTypes.object,
  timezone: PropTypes.string,
  dateFormat: PropTypes.string,
  invalidTimezone: PropTypes.bool
}

export default ServerSettings
