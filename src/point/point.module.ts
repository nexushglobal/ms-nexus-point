import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PointsTransactionPayment } from './entities/points-transaction-payment.entity';
import { PointsTransaction } from './entities/points-transaction.entity';
import { UserPoints } from './entities/user-points.entity';
import { UserPointsController } from './controllers/user-points.controller';
import { UserPointsService } from './services/user-points.service';
import { CommonModule } from 'src/common/common.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PointsTransactionController } from './controllers/points-transaction.controller';
import { PointsEventsService } from './services/points-events.service';
import { PointsTransactionService } from './services/points-transaction.service';
import { PointsTransactionPaymentsController } from './controllers/points-transaction-payments.controller';
import { PointsTransactionsPaymentService } from './services/points-transactions-payment.service';
import { LotPointsTransactionController } from './controllers/points-lots-transaction.controller';
import { LotPointsTransactionService } from './services/points-lots-transaction.service';
import { LotPointsTransaction } from './entities/points-lots-transaction.entity';
import { WeeklyVolume } from '../weekly-volume/entities/weekly-volume.entity';
import { WeeklyVolumeHistory } from '../weekly-volume/entities/weekly-volume-history.entity';
import { MonthlyVolumeRank } from '../monthly_volume/entities/monthly_volume_ranks.entity';
import { UserRank } from '../rank/entities/user_ranks.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PointsTransaction,
      UserPoints,
      LotPointsTransaction,
      PointsTransactionPayment,
      WeeklyVolume,
      WeeklyVolumeHistory,
      MonthlyVolumeRank,
      UserRank,
    ]),
    EventEmitterModule.forRoot(),
    CommonModule,
  ],
  controllers: [
    UserPointsController,
    PointsTransactionController,
    PointsTransactionPaymentsController,
    LotPointsTransactionController,
  ],
  providers: [
    UserPointsService,
    PointsEventsService,
    PointsTransactionService,
    PointsTransactionsPaymentService,
    LotPointsTransactionService,
  ],
  exports: [
    UserPointsService,
    PointsEventsService,
    PointsTransactionService,
    LotPointsTransactionService,
    TypeOrmModule,
  ],
})
export class PointModule {}
