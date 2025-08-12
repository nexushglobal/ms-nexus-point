import { Controller } from '@nestjs/common';
import { PointsTransactionService } from '../services/points-transaction.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { GetPointsTransactionsDto } from '../dto/get-points-transactions.dto';
import { GetUserPointsTransactionPaymentsDto } from '../dto/get-user-points-transaction-payments.dto';
import { ApproveWithdrawalDto } from '../dto/approve-withdrawal.dto';
import { RejectWithdrawalDto } from '../dto/reject-withdrawal.dto';

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

  @MessagePattern({ cmd: 'pointsTransaction.reserveForWithdrawal' })
  async eligiblePointsTransactions(
    @Payload() data: { userId: string; amount: number },
  ) {
    return this.pointsTransactionService.reserveForWithdrawal(
      data.userId,
      data.amount,
    );
  }

  @MessagePattern({ cmd: 'points.approveWithdrawal' })
  async approveWithdrawal(
    @Payload() approveWithdrawalDto: ApproveWithdrawalDto,
  ) {
    return this.pointsTransactionService.approveWithdrawal(
      approveWithdrawalDto,
    );
  }

  @MessagePattern({ cmd: 'points.rejectWithdrawal' })
  async rejectWithdrawal(@Payload() rejectWithdrawalDto: RejectWithdrawalDto) {
    return this.pointsTransactionService.rejectWithdrawal(rejectWithdrawalDto);
  }
}
