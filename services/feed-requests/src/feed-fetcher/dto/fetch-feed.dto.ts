import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { URL } from 'url';

@ValidatorConstraint({ name: 'HTTPValidator' })
export class HttpValidator implements ValidatorConstraintInterface {
  validate(text: string) {
    const parsedUrl = new URL(text);

    if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
      return true;
    }

    return false;
  }

  defaultMessage() {
    return 'Must a HTTP URI';
  }
}

export class FetchFeedDto {
  @Validate(HttpValidator)
  url!: string;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  executeFetch?: boolean;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  executeFetchIfNotExists?: boolean;

  @IsString()
  @IsOptional()
  hashToCompare?: string;

  @IsBoolean()
  @Type(() => Boolean)
  @IsOptional()
  debug?: boolean;
}
