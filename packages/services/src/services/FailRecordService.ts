import { inject, injectable } from 'inversify';
import { Db } from 'mongodb';
import { z } from 'zod';
import dayjs from 'dayjs';

const failRecordSchema = z.object({
  _id: z.string(),
  reason: z.string().optional(),
  failedAt: z.date().default(() => dayjs().toDate()),
  alerted: z.boolean().default(false),
});

export type FailRecordInput = z.input<typeof failRecordSchema>;
export type FailRecordOutput = z.output<typeof failRecordSchema>;


@injectable()
export default class FailRecordService {
  constructor(
    @inject('MongoDB') private readonly db: Db,
  ) {}

  static COLLECTION_NAME = 'fail_records';

  /**
   * Get the failure statuses of a set of urls.
   *
   * @param urls The URLs to check
   * @returns An array of booleans indicating whether each of the URLs have failed.
   */
  async getFailedStatuses(urls: string[]) {
    const records = await this.getCollection().find({
      _id: { $in: urls as any },
      failedAt: { $lt: this.getFailureThresholdDate() },
    }).toArray();

    const mapOfFailedRecordsByUrl = new Map(
      records.map(record => [record._id as unknown as string, record]),
    );

    const allUrlStatuses = urls.map(url => {
      const record = mapOfFailedRecordsByUrl.get(url);
      
      return record ? true : false;
    });

    return allUrlStatuses;
  }


  /**
   * Remove all fail records with the given urls.
   * 
   * @param urls The urls to remove
   */
  async removeUrls(urls: string[]) {
    await this.getCollection().deleteMany({
      _id: { $in: urls as any },
    });
  }
  
  /**
   * Check whether a date is past the failure threshold according to their initial failure date.
   * There is a grace period of 1 hour after a url's initial failure.
   *
   * @param date The date to check
   * @returns Whether the date is past the failure threshold
   */
  private getFailureThresholdDate() {
    return dayjs().subtract(1, 'hour').toDate();
  }
  
  private getCollection() {
    return this.db.collection(FailRecordService.COLLECTION_NAME);
  }
}
