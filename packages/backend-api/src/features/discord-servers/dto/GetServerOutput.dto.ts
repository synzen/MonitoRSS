class GetServerOutputProfileDto {
  dateFormat: string;
  dateLanguage: string;
  timezone: string;
}

export class GetServerOutputDto {
  result: {
    profile: GetServerOutputProfileDto;
  };
}
