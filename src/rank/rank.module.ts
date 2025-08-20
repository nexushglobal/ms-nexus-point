import { Module } from '@nestjs/common';
import { RankService } from './rank.service';
import { RankController } from './rank.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Rank } from './entities/rank.entity';
import { UserRank } from './entities/user_ranks.entity';
import { MonthlyVolumeRank } from '../monthly_volume/entities/monthly_volume_ranks.entity';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Rank, UserRank, MonthlyVolumeRank]),
    CommonModule,
  ],
  controllers: [RankController],
  providers: [RankService],
})
export class RankModule {}
