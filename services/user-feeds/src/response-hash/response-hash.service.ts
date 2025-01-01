import { MikroORM } from "@mikro-orm/core";
import { Injectable } from "@nestjs/common";
import logger from "../shared/utils/logger";
import { ResponseHash } from "./entities/response-hash.entity";

@Injectable()
export class ResponseHashService {
  constructor(private readonly orm: MikroORM) {}

  async set({ feedId, hash }: { hash: string; feedId: string }) {
    try {
      if (!hash) {
        throw new Error(`Hash is required`);
      }

      await this.orm.em.upsert(ResponseHash, {
        feed_id: feedId,
        hash,
        updated_at: new Date(),
      });
    } catch (err) {
      logger.error(`Failed to set in cache storage`, {
        err: (err as Error).stack,
        feedId,
      });
    }
  }

  async get({ feedId }: { feedId: string }): Promise<string | null> {
    return (
      (
        await this.orm.em.findOne(ResponseHash, {
          feed_id: feedId,
        })
      )?.hash || null
    );
  }

  async exists({
    feedId,
    hash,
  }: {
    feedId: string;
    hash: string;
  }): Promise<boolean> {
    return !!(await this.orm.em.findOne(
      ResponseHash,
      {
        feed_id: feedId,
        hash,
      },
      {
        fields: ["id"],
      }
    ));
  }

  async remove({ feedId }: { feedId: string }) {
    await this.orm.em.nativeDelete(ResponseHash, {
      feed_id: feedId,
    });
  }
}
