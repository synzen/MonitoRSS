import { Type } from "class-transformer";
import {
  Allow,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsString,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import {
  FeedConnectionDiscordComponentButtonStyle,
  FeedConnectionDiscordComponentType,
} from "../../features/feeds/constants";

class DiscordBaseComponent {
  @IsString()
  id: string;

  @IsIn(Object.values(FeedConnectionDiscordComponentType))
  type: FeedConnectionDiscordComponentType;
}

export class DiscordButtonComponent extends DiscordBaseComponent {
  @IsIn([FeedConnectionDiscordComponentType.Button])
  type: FeedConnectionDiscordComponentType.Button;

  @IsString()
  @IsNotEmpty()
  label: string;

  @IsString()
  @IsNotEmpty()
  @Allow()
  @ValidateIf((o) => o.style === FeedConnectionDiscordComponentButtonStyle.Link)
  url?: string;

  @IsIn(Object.values(FeedConnectionDiscordComponentButtonStyle))
  style: FeedConnectionDiscordComponentButtonStyle;
}

export class DiscordComponentRow {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DiscordButtonComponent, {
    keepDiscriminatorProperty: true,
    discriminator: {
      property: "type",
      subTypes: [
        {
          value: DiscordButtonComponent,
          name: FeedConnectionDiscordComponentType.Button as unknown as string,
        },
      ],
    },
  })
  components: Array<DiscordButtonComponent>;
}
