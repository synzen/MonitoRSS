import { MongooseModule } from '@nestjs/mongoose';
import {
  setupIntegrationTests,
  teardownIntegrationTests,
} from '../../utils/integration-tests';
import { MongooseTestModule } from '../../utils/mongoose-test.module';
import { FeedFeature } from './entities/Feed.entity';
import { FeedsService } from './feeds.service';

describe('FeedsService', () => {
  let service: FeedsService;

  beforeEach(async () => {
    const { module } = await setupIntegrationTests({
      providers: [FeedsService],
      imports: [
        MongooseTestModule.forRoot(),
        MongooseModule.forFeature([FeedFeature]),
      ],
    });

    service = module.get<FeedsService>(FeedsService);
  });

  afterEach(async () => {
    await teardownIntegrationTests();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
