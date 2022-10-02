export const EMBED_REQUIRES_ONE_OF = [
  'author.name',
  'title',
  'description',
  'footer.text',
  'image.url',
  'thumbnail.url',
] as const;

export const EMBED_REQUIRES_ONE_OF_ERROR_KEY = 'embedRequiresOneOf';
