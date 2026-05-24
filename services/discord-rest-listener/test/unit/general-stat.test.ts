import { describe, it, before, beforeEach, after } from "node:test"
import assert from "node:assert/strict"
import { MikroORM } from "@mikro-orm/mongodb"
import GeneralStat from "../../src/entities/GeneralStat"
import { setupTestEnvironment, type TestEnvironment } from "../helpers/setup-integration-tests"

describe("GeneralStat", () => {
  let env: TestEnvironment
  let orm: MikroORM

  before(async () => {
    env = setupTestEnvironment()
    orm = await MikroORM.init({
      entities: [GeneralStat],
      clientUrl: env.config.databaseURI,
      allowGlobalContext: true,
    })
  })

  beforeEach(async () => {
    await orm.em.getRepository(GeneralStat).nativeDelete({})
  })

  after(async () => {
    await orm.close(true)
    await env.drop()
  })

  describe("increaseNumericStat", () => {
    it("sets 1 for a stat that does not exist", async () => {
      await GeneralStat.increaseNumericStat(orm, "sumting")
      const found = await orm.em.findOne(GeneralStat, "sumting")
      assert.ok(found, "stat should be created")
      assert.equal(found!.data, 1)
    })

    it("adds 1 for a stat that does exist", async () => {
      const statId = "statexists"
      await orm.em.insert(GeneralStat, {
        _id: statId,
        data: 100,
        addedAt: new Date(),
      })
      await GeneralStat.increaseNumericStat(orm, statId)
      const found = await orm.em.findOne(GeneralStat, statId)
      assert.ok(found)
      assert.equal(found!.data, 101)
    })
  })
})
