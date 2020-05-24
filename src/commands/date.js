const { PromptNode } = require('discord.js-prompts')
const datePrompts = require('./prompts/date/index.js')
const runWithFeedGuild = require('./prompts/runner/run.js')

module.exports = async (message) => {
  const selectCustomizationNode = new PromptNode(datePrompts.selectCustomization.prompt)

  const askTimezoneCondition = data => data.selected === '1'
  const askTimezoneNode = new PromptNode(datePrompts.askTimezone.prompt, askTimezoneCondition)

  const askFormatCondition = data => data.selected === '2'
  const askFormatNode = new PromptNode(datePrompts.askFormat.prompt, askFormatCondition)

  const askLanguageCondition = data => data.selected === '3'
  const askLanguageNode = new PromptNode(datePrompts.askLanguage.prompt, askLanguageCondition)

  const successResetNodeCondition = data => data.selected === '4'
  const successResetNode = new PromptNode(datePrompts.successReset.prompt, successResetNodeCondition)

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
