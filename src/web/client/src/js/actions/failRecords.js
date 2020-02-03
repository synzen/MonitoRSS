import axios from 'axios'
import FetchStatusActions from './utils/FetchStatusActions'
import { GET_FAILRECORDS } from 'js/constants/actions/failRecords'

export const {
  begin: getFailRecordsBegin,
  success: getFailRecordsSuccess,
  failure: getFailRecordsFailure
} = new FetchStatusActions(GET_FAILRECORDS)

export function fetchGuildFailRecords (guildID) {
  return async dispatch => {
    try {
      dispatch(getFailRecordsBegin())
      const { data } = await axios.get(`/api/guilds/${guildID}/failrecords`)
      dispatch(getFailRecordsSuccess(data))
    } catch (err) {
      dispatch(getFailRecordsFailure(err))
    }
  }
}
