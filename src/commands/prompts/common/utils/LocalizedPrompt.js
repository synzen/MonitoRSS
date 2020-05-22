const { DiscordPrompt, MessageVisual, Rejection } = require('discord.js-prompts')
const Translator = require('../../../../structs/Translator.js')

class LocalizedPrompt extends DiscordPrompt {
  static async getExitVisual (message, discordChannel, data) {
    const { profile } = data
    const translate = Translator.createProfileTranslator(profile)
    return new MessageVisual(translate('structs.MenuUtils.closed'))
  }

  static async getInactivityVisual (discordChannel, data) {
    const { profile } = data
    const translate = Translator.createProfileTranslator(profile)
    return new MessageVisual(translate('structs.MenuUtils.closedInactivity'))
  }

  static createMenuRejection (message, data) {
    const { profile } = data
    const translate = Translator.createProfileTranslator(profile)
    return new Rejection(translate('structs.errors.MenuOptionError.message'))
  }
}

module.exports = LocalizedPrompt
