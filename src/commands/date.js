const { PromptNode } = require('discord.js-prompts')
const datePrompts = require('./prompts/date/index.js')
const runWithFeedGuild = require('./prompts/runner/runWithFeedsProfile.js')

module.exports = async (message) => {
  const selectCustomizationNode = new PromptNode(datePrompts.selectCustomization.prompt)
  const successResetNode = new PromptNode(datePrompts.successReset.prompt)
  const askTimezoneNode = new PromptNode(datePrompts.askTimezone.prompt)
  const askFormatNode = new PromptNode(datePrompts.askFormat.prompt)
  const askLanguageNode = new PromptNode(datePrompts.askLanguage.prompt)

  selectCustomizationNode.setChildren([
    successResetNode,
    askTimezoneNode,
    askFormatNode,
    askLanguageNode
  ])

  const successTimezoneNode = new PromptNode(datePrompts.successTimezone.prompt)
  const successFormatNode = new PromptNode(datePrompts.successFormat.prompt)
  const successLanguageNode = new PromptNode(datePrompts.successLanguage.prompt)

  askTimezoneNode.addChild(successTimezoneNode)
  askFormatNode.addChild(successFormatNode)
  askLanguageNode.addChild(successLanguageNode)

  await runWithFeedGuild(selectCustomizationNode, message)
}
