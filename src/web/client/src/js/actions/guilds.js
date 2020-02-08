import axios from 'axios'
import {
  GET_GUILDS,
  SET_ACTIVE_GUILD,
  EDIT_GUILD,
} from '../constants/actions/guilds'
import { fetchGuildChannels } from './channels'
import { fetchGuildRoles } from './roles'
import { fetchGuildFeeds } from './feeds'
import { fetchGuildFailRecords } from './failRecords'
import FetchStatusActions from './utils/FetchStatusActions'

export const {
  begin: setGuildsBegin,
  success: setGuildsSuccess,
  failure: setGuildsFailure
} = new FetchStatusActions(GET_GUILDS)

export const {
  begin: editGuildBegin,
  success: editGuildSuccess,
  failure: editGuildFailure
} = new FetchStatusActions(EDIT_GUILD)

export function fetchGuilds () {
  return async dispatch => {
    try {
      dispatch(setGuildsBegin())
      const { data } = await axios.get(`/api/users/@me/guilds`)
      dispatch(setGuildsSuccess(data))
    } catch (err) {
      dispatch(setGuildsFailure(err))
    }
  }
}

export function fetchEditGuild (guildID, edited) {
  return async dispatch => {
    try {
      dispatch(editGuildBegin())
      const { data } = await axios.patch(`/api/guilds/${guildID}`, edited)
      dispatch(editGuildSuccess(data))
    } catch (err) {
      dispatch(editGuildFailure(err))
    }
  }
}

export function setActiveGuild (guildID) {
  return async dispatch => {
    dispatch({
      type: SET_ACTIVE_GUILD,
      payload: guildID
    })
    await dispatch(fetchGuildChannels(guildID))
    await dispatch(fetchGuildRoles(guildID))
    await dispatch(fetchGuildFeeds(guildID))
    await dispatch(fetchGuildFailRecords(guildID))
  }
}
