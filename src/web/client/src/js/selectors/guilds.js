import { EDIT_GUILD } from "js/constants/actions/guilds"

function editing (state) {
  return state.loading[EDIT_GUILD.BEGIN]
}

export default {
  editing
}
