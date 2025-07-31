import { Controller } from '@nestjs/common';
import { PointsTransactionService } from '../services/points-transaction.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { GetPointsTransactionsDto } from '../dto/get-points-transactions.dto';
import { GetUserPointsTransactionPaymentsDto } from '../dto/get-user-points-transaction-payments.dto';

@Controller('points-transaction')
export class PointsTransactionController {
  constructor(
    private readonly pointsTransactionService: PointsTransactionService,
  ) {}

  @MessagePattern({ cmd: 'pointsTransaction.get' })
  async getPointsTransactions(@Payload() data: GetPointsTransactionsDto) {
    return this.pointsTransactionService.getPointsTransactions(data);
  }

  @MessagePattern({ cmd: 'pointsTransaction.getUserPointsTransactionPayments' })
  async getUserPointsTransactionPayments(
    @Payload() data: GetUserPointsTransactionPaymentsDto,
  ) {
    return this.pointsTransactionService.getUserPointsTransactionPayments(
      data.id,
      data.userId,
      data.paginationDto,
    );
  }
}
