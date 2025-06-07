import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Types } from "mongoose";
import { UserFeedTag, UserFeedTagModel } from "./entities/user-feed-tag.entity";
import { CreateUserFeedTagInputDto } from "./dto/create-user-feed-tag-input.dto";
import { UpdateUserFeedTagInputDto } from "./dto/update-user-feed-tag-input.dto";

@Injectable()
export class UserFeedTagsService {
  constructor(
    @InjectModel(UserFeedTag.name)
    private readonly userFeedTagModel: UserFeedTagModel
  ) {}

  async getUserFeedTags(userId: Types.ObjectId): Promise<UserFeedTag[]> {
    return this.userFeedTagModel.find({ userId }).sort({ createdAt: 1 }).lean();
  }

  async createUserFeedTag(
    userId: Types.ObjectId,
    dto: CreateUserFeedTagInputDto
  ): Promise<UserFeedTag> {
    const newTag = await this.userFeedTagModel.create({
      label: dto.label,
      color: dto.color,
      feedIds: [],
      userId,
    });

    return newTag;
  }

  async updateUserFeedTag(
    userId: Types.ObjectId,
    tagId: string,
    dto: UpdateUserFeedTagInputDto
  ): Promise<UserFeedTag | null> {
    const updateData: Partial<UserFeedTag> = {};

    if (dto.label !== undefined) {
      updateData.label = dto.label;
    }

    if (dto.color !== undefined) {
      updateData.color = dto.color;
    }

    const updatedTag = await this.userFeedTagModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(tagId),
        userId,
      },
      updateData,
      { new: true }
    );

    return updatedTag;
  }

  async deleteUserFeedTag(
    userId: Types.ObjectId,
    tagId: string
  ): Promise<number> {
    const { deletedCount } = await this.userFeedTagModel.deleteOne({
      _id: new Types.ObjectId(tagId),
      userId,
    });

    return deletedCount;
  }

  formatForHttpResponse(tags: UserFeedTag[]) {
    return {
      results: tags.map((tag) => ({
        id: tag._id.toHexString(),
        label: tag.label,
        color: tag.color,
        feedIds: tag.feedIds.map((id) => id.toHexString()),
      })),
    };
  }

  formatSingleForHttpResponse(tag: UserFeedTag) {
    return {
      id: tag._id.toHexString(),
      label: tag.label,
      color: tag.color,
      feedIds: tag.feedIds.map((id) => id.toHexString()),
    };
  }
}
