import { inject, injectable } from 'inversify';
import { Db, ObjectId } from 'mongodb';
import { z } from 'zod';

const scheduleSchema = z.object({
  name: z.string(),
  refreshRateMinutes: z.number(),
  keywords: z.array(z.string()).default([]),
  feeds: z.array(z.string()).default([]),
});

export type ScheduleInput = z.input<typeof scheduleSchema>;
export type ScheduleOutput = z.output<typeof scheduleSchema> & {
  _id: ObjectId
};


@injectable()
export default class ScheduleService {
  constructor(
    @inject('MongoDB') private readonly db: Db,
  ) {}

  static COLLECTION_NAME = 'schedules' as const;

  async findAll(): Promise<ScheduleOutput[]> {
    return this.getCollection().find({}).toArray() as Promise<ScheduleOutput[]>;
  }

  private getCollection() {
    return this.db.collection(ScheduleService.COLLECTION_NAME);
  }
}
