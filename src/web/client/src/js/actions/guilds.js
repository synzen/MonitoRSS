import {
  GET_GUILDS,
  SET_ACTIVE_GUILD
} from '../constants/actions/guilds'
import APIActions from './utils/common'
import { fetchGuildChannels } from './channels'
import { fetchGuildRoles } from './roles'

const guildActions = new APIActions(GET_GUILDS.prefix, '/api/users/@me/guilds')

export const fetchGuilds = guildActions.fetch
export const setGuildsSuccess = guildActions.success
export const setGuildsBegin = guildActions.begin
export const setGuildsFailure = guildActions.failure

export function setActiveGuild (guildID) {
  return dispatch => {
    dispatch({
      type: SET_ACTIVE_GUILD,
      payload: guildID
    })
    dispatch(fetchGuildChannels(guildID))
    dispatch(fetchGuildRoles(guildID))
  }
}
