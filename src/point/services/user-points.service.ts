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
  FailedDirectBonusDto,
  ProcessedDirectBonusDto,
} from '../dto/create-direct-bonus.dto';
import {
  PointsTransaction,
  PointTransactionStatus,
  PointTransactionType,
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
    // try {
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
    const membershipInfo =
      await this.membershipService.getUserMembershipInfo(userId);
    await this.pointsEventsService.emitPointsUpdate(userId, membershipInfo);
    return {
      availablePoints: userPoints.availablePoints,
      totalEarnedPoints: userPoints.totalEarnedPoints,
      totalWithdrawnPoints: userPoints.totalWithdrawnPoints,
      membershipPlan: membershipInfo.plan
        ? {
            name: membershipInfo.plan.name,
          }
        : null,
    };
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
    const membershipInfo =
      await this.membershipService.getUserMembershipInfo(userId);
    return {
      availableLotPoints: userPoints.availableLotPoints | 0,
      totalEarnedLotPoints: userPoints.totalEarnedLotPoints | 0,
      totalWithdrawnLotPoints: userPoints.totalWithdrawnLotPoints | 0,
      membershipPlan: membershipInfo.plan
        ? {
            name: membershipInfo.plan.name,
          }
        : null,
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
            userAssignment.userId,
            userAssignment.paymentReference,
            userAssignment.paymentId,
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
          failedItem.paymentReference = userAssignment.paymentReference;
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
    userId: string,
    paymentReference: string,
    paymmentId: number,
    queryRunner: QueryRunner,
    processedItems: ProcessedDirectBonusDto[],
  ) {
    try {
      // Obtener el usuario que compró y su plan (desde el servicio de usuarios)
      const user = await this.usersService.getUserByIdInfo(userId);
      if (!user || !user.referrerCode)
        throw new RpcException({
          status: HttpStatus.NOT_FOUND,
          message: 'Usuario no encontrado o no tiene referente',
        });
      // Obtener información del plan comprado por el usuario
      const userPlan =
        await this.membershipService.getUserMembershipInfo(userId);
      if (!userPlan || !userPlan.plan)
        throw new RpcException({
          status: HttpStatus.NOT_FOUND,
          message: 'No se pudo obtener información del plan comprado',
        });
      // Buscar el referente (igual que en el monolítico)
      const referrer = await this.usersService.getUserByReferralCode(
        user.referrerCode,
      );
      if (!referrer)
        throw new RpcException({
          status: HttpStatus.NOT_FOUND,
          message: `No se encontró referente con código ${user.referrerCode}`,
        });
      // Obtener membresía del referente (adaptado del monolítico)
      console.log(referrer._id);
      const referrerMembership =
        await this.membershipService.getUserMembershipInfo(referrer._id);
      if (!referrerMembership || !referrerMembership.plan) {
        throw new RpcException({
          status: HttpStatus.NOT_FOUND,
          message: `El referente ${referrer._id} no tiene una membresía activa`,
        });
      }
      const referrerPlan = await this.membershipService.getMembershipPlan(
        referrerMembership.plan.id,
        referrer._id,
      );
      if (
        !referrerPlan.plan.directCommissionAmount ||
        referrerPlan.plan.directCommissionAmount <= 0
      ) {
        throw new RpcException({
          status: HttpStatus.NOT_FOUND,
          message: `El plan ${referrerPlan.plan.id} del referente no tiene configurada una comisión directa`,
        });
      }

      // Calcular bono directo (igual que en el monolítico)
      const directBonus =
        referrerPlan.plan.directCommissionAmount * (userPlan.plan.price / 100);

      // Actualizar puntos del referente usando TUS ENTIDADES
      let referrerPoints = await this.userPointsRepository.findOne({
        where: { userId: referrer._id },
      });

      if (referrerPoints) {
        referrerPoints.availablePoints =
          Number(referrerPoints.availablePoints) + directBonus;
        referrerPoints.totalEarnedPoints =
          Number(referrerPoints.totalEarnedPoints) + directBonus;
        referrerPoints.userEmail = referrer.email;
        referrerPoints.userName = `${referrer.firstName} ${referrer.lastName}`;
      } else {
        referrerPoints = this.userPointsRepository.create({
          userId: referrer._id,
          userEmail: referrer.email,
          userName: `${referrer.firstName} ${referrer.lastName}`,
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
        userId: referrer._id,
        userEmail: referrer.email,
        userName: `${referrer.firstName} ${referrer.lastName}`,
        type: PointTransactionType.DIRECT_BONUS,
        amount: directBonus,
        pendingAmount: 0,
        withdrawnAmount: 0,
        status: PointTransactionStatus.COMPLETED,
        isArchived: false,
        metadata: {
          usuarioReferido: `${user.firstName} ${user.lastName}`,
          usuarioReferidoId: user._id,
          nombreDelPlan: userPlan.plan.name,
          precioDelPlan: userPlan.plan.price,
          comisionDirecta: referrerPlan.plan.directCommissionAmount,
          bulkAssignment: true,
          processedAt: new Date().toISOString(),
        },
      });

      const savedTransaction =
        await queryRunner.manager.save(pointsTransaction);

      // Crear relación con el pago usando TUS ENTIDADES
      const pointsTransactionPayment =
        this.pointsTransactionPaymentRepository.create({
          pointsTransaction: savedTransaction,
          paymentId: paymmentId,
          amount: directBonus,
          paymentReference: paymentReference,
          paymentMethod: 'DIRECT_BONUS',
          notes: `Bono directo por compra de ${user.firstName} ${user.lastName}`,
          metadata: {
            referrerUserId: referrer._id,
            referredUserId: user._id,
            planComprado: userPlan.plan.name,
            comisionAplicada: referrerPlan.plan.directCommissionAmount,
            bulkAssignment: true,
            processedAt: new Date().toISOString(),
          },
        });

      await queryRunner.manager.save(pointsTransactionPayment);

      // Agregar a processedItems
      const processedItem = new ProcessedDirectBonusDto();
      processedItem.referrerUserId = referrer._id;
      processedItem.referredUserId = user._id;
      processedItem.bonusAmount = directBonus;
      processedItem.paymentReference = paymentReference;
      processedItem.transactionId = savedTransaction.id;
      processedItems.push(processedItem);

      this.logger.log(
        `Bono directo procesado: ${directBonus} puntos para el usuario ${referrer._id}`,
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
}
