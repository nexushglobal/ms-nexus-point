/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { BaseService } from 'src/common/services/base.service';
import { FindPointsTransactionDto } from '../dto/find-weekly-volume.dto';
import {
  LotPointsTransaction,
  LotPointTransactionStatus,
  LotPointTransactionType,
} from '../entities/points-lots-transaction.entity';
import { CreateLotPointsDto } from '../dto/create-lot-direct-bonus.dto';
import { UserPoints } from '../entities/user-points.entity';

@Injectable()
export class LotPointsTransactionService extends BaseService<LotPointsTransaction> {
  private readonly logger = new Logger(LotPointsTransactionService.name);

  constructor(
    @InjectRepository(LotPointsTransaction)
    private readonly lotPointsTransactionRepository: Repository<LotPointsTransaction>,
    @InjectRepository(UserPoints)
    private readonly userPointsRepository: Repository<UserPoints>,
    private readonly dataSource: DataSource,
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

  async createLotPoints(createLotPointsDto: CreateLotPointsDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      this.logger.log(
        `Iniciando asignación de puntos de lotes para usuario ${createLotPointsDto.userId}`,
      );

      const { userId, userName, userEmail, points, reference } =
        createLotPointsDto;

      // 1. Obtener o crear UserPoints
      let userPoints = await this.userPointsRepository.findOne({
        where: { userId },
      });

      if (!userPoints) {
        userPoints = this.userPointsRepository.create({
          userId,
          userName,
          userEmail,
          availablePoints: 0,
          totalEarnedPoints: 0,
          totalWithdrawnPoints: 0,
          availableLotPoints: 0,
          totalEarnedLotPoints: 0,
          totalWithdrawnLotPoints: 0,
        });
      }

      // 2. Actualizar puntos de lotes
      userPoints.availableLotPoints =
        Number(userPoints.availableLotPoints) + Number(points);
      userPoints.totalEarnedLotPoints =
        Number(userPoints.totalEarnedLotPoints) + Number(points);

      const savedUserPoints = await queryRunner.manager.save(userPoints);

      // 3. Crear transacción de lote para historial
      const lotTransaction = this.lotPointsTransactionRepository.create({
        userId,
        userName,
        userEmail,
        type: LotPointTransactionType.LOT_DIRECT_BONUS,
        amount: points,
        pendingAmount: 0,
        withdrawnAmount: 0,
        status: LotPointTransactionStatus.COMPLETED,
        isArchived: false,
      });

      const savedTransaction = await queryRunner.manager.save(lotTransaction);

      await queryRunner.commitTransaction();

      this.logger.log(
        `Puntos de lote procesados para usuario ${userId}: ${points} puntos${reference ? ` (Ref: ${reference})` : ''}`,
      );
      const { createdAt, updatedAt, ...restTransaction } = savedTransaction;
      return restTransaction;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      const errorMessage = this.getErrorMessage(error);
      this.logger.error(
        `Error en asignación de puntos de lotes: ${errorMessage}`,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object' && 'message' in error)
      return String(error.message);
    return 'Error desconocido';
  }
}
