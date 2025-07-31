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
}
