import { MikroORM } from "@mikro-orm/core";
import Feed from "./entities/Feed";
import { ObjectId } from '@mikro-orm/mongodb'
import log, { logDatadog } from "./utils/log";

export async function disableFeed(orm: MikroORM, feedId: string, reason: string) {
  try {
    const repo = orm.em.getRepository(Feed)
    await repo.nativeUpdate({
      _id: new ObjectId(feedId)
    }, {
      disabled: reason
    })
  } catch (err) {
    const errorMessage = `Failed to disable feed ${feedId}: ${(err as Error).message}`
    log.error(errorMessage)
    logDatadog('error', errorMessage, {
      stack: (err as Error).stack
    })
  }
}
