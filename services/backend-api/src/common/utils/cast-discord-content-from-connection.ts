export const castDiscordContentForMedium = (content?: string) => {
  return content || `📰 | **{{title}}**\n\n{{link}}`;
};
