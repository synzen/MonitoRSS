/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { UpdateQuery } from "mongoose";
import {
  User,
  UserDocument,
  UserModel,
  UserPreferences,
} from "./entities/user.entity";

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly userModel: UserModel) {}

  async initDiscordUser(
    discordUserId: string,
    data?: {
      email?: string;
    }
  ) {
    const found = await this.userModel
      .findOne({ discordUserId })
      .select("_id email")
      .lean();

    if (!found) {
      await this.userModel.create({
        discordUserId,
        email: data?.email,
      });
    } else if (!found.email && data?.email) {
      await this.userModel.updateOne(
        {
          _id: found._id,
        },
        {
          $set: {
            email: data.email,
          },
        }
      );
    }
  }

  async getByDiscordId(discordUserId: string): Promise<User | null> {
    const user = await this.userModel.findOne({ discordUserId }).lean();

    if (!user) {
      return null;
    }

    return user;
  }

  async getEmailsForAlerts(discordUserIds: string[]): Promise<string[]> {
    const users = await this.userModel
      .find({
        discordUserId: {
          $in: discordUserIds,
        },
        email: {
          $exists: true,
        },
        "preferences.alertOnDisabledFeeds": true,
      })
      .distinct("email");

    return users;
  }

  async updateUserByDiscordId(
    discordUserId: string,
    data: Partial<User>
  ): Promise<User | null> {
    const updateQuery: UpdateQuery<UserDocument> = {
      $set: {},
    };

    const hasPreferencesUpdate = Object.keys(data.preferences || {}).length > 0;

    if (hasPreferencesUpdate) {
      for (const key in data.preferences) {
        updateQuery.$set![`preferences.${key}`] =
          data.preferences[key as keyof UserPreferences];
      }
    }

    const user = await this.userModel.findOneAndUpdate(
      {
        discordUserId,
      },
      updateQuery,
      {
        new: true,
      }
    );

    if (!user) {
      return null;
    }

    return user;
  }
}
