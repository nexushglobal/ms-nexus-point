import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserPoints } from '../point/entities/user-points.entity';
import { PointsTransaction } from '../point/entities/points-transaction.entity';
import { PointsTransactionPayment } from '../point/entities/points-transaction-payment.entity';
import { WeeklyVolume } from '../weekly-volume/entities/weekly-volume.entity';
import { WeeklyVolumeHistory } from '../weekly-volume/entities/weekly-volume-history.entity';
import { UserPointsMigrationController } from './controllers/user-points-migration.controller';
import { WeeklyVolumeMigrationController } from './controllers/weekly-volume-migration.controller';
import { UserPointsMigrationService } from './services/user-points-migration.service';
import { WeeklyVolumeMigrationService } from './services/weekly-volume-migration.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserPoints,
      PointsTransaction,
      PointsTransactionPayment,
      WeeklyVolume,
      WeeklyVolumeHistory,
    ]),
  ],
  controllers: [UserPointsMigrationController, WeeklyVolumeMigrationController],
  providers: [UserPointsMigrationService, WeeklyVolumeMigrationService],
  exports: [UserPointsMigrationService, WeeklyVolumeMigrationService],
})
export class MigrationModule {}
