import { ArrayMaxSize, IsEnum, IsMongoId } from 'class-validator';

export enum CloneFeedInputProperties {
  MESSAGE = 'MESSAGE',
  FITLERS = 'FILTERS',
  MISC_OPTIONS = 'MISC_OPTIONS',
  SUBSCRIBERS = 'SUBSCRIBERS',
  COMPARISONS = 'COMPARISONS',
  REGEXOPS = 'REGEXOPS',
  // FILTERED_FORMATS = 'FILTERED_FORMATS',
  WEBHOOK = 'WEBHOOK',
}

export class CloneFeedInputDto {
  @IsMongoId({ each: true })
  @ArrayMaxSize(500)
  targetFeedIds: string[];

  @IsEnum(CloneFeedInputProperties, {
    each: true,
  })
  properties: CloneFeedInputProperties[];
}
