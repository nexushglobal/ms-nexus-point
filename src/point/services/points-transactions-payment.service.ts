import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PointsTransactionPayment } from '../entities/points-transaction-payment.entity';
import { Repository } from 'typeorm';

@Injectable()
export class PointsTransactionsPaymentService {
  constructor(
    @InjectRepository(PointsTransactionPayment)
    private readonly pointsTransactionsPaymentRepository: Repository<PointsTransactionPayment>,
  ) {}

  async findPaymentsByTransactionId(transactionId: string) {
    const payments = await this.pointsTransactionsPaymentRepository
      .createQueryBuilder('payment')
      .select(['payment.paymentId'])
      .where('payment.pointsTransaction = :transactionId', {
        transactionId: parseInt(transactionId),
      })
      .getMany();
    return payments.map((p) => ({ paymentId: p.paymentId.toString() }));
  }
}
