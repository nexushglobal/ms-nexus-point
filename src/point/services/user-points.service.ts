import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { UserPoints } from '../entities/user-points.entity';
import { UsersService } from 'src/common/services/users.service';
import { RpcException } from '@nestjs/microservices';
import { MembershipService } from 'src/common/services/memberships.service';
import { PointsEventsService } from './points-events.service';
import {
  CreateDirectBonusDto,
  DirectBonusResponseDto,
  DirectBonusUserDto,
  FailedDirectBonusDto,
  ProcessedDirectBonusDto,
} from '../dto/create-direct-bonus.dto';
import {
  PointsTransaction,
  PointTransactionStatus,
} from '../entities/points-transaction.entity';
import { PointsTransactionPayment } from '../entities/points-transaction-payment.entity';

@Injectable()
export class UserPointsService {
  private readonly logger = new Logger(UserPointsService.name);
  constructor(
    @InjectRepository(UserPoints)
    private readonly userPointsRepository: Repository<UserPoints>,
    @InjectRepository(PointsTransaction)
    private readonly pointsTransactionRepository: Repository<PointsTransaction>,
    @InjectRepository(PointsTransactionPayment)
    private readonly pointsTransactionPaymentRepository: Repository<PointsTransactionPayment>,
    private readonly usersService: UsersService,
    private readonly membershipService: MembershipService,
    private readonly pointsEventsService: PointsEventsService,
    private readonly dataSource: DataSource,
  ) {}

  async getUserPoints(userId: string) {
    const user = await this.usersService.getUser(userId);
    if (!user)
      throw new RpcException({
        status: HttpStatus.NOT_FOUND,
        message: `Usuario con ID ${userId} no encontrado`,
      });
    let userPoints = await this.userPointsRepository.findOne({
      where: { userId },
    });
    if (!userPoints) {
      userPoints = this.userPointsRepository.create({
        userId: user.id,
        userName: user.lastName,
        userEmail: user.email,
        availablePoints: 0,
        totalEarnedPoints: 0,
        totalWithdrawnPoints: 0,
      });
      await this.userPointsRepository.save(userPoints);
    }

    await this.pointsEventsService.emitPointsUpdate(userId);
    return {
      availablePoints: userPoints.availablePoints,
      totalEarnedPoints: userPoints.totalEarnedPoints,
      totalWithdrawnPoints: userPoints.totalWithdrawnPoints,
    };
  }

  async findOne(userId: string) {
    const user = await this.userPointsRepository.findOne({
      where: { userId },
    });
    if (!user)
      throw new RpcException({
        status: HttpStatus.NOT_FOUND,
        message: `Usuario con ID ${userId} no encontrado`,
      });
    return user;
  }

  async getUserLotPoints(userId: string) {
    const user = await this.usersService.getUser(userId);
    if (!user)
      throw new RpcException({
        status: HttpStatus.NOT_FOUND,
        message: `Usuario con ID ${userId} no encontrado`,
      });
    // try {
    const userPoints = await this.userPointsRepository.findOne({
      where: { userId },
    });
    if (!userPoints)
      throw new RpcException({
        status: HttpStatus.NOT_FOUND,
        message: `Usuario con ID ${userId} no tiene puntos`,
      });

    return {
      availableLotPoints: userPoints.availableLotPoints | 0,
      totalEarnedLotPoints: userPoints.totalEarnedLotPoints | 0,
      totalWithdrawnLotPoints: userPoints.totalWithdrawnLotPoints | 0,
    };
  }

  async createDirectBonus(
    createDirectBonusDto: CreateDirectBonusDto,
  ): Promise<DirectBonusResponseDto> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      this.logger.log(
        `Iniciando procesamiento de bonos directos para ${createDirectBonusDto.users.length} usuarios`,
      );

      const processedItems: ProcessedDirectBonusDto[] = [];
      const failedItems: FailedDirectBonusDto[] = [];

      // Procesar cada usuario usando la lógica del monolítico
      for (const userAssignment of createDirectBonusDto.users) {
        try {
          await this.processDirectBonus(
            userAssignment,
            queryRunner,
            processedItems,
          );

          this.logger.log(
            `Bono directo procesado para usuario ${userAssignment.userId}`,
          );
        } catch (error) {
          const errorMessage = this.getErrorMessage(error);
          this.logger.error(
            `Error procesando bono directo para usuario ${userAssignment.userId}: ${errorMessage}`,
          );

          const failedItem = new FailedDirectBonusDto();
          failedItem.userId = userAssignment.userId;
          failedItem.userName = userAssignment.userName; // ¡Agregar este campo!
          failedItem.userEmail = userAssignment.userEmail; // ¡Agregar este campo!
          failedItem.paymentReference = userAssignment.paymentReference || '';
          failedItem.reason = `Error al procesar: ${errorMessage}`;
          failedItems.push(failedItem);
        }
      }

      await queryRunner.commitTransaction();

      this.logger.log(
        `Procesamiento de bonos directos completado: ${processedItems.length} exitosos, ${failedItems.length} fallidos`,
      );

