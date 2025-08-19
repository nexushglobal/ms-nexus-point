import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  PointsTransaction,
  PointTransactionStatus,
  PointTransactionType,
} from '../entities/points-transaction.entity';
import { DataSource, In, Repository } from 'typeorm';
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
import { UserPointsService } from './user-points.service';
import { ReserveForWithdrawal } from '../dto/reserve-for-withdrawal.dto';
import { ApproveWithdrawalDto } from '../dto/approve-withdrawal.dto';
import { RejectWithdrawalDto } from '../dto/reject-withdrawal.dto';

@Injectable()
export class PointsTransactionService extends BaseService<PointsTransaction> {
  private logger = new Logger(PointsTransactionService.name);
  constructor(
    @InjectRepository(PointsTransaction)
    private readonly pointsTransactionRepository: Repository<PointsTransaction>,
    private readonly userPointsService: UserPointsService,
    private readonly dataSource: DataSource,
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

  async reserveForWithdrawal(
    userId: string,
    userEmail: string,
    userName: string,
    amount: number,
  ): Promise<ReserveForWithdrawal> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Verificar puntos del usuario
      const userPoints = await this.userPointsService.findOne(userId);
      if (!userPoints)
        throw new RpcException({
          status: HttpStatus.BAD_REQUEST,
          message: 'No tienes puntos registrados',
        });

      if (userPoints.availablePoints < amount)
        throw new RpcException({
          status: HttpStatus.BAD_REQUEST,
          message: `No tienes suficientes puntos disponibles. Puntos disponibles: ${userPoints.availablePoints}`,
        });

      // 2. Obtener transacciones elegibles
      const eligiblePointsTransactions =
        await this.pointsTransactionRepository.find({
          where: {
            userId: userId,
            type: In([
              PointTransactionType.BINARY_COMMISSION,
              PointTransactionType.DIRECT_BONUS,
            ]),
            status: PointTransactionStatus.COMPLETED,
            isArchived: false,
          },
          order: { createdAt: 'ASC' },
        });

      // 3. Hacer el for para reservar
      let remainingAmountToWithdraw = amount;
      const pointsTransactionsToLink: PointsTransaction[] = [];
      const transactionAmounts: Map<number, number> = new Map();

      for (const transaction of eligiblePointsTransactions) {
        const availableAmountInTransaction =
          transaction.amount -
          (transaction.pendingAmount || 0) -
          (transaction.withdrawnAmount || 0);

        if (availableAmountInTransaction <= 0) continue;
        if (remainingAmountToWithdraw <= 0) break;

        const amountToDeduct = Math.min(
          remainingAmountToWithdraw,
          availableAmountInTransaction,
        );

        transaction.pendingAmount =
          (transaction.pendingAmount || 0) + amountToDeduct;
        pointsTransactionsToLink.push(transaction);
        transactionAmounts.set(transaction.id, amountToDeduct);
        remainingAmountToWithdraw -= amountToDeduct;
      }
      // 4. Verificar si se cubrió el monto
      if (remainingAmountToWithdraw > 0)
        throw new RpcException({
          status: HttpStatus.BAD_REQUEST,
          message: `No se pudieron seleccionar suficientes puntos archivados disponibles para el retiro. Faltan: ${remainingAmountToWithdraw}`,
        });
      // 5. Guardar las transacciones modificadas
      await queryRunner.manager.save(pointsTransactionsToLink);
      // 6. Actualizar puntos del usuario
      userPoints.availablePoints = Number(userPoints.availablePoints) - amount;
      userPoints.totalWithdrawnPoints =
        Number(userPoints.totalWithdrawnPoints) + amount;
      await queryRunner.manager.save(userPoints);

      // 7. Crear transacción WITHDRAWAL
      const pointsTransaction = this.pointsTransactionRepository.create({
        userId,
        userEmail: userEmail,
        userName: userName,
        type: PointTransactionType.WITHDRAWAL,
        amount,
        status: PointTransactionStatus.PENDING,
        metadata: {
          'Monto solicitado': amount,
          'Puntos disponibles': userPoints.availablePoints + amount,
          'Fecha de solicitud': new Date(),
        },
      });
      await queryRunner.manager.save(pointsTransaction);

      await queryRunner.commitTransaction();

      return {
        success: true,
        pointsTransaction: pointsTransactionsToLink.map((transaction) => {
          const amountUsedThisTransaction =
            transactionAmounts.get(transaction.id) || 0;
          return {
            id: transaction.id,
            amount: transaction.amount,
            pendingAmount: transaction.pendingAmount,
            type: transaction.type,
            amountUsed: amountUsedThisTransaction,
            originalAmount: transaction.amount,
            metadata: {
              tipo_transaccion: transaction.type,
              monto_original: transaction.amount,
              monto_usado_retiro: amountUsedThisTransaction,
              estado_transaccion: transaction.status,
              monto_pendiente_original: transaction.pendingAmount,
              monto_retirado_original: transaction.withdrawnAmount || 0,
              fecha_creacion: transaction.createdAt,
              metadata_original: transaction.metadata,
            },
          };
        }),
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (error instanceof RpcException) throw error;
      const errorMessage = this.getErrorMessage(error);
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: `Error al reservar puntos para retiro: ${errorMessage}`,
      });
    } finally {
      await queryRunner.release();
    }
  }

  async approveWithdrawal(
    aproveWithdrawalDto: ApproveWithdrawalDto,
  ): Promise<{ message: string }> {
    const {
      withdrawalId,
      userId,
      reviewerId,
      reviewerEmail,
      withdrawalPoints,
    } = aproveWithdrawalDto;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      this.logger.log(
        `Aprobando retiro ${withdrawalId} para usuario ${userId}`,
      );
      // 1. Iterar sobre los WithdrawalPoints y actualizar las transacciones de puntos
      for (const wp of withdrawalPoints) {
        const pointsTransaction =
          await this.pointsTransactionRepository.findOne({
            where: { id: parseInt(wp.pointsTransactionId) },
          });

        if (pointsTransaction) {
          // Lógica exacta del original
          pointsTransaction.withdrawnAmount =
            (pointsTransaction.withdrawnAmount || 0) + wp.amountUsed;
          pointsTransaction.pendingAmount = 0; // ✅ Restar específicamente

          if (
            pointsTransaction.amount - pointsTransaction.withdrawnAmount ===
            0
          ) {
            pointsTransaction.isArchived = true;
          }

          await queryRunner.manager.save(pointsTransaction);
        }
      }

      // 2. Buscar la transacción de puntos WITHDRAWAL correspondiente
      const pointsTransaction = await this.pointsTransactionRepository.findOne({
        where: {
          userId,
          type: PointTransactionType.WITHDRAWAL,
          status: PointTransactionStatus.PENDING,
        },
        order: { createdAt: 'DESC' },
      });

      if (pointsTransaction) {
        pointsTransaction.status = PointTransactionStatus.COMPLETED;
        pointsTransaction.metadata = {
          ...pointsTransaction.metadata,
          withdrawalId: withdrawalId.toString(),
          withdrawalStatus: 'APPROVED',
          approvedAt: new Date(),
          approvedBy: reviewerId,
          approvedByEmail: reviewerEmail,
        };

        await queryRunner.manager.save(pointsTransaction);
      } else {
        this.logger.warn(
          `No se encontró transacción de puntos para el retiro ${withdrawalId}`,
        );
      }

      await queryRunner.commitTransaction();

      this.logger.log(
        `Retiro ${withdrawalId} aprobado exitosamente en points service`,
      );

      return {
        message: 'Puntos actualizados exitosamente para retiro aprobado',
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error aprobando retiro ${withdrawalId}: ${error}`);

      if (error instanceof RpcException) throw error;

      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error interno aprobando retiro en points service',
      });
    } finally {
      await queryRunner.release();
    }
  }

  async rejectWithdrawal(
    rejectWithdrawalDto: RejectWithdrawalDto,
  ): Promise<{ message: string }> {
    const {
      withdrawalId,
      userId,
      amount,
      reviewerId,
      reviewerEmail,
      rejectionReason,
      withdrawalPoints,
    } = rejectWithdrawalDto;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      this.logger.log(
        `Rechazando retiro ${withdrawalId} para usuario ${userId}`,
      );

      // 1. Iterar sobre los WithdrawalPoints y restaurar pendingAmount a 0
      for (const wp of withdrawalPoints) {
        const pointsTransaction =
          await this.pointsTransactionRepository.findOne({
            where: { id: parseInt(wp.pointsTransactionId) },
          });

        if (pointsTransaction) {
          pointsTransaction.pendingAmount = 0;
          await queryRunner.manager.save(pointsTransaction);
        }
      }
      // 2. Buscar y cancelar la transacción WITHDRAWAL
      const pointsTransaction = await this.pointsTransactionRepository.findOne({
        where: {
          userId,
          type: PointTransactionType.WITHDRAWAL,
          status: PointTransactionStatus.PENDING,
        },
        order: { createdAt: 'DESC' },
      });

      if (pointsTransaction) {
        pointsTransaction.status = PointTransactionStatus.CANCELLED;
        pointsTransaction.metadata = {
          ...pointsTransaction.metadata,
          withdrawalId: withdrawalId.toString(),
          'Estado de Retiro': 'Cancelado',
          'Motivo de Rechazo': rejectionReason,
          rejectedAt: new Date(),
          rejectedBy: reviewerId,
          rejectedByEmail: reviewerEmail,
        };

        await queryRunner.manager.save(pointsTransaction);
      } else {
        this.logger.warn(
          `No se encontró transacción WITHDRAWAL para retiro ${withdrawalId}`,
        );
      }
      // 3. Devolver los puntos al usuario
      const userPoints = await this.userPointsService.findOne(userId);
      if (userPoints) {
        userPoints.availablePoints =
          Number(userPoints.availablePoints) + Number(amount);
        userPoints.totalWithdrawnPoints =
          Number(userPoints.totalWithdrawnPoints) - Number(amount);
        await queryRunner.manager.save(userPoints);
      }

      await queryRunner.commitTransaction();

      this.logger.log(
        `Retiro ${withdrawalId} rechazado exitosamente en points service`,
      );
      return {
        message: 'Puntos restaurados exitosamente para retiro rechazado',
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error rechazando retiro ${withdrawalId}: ${error}`);
      if (error instanceof RpcException) throw error;
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error interno rechazando retiro en points service',
      });
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
