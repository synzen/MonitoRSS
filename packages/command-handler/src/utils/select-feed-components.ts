import { MessageActionRow, MessageButton, MessageSelectMenu } from 'discord.js';
import { CommandServices } from '../types/command-container.type';
import InteractionCustomId, {
  InteractionPaginationData, InteractionTasks,
} from '../types/interaction-custom-id.type';
import createInteractionCustomId from './create-interaction-custom-id';

const FEEDS_PER_PAGE = 1;

async function selectFeedComponents(
  commandServices: CommandServices,
  guildId: string,
  channelId: string,
  customIdObject: InteractionCustomId<InteractionPaginationData>,
) {
  if (customIdObject.data?.pageNumber == null || isNaN(customIdObject.data.pageNumber)) {
    throw new Error('currentPageNumber must be a number');
  }

  const currentPageNumber = customIdObject.data.pageNumber;

  const [
    totalFeedCount,
    feeds,
  ] = await Promise.all([
    commandServices.feedService.count({
      guild: guildId,
      channel: channelId,
    }),
    commandServices.feedService.find({
      guild: guildId,
      channel: channelId,
    }, currentPageNumber, FEEDS_PER_PAGE),
  ]);

  if (feeds.length === 0) {
    throw new Error('No feeds found');
  }

  const lastPageNumber = Math.ceil(totalFeedCount / FEEDS_PER_PAGE) - 1;

  const isFirstPage = currentPageNumber === 0;
  const isLastPage = currentPageNumber === lastPageNumber;

  const previousPageNumber = Math.max(currentPageNumber - 1, 0);
  const nextPageNumber = Math.min(currentPageNumber + 1, lastPageNumber);

  const selectMenuCustomId = createInteractionCustomId(customIdObject);

  const row = new MessageActionRow()
    .addComponents(
      new MessageSelectMenu()
        .setCustomId(selectMenuCustomId)
        .setPlaceholder('Please select a feed')
        .addOptions(feeds.map(feed => ({
          label: feed.title,
          value: feed._id.toHexString(),
          description: `${feed.url}`,
        }))),
    );

  const previousButtonCustomId = createInteractionCustomId<InteractionPaginationData>({
    action: customIdObject.action,
    task: InteractionTasks.ON_CLICK_PREVIOUS_PAGE,
    data: {
      pageNumber: previousPageNumber,
    },
  });

  const nextButtonCustomId = createInteractionCustomId<InteractionPaginationData>({
    action: customIdObject.action,
    task: InteractionTasks.ON_CLICK_NEXT_PAGE,
    data: {
      pageNumber: nextPageNumber,
    },
  });

  const buttonRow = new MessageActionRow()
    .addComponents(
      new MessageButton()
        .setCustomId(previousButtonCustomId)
        .setLabel('Back')
        .setStyle('SECONDARY')
        .setDisabled(isFirstPage),
      new MessageButton()
        .setCustomId('label')
        .setLabel(`Page ${currentPageNumber + 1}/${lastPageNumber + 1}`)
        .setStyle('SECONDARY')
        .setDisabled(true),
      new MessageButton()
        .setCustomId(nextButtonCustomId)
        .setLabel('Next')
        .setStyle('SECONDARY')
        .setDisabled(isLastPage),
    );


  return [row, buttonRow];
}

export default selectFeedComponents;
