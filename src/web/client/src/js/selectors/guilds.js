import { EDIT_GUILD } from "js/constants/actions/guilds"

function editing (state) {
  return state.loading[EDIT_GUILD.BEGIN]
}

function activeGuild (state) {
  return state.guilds.find(guild => guild.id === state.activeGuildID)
}

export default {
  editing,
  activeGuild
}
