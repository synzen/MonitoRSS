export interface IFailRecord {
  id: string;
  reason?: string;
  failedAt: Date;
  alerted: boolean;
}

export interface IFailRecordRepository {}
