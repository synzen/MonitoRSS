import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { WorkspaceMongooseRepository } from "../../src/repositories/mongoose/workspace.mongoose.repository";
import { UserMongooseRepository } from "../../src/repositories/mongoose/user.mongoose.repository";
import {
  createServiceTestContext,
  type ServiceTestContext,
} from "../helpers/test-context";
import { generateTestId, generateSnowflake } from "../helpers/test-id";

describe(
  "WorkspaceMongooseRepository Integration",
  { concurrency: true },
  () => {
    let testContext: ServiceTestContext;
    let workspaceRepository: WorkspaceMongooseRepository;
    let userRepository: UserMongooseRepository;

    before(async () => {
      testContext = await createServiceTestContext();
      workspaceRepository = new WorkspaceMongooseRepository(
        testContext.connection,
      );
      userRepository = new UserMongooseRepository(testContext.connection);
    });

    after(() => testContext.teardown());

    async function createUser(options: {
      email?: string;
      verifiedEmail?: string;
      alertOnDisabledFeeds?: boolean;
    }) {
      const discordUserId = generateSnowflake();
      const user = await userRepository.create({
        discordUserId,
        email: options.email,
      });

      if (options.verifiedEmail) {
        await userRepository.setVerifiedEmail(user.id, options.verifiedEmail);
      }

      if (options.alertOnDisabledFeeds !== undefined) {
        await userRepository.updatePreferencesByDiscordId(discordUserId, {
          alertOnDisabledFeeds: options.alertOnDisabledFeeds,
        });
      }

      return user;
    }

    async function addMember(
      workspaceId: string,
      invitedByUserId: string,
      userId: string,
      email: string,
    ) {
      const inviteId = generateTestId();
      await workspaceRepository.createInvite({
        id: inviteId,
        workspaceId,
        email,
        role: "admin",
        invitedByUserId,
      });
      const accepted = await workspaceRepository.acceptInvite({
        inviteId,
        userId,
      });
      assert.strictEqual(accepted, true);
    }

    describe("getMemberAlertEmails", () => {
      it("returns only members who opted into disabled-feed alerts", async () => {
        const owner = await createUser({
          email: "owner@test.com",
          alertOnDisabledFeeds: true,
        });
        const optedOut = await createUser({
          email: "opted-out@test.com",
          alertOnDisabledFeeds: false,
        });
        const noPreference = await createUser({
          email: "no-preference@test.com",
        });

        const workspace = await workspaceRepository.createWorkspaceWithOwner({
          name: "Alerts Workspace",
          slug: `alerts-${generateTestId()}`,
          ownerUserId: owner.id,
        });
        await addMember(
          workspace.id,
          owner.id,
          optedOut.id,
          "opted-out@test.com",
        );
        await addMember(
          workspace.id,
          owner.id,
          noPreference.id,
          "no-preference@test.com",
        );

        const emails = await workspaceRepository.getMemberAlertEmails(
          workspace.id,
        );

        assert.deepStrictEqual(emails, ["owner@test.com"]);
      });

      it("prefers the verified email over the Discord email", async () => {
        const owner = await createUser({
          email: "discord@test.com",
          verifiedEmail: `verified-${generateTestId()}@test.com`,
          alertOnDisabledFeeds: true,
        });

        const workspace = await workspaceRepository.createWorkspaceWithOwner({
          name: "Verified Workspace",
          slug: `verified-${generateTestId()}`,
          ownerUserId: owner.id,
        });

        const emails = await workspaceRepository.getMemberAlertEmails(
          workspace.id,
        );

        assert.strictEqual(emails.length, 1);
        assert.ok(emails[0]!.startsWith("verified-"));
      });

      it("does not return members of other workspaces", async () => {
        const ownerA = await createUser({
          email: "owner-a@test.com",
          alertOnDisabledFeeds: true,
        });
        const ownerB = await createUser({
          email: "owner-b@test.com",
          alertOnDisabledFeeds: true,
        });

        const workspaceA = await workspaceRepository.createWorkspaceWithOwner({
          name: "Workspace A",
          slug: `iso-a-${generateTestId()}`,
          ownerUserId: ownerA.id,
        });
        await workspaceRepository.createWorkspaceWithOwner({
          name: "Workspace B",
          slug: `iso-b-${generateTestId()}`,
          ownerUserId: ownerB.id,
        });

        const emails = await workspaceRepository.getMemberAlertEmails(
          workspaceA.id,
        );

        assert.deepStrictEqual(emails, ["owner-a@test.com"]);
      });
    });
  },
);
