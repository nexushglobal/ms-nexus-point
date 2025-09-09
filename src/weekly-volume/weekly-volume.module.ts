import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WeeklyVolumeHistory } from './entities/weekly-volume-history.entity';
import { WeeklyVolume } from './entities/weekly-volume.entity';
import { WeeklyVolumeController } from './weekly-volume.controller';
import { WeeklyVolumeService } from './weekly-volume.service';
import { CommonModule } from 'src/common/common.module';
import { PointsTransaction } from 'src/point/entities/points-transaction.entity';
import { UserPoints } from 'src/point/entities/user-points.entity';
import { PointsTransactionPayment } from 'src/point/entities/points-transaction-payment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WeeklyVolume,
      WeeklyVolumeHistory,
      PointsTransaction,
      UserPoints,
      PointsTransactionPayment,
    ]),
    CommonModule,
  ],
  controllers: [WeeklyVolumeController],
  providers: [WeeklyVolumeService],
  exports: [WeeklyVolumeService, TypeOrmModule],
})
export class WeeklyVolumeModule {}
