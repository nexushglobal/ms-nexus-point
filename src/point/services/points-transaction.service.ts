import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PointsTransaction } from '../entities/points-transaction.entity';
import { Repository } from 'typeorm';
import { BaseService } from 'src/common/services/base.service';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { RpcException } from '@nestjs/microservices';
import { PointsTransactionPayment } from '../entities/points-transaction-payment.entity';
import { PaymentDetailResponseDto } from '../dto/payment-detail.dto';
import { GetUserPointsTransactionPaymentsResponseDto } from '../dto/get-user-points-transaction-payments.dto';
import {
  GetPointsTransactionsDto,
  GetPointsTransactionsResponseDto,
} from '../dto/get-points-transactions.dto';
import { Paginated } from 'src/common/dto/paginated.dto';

@Injectable()
export class PointsTransactionService extends BaseService<PointsTransaction> {
  private logger = new Logger(PointsTransactionService.name);
  constructor(
    @InjectRepository(PointsTransaction)
    private readonly pointsTransactionRepository: Repository<PointsTransaction>,
  ) {
    super(pointsTransactionRepository);
  }

  async getPointsTransactions(
    data: GetPointsTransactionsDto,
  ): Promise<Paginated<GetPointsTransactionsResponseDto>> {
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

  async getUserPointsTransactionPayments(
    id: number,
    userId: string,
    paginationDto: PaginationDto,
  ): Promise<GetUserPointsTransactionPaymentsResponseDto> {
    try {
      const getPointsTransactionDetails =
        await this.pointsTransactionRepository.findOne({
          where: { id, userId },
          relations: ['payments'],
        });
      if (!getPointsTransactionDetails)
        throw new RpcException({
          status: HttpStatus.NOT_FOUND,
          message: `Transacción de puntos con ID ${id} no encontrada`,
        });
      const { payments, ...restData } = getPointsTransactionDetails;
      const pointsTransactionsPaymentsDetails = this.paymentDetails(payments);
      const listPayments = await this.findAllBase(
        pointsTransactionsPaymentsDetails,
        paginationDto,
      );
      return {
        ...restData,
        listPayments,
      };
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      this.logger.error(
        `Error al obtener los pagos de la transacción de puntos: ${errorMessage}`,
      );
      throw error;
    }
  }

  paymentDetails(
    entity: PointsTransactionPayment[],
  ): PaymentDetailResponseDto[] {
    return entity.map((item) => {
      return {
        id: item.paymentId,
        amount: item.amount,
        paymentMethod: item.paymentMethod,
        paymentReference: item.paymentReference,
        notes: item.notes,
        createdAt: item.createdAt,
      };
    });
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object' && 'message' in error)
      return String(error.message);
    return 'Error desconocido';
  }
}
