import { Module } from '@nestjs/common';
import { MonthlyVolumeService } from './monthly_volume.service';
import { MonthlyVolumeController } from './monthly_volume.controller';
import { MonthlyVolumeRank } from './entities/monthly_volume_ranks.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([MonthlyVolumeRank])],
  controllers: [MonthlyVolumeController],
  providers: [MonthlyVolumeService, TypeOrmModule],
})
export class MonthlyVolumeModule {}
