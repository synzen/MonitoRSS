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
import toast from 'js/components/ControlPanel/utils/toast'

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
  return async (dispatch, getState) => {
    const { activeGuildID } = getState()
    try {
      dispatch(setGuildsBegin())
      const { data } = await axios.get(`/api/users/@me/guilds`)
      dispatch(setGuildsSuccess(data))
      if (!data.find(guild => guild.id === activeGuildID)) {
        await dispatch(setActiveGuild(''))
      } else {
        await dispatch(setActiveGuild(activeGuildID))
      }
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
      toast.success(`Your changes have been saved`)
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
    if (!guildID) {
      return
    }
    await Promise.all([
      dispatch(fetchGuildChannels(guildID)),
      dispatch(fetchGuildRoles(guildID)),
      dispatch(fetchGuildFeeds(guildID)),
      dispatch(fetchGuildFailRecords(guildID))
    ])
  }
}
