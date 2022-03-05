import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PatronFeature } from './entities/patron.entity';
import { SupporterFeature } from './entities/supporter.entity';
import { SupportersService } from './supporters.service';

@Module({
  providers: [SupportersService],
  imports: [MongooseModule.forFeature([SupporterFeature, PatronFeature])],
  exports: [SupportersService],
})
export class SupportersModule {}
