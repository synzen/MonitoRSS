import {
  forwardRef,
  Inject,
  mixin,
  NotFoundException,
  PipeTransform,
  Type,
  UnauthorizedException,
} from "@nestjs/common";
import { REQUEST } from "@nestjs/core";
import { Types } from "mongoose";
import { FastifyRequest } from "fastify";
import { getAccessTokenFromRequest } from "../../discord-auth/utils/get-access-token-from-session";
import { memoize } from "lodash";
import { NoPermissionException } from "../exceptions";
import {
  UserFeedManagerStatus,
  UserFeedManagerType,
} from "../../user-feed-management-invites/constants";
import { InjectModel } from "@nestjs/mongoose";
import { UserFeed, UserFeedModel } from "../entities";
import { ConfigService } from "@nestjs/config";
import { UserFeedConnection } from "../types";
import { UsersService } from "../../users/users.service";

interface PipeOptions {
  userTypes: UserFeedManagerType[];
}

export type GetUserFeedsPipeOutput = Array<{
  feed: UserFeed;
}>;

const createGetUserFeedsPipe = (
  { userTypes }: PipeOptions = {
    userTypes: [UserFeedManagerType.Creator, UserFeedManagerType.SharedManager],
  }
): Type<PipeTransform> => {
  class GetUserFeedsPipe implements PipeTransform {
    constructor(
      @InjectModel(UserFeed.name)
      private readonly userFeedModel: UserFeedModel,
      @Inject(forwardRef(() => REQUEST))
      private readonly request: FastifyRequest,
      private readonly configService: ConfigService,
      private readonly usersService: UsersService
    ) {}

    async transform(
      inputFeedIds: string[] | string
    ): Promise<GetUserFeedsPipeOutput> {
      if (!inputFeedIds) {
        return [];
      }

      const feedIds = (
        Array.isArray(inputFeedIds) ? inputFeedIds : [inputFeedIds]
      ).filter((value, index, self) => self.indexOf(value) === index);

      if (feedIds.some((id) => !Types.ObjectId.isValid(id))) {
        throw new NotFoundException(
          `Some feed IDs are invalid Object Ids: ${feedIds.join(",")}`
        );
      }

      const accessToken = getAccessTokenFromRequest(this.request);

      if (!accessToken) {
        throw new UnauthorizedException();
      }

      const [allFound, user] = await Promise.all([
        this.userFeedModel
          .find({
            _id: {
              $in: feedIds,
            },
          })
          .lean(),
        this.usersService.getOrCreateUserByDiscordId(accessToken.discord.id),
      ]);

      const adminIds = this.configService.get<string[]>(
        "BACKEND_API_ADMIN_USER_IDS"
      );

      const isAdmin = adminIds?.includes(user._id.toString());

      if (allFound.length !== feedIds.length) {
        throw new NotFoundException(`Some or all feeds do not exist`);
      }

      const filtered = (
        await Promise.all(
          allFound.map(async (found) => {
            const allowLegacyReversion =
              !!this.configService.get("BACKEND_API_ALLOW_LEGACY_REVERSION") ||
              found.allowLegacyReversion;

            if (isAdmin) {
              return {
                ...found,
                allowLegacyReversion,
              };
            }

            const allowOwner =
              userTypes.includes(UserFeedManagerType.Creator) &&
              found?.user.discordUserId === accessToken.discord.id;

            const sharedManagerInvite =
              found?.shareManageOptions?.invites?.find(
                (u) =>
                  u.discordUserId === accessToken.discord.id &&
                  u.status === UserFeedManagerStatus.Accepted
              );

            const allowSharedManager =
              userTypes.includes(UserFeedManagerType.SharedManager) &&
              !!sharedManagerInvite;

            if (sharedManagerInvite && !allowSharedManager) {
              throw new NoPermissionException();
            }

            if (!found || (!allowOwner && !allowSharedManager)) {
              return null;
            }

            const filteredConnections = found.connections;
            const sharedManagerConnectionIds =
              sharedManagerInvite?.connections?.map((c) => c.connectionId);

            if (sharedManagerConnectionIds?.length) {
              const keys = Object.keys(filteredConnections) as Array<
                keyof UserFeed["connections"]
              >;
              keys.forEach((connectionKey) => {
                if (Array.isArray(filteredConnections[connectionKey])) {
                  filteredConnections[connectionKey] = (
                    filteredConnections[connectionKey] as UserFeedConnection[]
                  ).filter((c) => {
                    return sharedManagerConnectionIds.find((id) =>
                      id.equals(c.id)
                    );
                  }) as never;
                }
              });
            }

            return {
              ...found,
              allowLegacyReversion,
            };
          })
        )
      ).filter((f) => !!f) as UserFeed[];

      return filtered.map((feed) => ({
        feed,
      }));
    }
  }

  return mixin(GetUserFeedsPipe);
};

export const GetUserFeedsPipe: (data?: PipeOptions) => Type<PipeTransform> =
  memoize(createGetUserFeedsPipe);
