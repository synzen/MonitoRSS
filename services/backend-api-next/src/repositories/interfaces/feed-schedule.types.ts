export interface IFeedSchedule {
  id: string;
  name: string;
  keywords: string[];
  feeds: string[];
  refreshRateMinutes: number;
}

export interface IFeedScheduleRepository {
  findAllExcludingDefault(): Promise<IFeedSchedule[]>;
}