      return { processed: processedItems, failed: failedItems };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      const errorMessage = this.getErrorMessage(error);
      this.logger.error(
        `Error en procesamiento de bonos directos: ${errorMessage}`,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // Lógica adaptada del monolítico - método processDirectBonus
  private async processDirectBonus(
    directBonusDto: DirectBonusUserDto,
    queryRunner: QueryRunner,
    processedItems: ProcessedDirectBonusDto[],
  ) {
    try {
      const {
        userId,
        userName,
        userEmail,
        metadata,
        type,
        directBonus,
        paymentReference,
        paymentId,
      } = directBonusDto;
      if (directBonus > 0) {
        if (!paymentReference || !paymentId)
          throw new RpcException({
            status: HttpStatus.BAD_REQUEST,
            message: `Se necesitan los campos paymentReference y paymentId`,
          });
      }
      // Buscar el referente (igual que en el monolítico)
      let referrerPoints = await this.userPointsRepository.findOne({
        where: { userId },
      });
      let previousPoints = 0;
      let currentPoints = directBonus;

      if (referrerPoints) {
        previousPoints = Number(referrerPoints.availablePoints);
        referrerPoints.availablePoints =
          Number(referrerPoints.availablePoints) + directBonus;
        referrerPoints.totalEarnedPoints =
          Number(referrerPoints.totalEarnedPoints) + directBonus;
        currentPoints = Number(referrerPoints.availablePoints);
      } else {
        referrerPoints = this.userPointsRepository.create({
          userId: userId,
          userEmail: userEmail,
          userName: userName,
          availablePoints: directBonus,
          totalEarnedPoints: directBonus,
          totalWithdrawnPoints: 0,
          availableLotPoints: 0,
          totalEarnedLotPoints: 0,
          totalWithdrawnLotPoints: 0,
        });
      }

      await queryRunner.manager.save(referrerPoints);

      // Crear transacción de puntos usando TUS ENTIDADES
      const pointsTransaction = this.pointsTransactionRepository.create({
        userId: referrerPoints.userId,
        userEmail: referrerPoints.userEmail,
        userName: referrerPoints.userName,
        type,
        amount: directBonus,
        pendingAmount: 0,
        withdrawnAmount: 0,
        status:
          directBonus > 0
            ? PointTransactionStatus.COMPLETED
            : PointTransactionStatus.CANCELLED,
        isArchived: false,
        metadata: {
          ...metadata,
          'Puntos Anteriores': previousPoints,
          'Puntos Actuales': currentPoints,
        },
      });

      const savedTransaction =
        await queryRunner.manager.save(pointsTransaction);

      // Crear relación con el pago usando TUS ENTIDADES
      if (directBonus > 0) {
        const pointsTransactionPayment =
          this.pointsTransactionPaymentRepository.create({
            pointsTransaction: savedTransaction,
            paymentId: paymentId,
            amount: directBonus,
            paymentReference: paymentReference,
            // paymentMethod: 'DIRECT_BONUS',
            notes: `Suma de puntos a ${referrerPoints.userName}`,
            metadata: {
              Usuario: referrerPoints.userId,
              'Puntos Sumados': directBonus,
              bulkAssignment: true,
              processedAt: new Date().toISOString(),
            },
          });
        await queryRunner.manager.save(pointsTransactionPayment);
      }

      // Agregar a processedItems
      const processedItem = new ProcessedDirectBonusDto();
      processedItem.referrerUserId = referrerPoints.userId;
      processedItem.bonusPoints = directBonus;
      processedItem.paymentReference = paymentReference || '';
      processedItem.transactionId = savedTransaction.id;
      processedItem.previousPoints = previousPoints;
      processedItem.currentPoints = currentPoints;
      processedItems.push(processedItem);

      this.logger.log(
        `Suma procesada: ${directBonus} puntos para el usuario ${referrerPoints.userId}`,
      );
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      this.logger.error(`Error al procesar bono directo: ${errorMessage}`);
      throw error;
    }
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object' && 'message' in error)
      return String(error.message);
    return 'Error desconocido';
  }

  async checkWithdrawalEligibility(userId: string): Promise<{
    canWithdraw: boolean;
    availablePoints: number;
    hasMinimumPoints: boolean;
    minimumRequired: number;
  }> {
    try {
      this.logger.log(`🔍 Verificando elegibilidad de retiro para usuario: ${userId}`);

      // Verificar si el usuario existe
      const user = await this.usersService.getUser(userId);
      if (!user) {
        throw new RpcException({
          status: HttpStatus.NOT_FOUND,
          message: `Usuario con ID ${userId} no encontrado`,
        });
      }

      // Obtener puntos del usuario
      let userPoints = await this.userPointsRepository.findOne({
        where: { userId },
      });

      if (!userPoints) {
        // Si no tiene puntos, crear el registro con puntos en cero
        userPoints = this.userPointsRepository.create({
          userId: user.id,
          userName: user.lastName,
          userEmail: user.email,
          availablePoints: 0,
          totalEarnedPoints: 0,
          totalWithdrawnPoints: 0,
        });
        await this.userPointsRepository.save(userPoints);
      }

      const minimumRequired = 100;
      const availablePoints = Number(userPoints.availablePoints);
      const hasMinimumPoints = availablePoints >= minimumRequired;

      this.logger.log(
        `✅ Usuario ${userId} - Puntos disponibles: ${availablePoints}, Mínimo requerido: ${minimumRequired}`,
      );

      return {
        canWithdraw: hasMinimumPoints,
        availablePoints,
        hasMinimumPoints,
        minimumRequired,
      };
    } catch (error) {
      this.logger.error(
        `❌ Error verificando elegibilidad de retiro para usuario ${userId}:`,
        error,
      );

      if (error instanceof RpcException) {
        throw error;
      }

      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error interno al verificar elegibilidad de retiro',
      });
    }
  }
}
