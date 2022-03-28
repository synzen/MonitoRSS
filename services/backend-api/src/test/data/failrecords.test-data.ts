import { FailRecord } from '../../features/feeds/entities/fail-record.entity';

const boilerplate: FailRecord = {
  _id: 'https://www.google.com',
  alerted: false,
  failedAt: new Date(),
  reason: '',
};

export const createTestFailRecord = (
  override: { _id: string } & Partial<FailRecord>,
): FailRecord => ({
  ...boilerplate,
  ...override,
});
