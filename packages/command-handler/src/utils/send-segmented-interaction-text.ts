import { ButtonInteraction, CommandInteraction, SelectMenuInteraction, Util } from 'discord.js';

/**
 * Since Discord limits messages to be 2000 characters, this helps split up the text into chunks
 * and send them in separate messages.
 *
 * @param text The text to split into segments.
 * @param interaction The interaction that will send the text.
 */
async function sendSegmentedInteractionText(
  text: string,
  interaction: CommandInteraction | SelectMenuInteraction | ButtonInteraction,
  options: {
    deferred?: boolean
  } = {
    deferred: true,
  },
) {
  const splitText = Util.splitMessage(text, { maxLength: 2000 });

  if (options.deferred) {
    await interaction.editReply({
      content: splitText[0],
    });
  } else {
    await interaction.reply({
      content: splitText[0],
    });
  }

  if (splitText.length > 1) {
    await interaction.guild?.channels.fetch(interaction.channelId);

    for (let i = 1; i < splitText.length; i++) {
      await interaction.channel?.send({
        content: splitText[i],
      });
    }
  }
}

export default sendSegmentedInteractionText;
