import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PointsTransaction } from '../entities/points-transaction.entity';
import { Repository } from 'typeorm';
import { BaseService } from 'src/common/services/base.service';
import { FindPointsTransactionDto } from '../dto/find-weekly-volume.dto';

@Injectable()
export class PointsTransactionService extends BaseService<PointsTransaction> {
  constructor(
    @InjectRepository(PointsTransaction)
    private readonly pointsTransactionRepository: Repository<PointsTransaction>,
  ) {
    super(pointsTransactionRepository);
  }

  async getPointsTransactions(data: FindPointsTransactionDto) {
    const { userId, type, status, startDate, endDate, ...paginationDto } = data;
    const queryBuilder = this.pointsTransactionRepository
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
    const pointsTransactions = await queryBuilder.getMany();
    return this.findAllBase(pointsTransactions, paginationDto);
  }
}
