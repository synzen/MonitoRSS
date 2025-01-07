import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Validate,
  ValidateNested,
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

class GetFeedRequestsLookupDetailsDto {
  @IsString()
  @IsNotEmpty()
  key!: string;

  @IsObject()
  @IsOptional()
  headers!: Record<string, string>;
}

export class FetchFeedDto {
  @Validate(HttpValidator)
  url!: string;

  @IsObject()
  @IsOptional()
  @Type(() => GetFeedRequestsLookupDetailsDto)
  @ValidateNested()
  lookupDetails?: GetFeedRequestsLookupDetailsDto;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  executeFetch?: boolean;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  executeFetchIfStale?: boolean;

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
