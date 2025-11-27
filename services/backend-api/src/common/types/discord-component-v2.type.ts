import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { FeedConnectionDiscordComponentType } from "../../features/feeds/constants";

// --- Shared Types ---

export class DiscordEmojiV2Dto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsOptional()
  name?: string | null;

  @IsBoolean()
  @IsOptional()
  animated?: boolean | null;
}

export class DiscordMediaV2Dto {
  @IsString()
  @IsNotEmpty()
  url: string;
}

// --- Leaf Components ---

export class DiscordTextDisplayV2Dto {
  @IsIn([FeedConnectionDiscordComponentType.TextDisplay])
  type: FeedConnectionDiscordComponentType.TextDisplay;

  @IsString()
  @IsNotEmpty()
  content: string;
}

export class DiscordThumbnailV2Dto {
  @IsIn([FeedConnectionDiscordComponentType.Thumbnail])
  type: FeedConnectionDiscordComponentType.Thumbnail;

  @ValidateNested()
  @Type(() => DiscordMediaV2Dto)
  media: DiscordMediaV2Dto;

  @IsString()
  @IsOptional()
  @MaxLength(1024)
  description?: string | null;

  @IsBoolean()
  @IsOptional()
  spoiler?: boolean;
}

export class DiscordButtonV2Dto {
  @IsIn([FeedConnectionDiscordComponentType.Button])
  type: FeedConnectionDiscordComponentType.Button;

  @IsInt()
  @Min(1)
  @Max(6)
  style: number;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  label?: string;

  @ValidateNested()
  @Type(() => DiscordEmojiV2Dto)
  @IsOptional()
  emoji?: DiscordEmojiV2Dto | null;

  @IsString()
  @IsOptional()
  @MaxLength(512)
  url?: string | null;

  @IsBoolean()
  @IsOptional()
  disabled?: boolean;
}

// --- Section Component ---

export class DiscordSectionV2Dto {
  @IsIn([FeedConnectionDiscordComponentType.Section])
  type: FeedConnectionDiscordComponentType.Section;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => DiscordTextDisplayV2Dto)
  components: DiscordTextDisplayV2Dto[];

  @ValidateNested()
  @Type(() => DiscordButtonV2Dto, {
    keepDiscriminatorProperty: true,
    discriminator: {
      property: "type",
      subTypes: [
        {
          value: DiscordButtonV2Dto,
          name: FeedConnectionDiscordComponentType.Button as unknown as string,
        },
        {
          value: DiscordThumbnailV2Dto,
          name: FeedConnectionDiscordComponentType.Thumbnail as unknown as string,
        },
      ],
    },
  })
  accessory: DiscordButtonV2Dto | DiscordThumbnailV2Dto;
}

// --- Action Row Component ---

export class DiscordActionRowV2Dto {
  @IsIn([FeedConnectionDiscordComponentType.ActionRow])
  type: FeedConnectionDiscordComponentType.ActionRow;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => DiscordButtonV2Dto)
  components: DiscordButtonV2Dto[];
}

// --- Top-Level Component (Union type) ---

export type DiscordComponentV2Dto = DiscordSectionV2Dto | DiscordActionRowV2Dto;

// Discriminator options for @Type decorator - use with arrays of componentsV2
export const DiscordComponentV2TypeOptions = {
  keepDiscriminatorProperty: true,
  discriminator: {
    property: "type",
    subTypes: [
      {
        value: DiscordSectionV2Dto,
        name: FeedConnectionDiscordComponentType.Section as unknown as string,
      },
      {
        value: DiscordActionRowV2Dto,
        name: FeedConnectionDiscordComponentType.ActionRow as unknown as string,
      },
    ],
  },
};
