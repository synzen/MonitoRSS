import axios from 'axios'
import FetchStatusActions from './utils/FetchStatusActions'
import { GET_SCHEDULE } from 'js/constants/actions/schedules'

export const {
  begin: getScheduleBegin,
  success: getScheduleSuccess,
  failure: getScheduleFailure
} = new FetchStatusActions(GET_SCHEDULE)

export function fetchGuildFeedSchedule (guildID, feedID) {
  return async dispatch => {
    try {
      dispatch(getScheduleBegin())
      const { data } = await axios.get(`/api/guilds/${guildID}/feeds/${feedID}/schedule`)
      dispatch(getScheduleSuccess({
        feedID,
        data
      }))
    } catch (err) {
      dispatch(getScheduleFailure(err))
    }
  }
}
