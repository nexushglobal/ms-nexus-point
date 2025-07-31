import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WeeklyVolumeHistory } from './entities/weekly-volume-history.entity';
import { WeeklyVolume } from './entities/weekly-volume.entity';
import { WeeklyVolumeController } from './weekly-volume.controller';
import { WeeklyVolumeService } from './weekly-volume.service';
import { CommonModule } from 'src/common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WeeklyVolume, WeeklyVolumeHistory]),
    CommonModule,
  ],
  controllers: [WeeklyVolumeController],
  providers: [WeeklyVolumeService],
  exports: [WeeklyVolumeService, TypeOrmModule],
})
export class WeeklyVolumeModule {}
