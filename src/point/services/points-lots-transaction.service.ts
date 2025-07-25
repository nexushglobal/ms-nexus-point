import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseService } from 'src/common/services/base.service';
import { FindPointsTransactionDto } from '../dto/find-weekly-volume.dto';
import { LotPointsTransaction } from '../entities/points-lots-transaction.entity';

@Injectable()
export class LotPointsTransactionService extends BaseService<LotPointsTransaction> {
  constructor(
    @InjectRepository(LotPointsTransaction)
    private readonly lotPointsTransactionRepository: Repository<LotPointsTransaction>,
  ) {
    super(lotPointsTransactionRepository);
  }

  async getLotPointsTransactions(data: FindPointsTransactionDto) {
    const { userId, type, status, startDate, endDate, ...paginationDto } = data;
    const queryBuilder = this.lotPointsTransactionRepository
      .createQueryBuilder('transaction')
      .where('transaction.userId = :userId', { userId });

    if (type) queryBuilder.andWhere('transaction.type = :type', { type });
    if (status)
      queryBuilder.andWhere('transaction.status = :status', { status });
    if (startDate)
      queryBuilder.andWhere('transaction.createdAt >= :startDate', {
        startDate: new Date(startDate),
      });
    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      queryBuilder.andWhere('transaction.createdAt <= :endDate', {
        endDate: endOfDay,
      });
    }
    queryBuilder.orderBy('transaction.createdAt', 'DESC');
    const lotPointsTransactions = await queryBuilder.getMany();
    return this.findAllBase(lotPointsTransactions, paginationDto);
  }
}
