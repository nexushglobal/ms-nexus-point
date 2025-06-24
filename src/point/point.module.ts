import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PointsTransactionPayment } from './entities/points-transaction-payment.entity';
import { PointsTransaction } from './entities/points-transaction.entity';
import { UserPoints } from './entities/user-points.entity';
import { PointController } from './point.controller';
import { PointService } from './point.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PointsTransaction,
      UserPoints,
      PointsTransactionPayment,
    ]),
  ],
  controllers: [PointController],
  providers: [PointService],
  exports: [PointService, TypeOrmModule],
})
export class PointModule {}
