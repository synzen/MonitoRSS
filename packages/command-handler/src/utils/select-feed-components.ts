import { MessageActionRow, MessageButton, MessageSelectMenu } from 'discord.js';
import { InteractionServices } from '../interaction-handlers/interaction-container.type';
import  {
  InteractionPaginationData,
} from '../interaction-handlers/interaction-custom-id.type';
import { InteractionTask } from '../interaction-handlers/interaction-tasks.constants';
import createInteractionCustomId from './create-interaction-custom-id';

const FEEDS_PER_PAGE = 10;

async function selectFeedComponents(
  interactionServices: InteractionServices,
  guildId: string,
  channelId: string,
  finalTask: InteractionTask,
  currentPageNumber = 0,
) {
  if (currentPageNumber == null || isNaN(currentPageNumber)) {
    throw new Error('currentPageNumber must be a number');
  }

  const [
    totalFeedCount,
    feeds,
  ] = await Promise.all([
    interactionServices.feedService.count({
      guild: guildId,
      channel: channelId,
    }),
    interactionServices.feedService.find({
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

  const selectMenuCustomId = createInteractionCustomId({
    task: InteractionTask.LIST_FEEDS,
    finalTask,
    executeFinalTask: true,
    data: {
      pageNumber: currentPageNumber,
    },
  });

  const row = new MessageActionRow()
    .addComponents(
      new MessageSelectMenu()
        .setCustomId(selectMenuCustomId)
        .setPlaceholder('Please select a feed')
        .setMaxValues(feeds.length)
        .addOptions(feeds.map(feed => ({
          label: feed.title,
          value: feed._id.toHexString(),
          description: `${feed.url}`,
        }))),
    );

  const previousButtonCustomId = createInteractionCustomId<InteractionPaginationData>({
    finalTask,
    task: InteractionTask.ON_CLICK_PREVIOUS_PAGE,
    data: {
      pageNumber: previousPageNumber,
    },
  });

  const nextButtonCustomId = createInteractionCustomId<InteractionPaginationData>({
    finalTask,
    task: InteractionTask.ON_CLICK_NEXT_PAGE,
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
