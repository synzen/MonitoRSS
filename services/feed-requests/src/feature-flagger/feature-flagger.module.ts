import { DynamicModule, Module } from '@nestjs/common';
import { FeatureFlaggerService } from './feature-flagger.service';

@Module({})
export class FeatureFlaggerModule {
  static forRoot(): DynamicModule {
    return {
      module: FeatureFlaggerModule,
      providers: [FeatureFlaggerService],
      exports: [FeatureFlaggerService],
    };
  }
}
