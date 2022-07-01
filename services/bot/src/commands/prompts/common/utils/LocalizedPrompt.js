const { DiscordPrompt, Rejection } = require('discord.js-prompts')
const Translator = require('../../../../structs/Translator.js')

class LocalizedPrompt extends DiscordPrompt {
  static createMenuRejection (message, data) {
    const { profile } = data
    const translate = Translator.createProfileTranslator(profile)
    return new Rejection(translate('structs.errors.MenuOptionError.message'))
  }
}

module.exports = LocalizedPrompt
