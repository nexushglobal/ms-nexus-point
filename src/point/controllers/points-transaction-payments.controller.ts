import { Controller } from '@nestjs/common';
import { PointsTransactionsPaymentService } from '../services/points-transactions-payment.service';
import { MessagePattern, Payload } from '@nestjs/microservices';

@Controller()
export class PointsTransactionPaymentsController {
  constructor(
    private readonly pointsTransactionPaymentsService: PointsTransactionsPaymentService,
  ) {}

  @MessagePattern({ cmd: 'pointsTransactionPayments.findByTransactionId' })
  async findPaymentsByTransactionId(
    @Payload('transactionId') transactionId: string,
  ) {
    return this.pointsTransactionPaymentsService.findPaymentsByTransactionId(
      transactionId,
    );
  }
}
