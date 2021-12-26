import sendSegmentedInteractionText from './send-segmented-interaction-text';

describe('sendSegmentedInteractionText', () => {
  let text = 'text';
  const interaction = {
    editReply: jest.fn(),
    reply: jest.fn(),
    channel: {
      send: jest.fn(),
    },
    guild: {
      channels: {
        fetch: jest.fn(),
      },
    },
  };

  beforeEach(() => {
    text = 'text';
    jest.resetAllMocks();
  });
  it('edits the reply if deferred is true', async () => {
    await sendSegmentedInteractionText(text, interaction as any, {
      deferred: true,
    });
    expect(interaction.editReply).toHaveBeenCalledWith({
      content: text,
    });
  });
  it('replies if deferred is false', async () => {
    await sendSegmentedInteractionText(text, interaction as any, {
      deferred: false,
    });
    expect(interaction.reply).toHaveBeenCalledWith({
      content: text,
    });
  });
  it('edits the reply by default without passing deferred', async () => {
    await sendSegmentedInteractionText(text, interaction as any);
    expect(interaction.editReply).toHaveBeenCalledWith({
      content: text,
    });
  });
  it('sends the additional chunks via channel send if message was >2000 chars', async () => {
    text = 'text'.padEnd(1800, 'a');
    text += '\nb'.padEnd(1800, 'b');
    text += '\nc'.padEnd(1800, 'c');

    await sendSegmentedInteractionText(text, interaction as any);
    expect(interaction.channel.send).toHaveBeenCalledTimes(2);
  });
  it('fetches the channel prior to channel-sending the message if >2000 chars', async () => {
    text = 'text'.padEnd(1800, 'a');
    text += '\nb'.padEnd(1800, 'b');

    await sendSegmentedInteractionText(text, interaction as any);
    expect(interaction.guild.channels.fetch).toHaveBeenCalledTimes(1);
  });
});
