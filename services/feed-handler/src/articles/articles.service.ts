import { InjectRepository } from "@mikro-orm/nestjs";
import { EntityRepository } from "@mikro-orm/postgresql";
import { Injectable } from "@nestjs/common";
import { FeedArticleField } from "./entities";

@Injectable()
export class ArticlesService {
  constructor(
    @InjectRepository(FeedArticleField)
    private readonly articleFieldRepo: EntityRepository<FeedArticleField>
  ) {}
}
