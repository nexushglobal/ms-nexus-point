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

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PointsTransaction,
      UserPoints,
      PointsTransactionPayment,
    ]),
    EventEmitterModule.forRoot(),
    CommonModule,
  ],
  controllers: [
    UserPointsController,
    PointsTransactionController,
    PointsTransactionPaymentsController,
  ],
  providers: [
    UserPointsService,
    PointsEventsService,
    PointsTransactionService,
    PointsTransactionsPaymentService,
  ],
  exports: [
    UserPointsService,
    PointsEventsService,
    PointsTransactionService,
    TypeOrmModule,
  ],
})
export class PointModule {}
