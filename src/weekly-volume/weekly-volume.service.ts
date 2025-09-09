import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  VolumeProcessingStatus,
  VolumeSide,
  WeeklyVolume,
} from './entities/weekly-volume.entity';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { WeeklyVolumeHistory } from './entities/weekly-volume-history.entity';
import {
  CreateVolumeDto,
  CreateVolumeResponseDto,
  FailedVolumeDto,
  ProcessedVolumeDto,
  VolumeUserAssignmentDto,
} from './dto/create-volume.dto';
import { StatsWeeklyVolumeDto } from './dto/stats-weekly-volume.dto';
import { UsersService } from 'src/common/services/users.service';
import { MembershipService } from 'src/common/services/memberships.service';
import { getPreviousWeekDates, getWeekDates } from 'src/common/helpers/dates';
import {
  PointsTransaction,
  PointTransactionType,
  PointTransactionStatus,
} from 'src/point/entities/points-transaction.entity';
import { UserPoints } from 'src/point/entities/user-points.entity';
import { PointsTransactionPayment } from 'src/point/entities/points-transaction-payment.entity';
import { calculateEffectiveVolume } from 'src/config/volume-limits.config';
import {
  GetUserWeeklyVolumesDto,
  WeeklyVolumeResponseDto,
} from './dto/get-user-weekly-volumes.dto';
import { GetWeeklyVolumeDetailDto } from './dto/get-weekly-volume-detail.dto';
import {
  GetWeeklyVolumeHistoryDto,
  WeeklyVolumeHistoryResponseDto,
} from './dto/get-weekly-volume-history.dto';
import { Paginated } from 'src/common/dto/paginated.dto';
import { paginate } from 'src/common/helpers/paginate.helper';
import { MembershipStatus } from 'src/point/enums/status-membership.enum';
import { UserMembershipInfoResponse } from 'src/point/interfaces/user-membership-info-response.interface';

@Injectable()
export class WeeklyVolumeService {
  private readonly logger = new Logger(WeeklyVolumeService.name);
  constructor(
    @InjectRepository(WeeklyVolume)
    private readonly weeklyVolumeRepository: Repository<WeeklyVolume>,
    @InjectRepository(WeeklyVolumeHistory)
    private readonly weeklyVolumeHistoryRepository: Repository<WeeklyVolumeHistory>,
    @InjectRepository(PointsTransaction)
    private readonly pointsTransactionRepository: Repository<PointsTransaction>,
    @InjectRepository(UserPoints)
    private readonly userPointsRepository: Repository<UserPoints>,
    @InjectRepository(PointsTransactionPayment)
    private readonly pointsTransactionPaymentRepository: Repository<PointsTransactionPayment>,
    private readonly dataSource: DataSource,
    private usersService: UsersService,
    private membershipService: MembershipService,
  ) {}

  async createVolume(
    addVolumeDto: CreateVolumeDto,
  ): Promise<CreateVolumeResponseDto> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      this.logger.log(
        `Iniciando asignación de volúmenes para ${addVolumeDto.users.length} usuarios`,
      );

      const processedItems: ProcessedVolumeDto[] = [];
      const failedItems: FailedVolumeDto[] = [];
      // Procesar cada usuario usando la lógica del monolítico
      for (const userAssignment of addVolumeDto.users) {
        try {
          await this.updateWeeklyVolume(
            userAssignment,
            addVolumeDto.volume,
            queryRunner,
            processedItems,
          );

          this.logger.log(
            `Volumen semanal procesado para usuario ${userAssignment.userId}: ${addVolumeDto.volume} en lado ${userAssignment.site}`,
          );
        } catch (error) {
          const errorMessage = this.getErrorMessage(error);
          this.logger.error(
            `Error procesando usuario ${userAssignment.userId}: ${errorMessage}`,
          );
          const failedItem = new FailedVolumeDto();
          failedItem.userId = userAssignment.userId;
          failedItem.reason = `Error al procesar: ${errorMessage}`;
          failedItems.push(failedItem);
        }
      }

      await queryRunner.commitTransaction();

      this.logger.log(
        `Asignación de volúmenes completada: ${processedItems.length} exitosos, ${failedItems.length} fallidos`,
      );

      return {
        processed: processedItems,
        failed: failedItems,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      const errorMessage = this.getErrorMessage(error);
      this.logger.error(`Error en asignación de volúmenes: ${errorMessage}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async updateWeeklyVolume(
    userData: VolumeUserAssignmentDto,
    binaryPoints: number,
    queryRunner: QueryRunner,
    processedItems: ProcessedVolumeDto[],
  ) {
    try {
      const { userId, userName, userEmail, site, paymentId } = userData;
      const { weekStartDate, weekEndDate } = this.getCurrentWeekDates();
      // Buscar volumen existente (igual que en monolítico)
      const existingVolume = await this.weeklyVolumeRepository.findOne({
        where: {
          userId: userId,
          status: VolumeProcessingStatus.PENDING,
          weekStartDate: weekStartDate,
          weekEndDate: weekEndDate,
        },
      });

      let weeklyVolume: WeeklyVolume;
      let action: 'created' | 'updated';

      if (existingVolume) {
        // Actualizar volumen existente (lógica del monolítico)
        if (site === VolumeSide.LEFT) {
          existingVolume.leftVolume =
            Number(existingVolume.leftVolume) + Number(binaryPoints);
        } else {
          existingVolume.rightVolume =
            Number(existingVolume.rightVolume) + Number(binaryPoints);
        }

        weeklyVolume = existingVolume;
        action = 'updated';

        this.logger.log(
          `Volumen semanal actualizado para usuario ${userId}: +${binaryPoints} en lado ${site}`,
        );
      } else {
        const newVolume = this.weeklyVolumeRepository.create({
          userId: userId,
          userEmail: userEmail,
          userName: userName,
          leftVolume: site === VolumeSide.LEFT ? binaryPoints : 0,
          rightVolume: site === VolumeSide.RIGHT ? binaryPoints : 0,
          weekStartDate: weekStartDate,
          weekEndDate: weekEndDate,
          status: VolumeProcessingStatus.PENDING,
          metadata: {
            createdBy: 'bulk_volume_assignment',
            createdAt: new Date().toISOString(),
          },
        });

        weeklyVolume = newVolume;
        action = 'created';

        this.logger.log(
          `Nuevo volumen semanal creado para usuario ${userId}: ${binaryPoints} en lado ${site}`,
        );
      }

      // Guardar volumen
      const savedWeeklyVolume = await queryRunner.manager.save(weeklyVolume);

      // Crear historial (igual que en monolítico)
      const history = this.weeklyVolumeHistoryRepository.create({
        weeklyVolume: savedWeeklyVolume,
        paymentId: paymentId,
        volumeSide: site,
        volume: binaryPoints,
        metadata: {
          bulkAssignment: true,
          processedAt: new Date().toISOString(),
        },
      });

      await queryRunner.manager.save(history);

      // Agregar a processedItems
      const processedItem = new ProcessedVolumeDto();
      processedItem.userId = userId;
      processedItem.side = site;
      processedItem.volumeAdded = binaryPoints;
      processedItem.action = action;
      processedItem.weeklyVolumeId = savedWeeklyVolume.id;
      processedItems.push(processedItem);
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      this.logger.error(`Error al actualizar volumen semanal: ${errorMessage}`);
      throw error;
    }
  }

  private getCurrentWeekDates(): { weekStartDate: Date; weekEndDate: Date } {
    const now = new Date();
    const currentDay = now.getDay(); // 0 = domingo, 1 = lunes, etc.

    // Calcular el lunes de la semana actual
    const weekStartDate = new Date(now);
    const daysSinceMonday = currentDay === 0 ? 6 : currentDay - 1; // Si es domingo, retroceder 6 días
    weekStartDate.setDate(now.getDate() - daysSinceMonday);
    weekStartDate.setHours(0, 0, 0, 0);

    // Calcular el domingo de la semana actual
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekStartDate.getDate() + 6);
    weekEndDate.setHours(23, 59, 59, 999);

    return { weekStartDate, weekEndDate };
  }

  // Método para obtener estadísticas de volúmenes por semana
  async getWeeklyVolumeStats(weekStartDate: Date, weekEndDate: Date) {
    const stats: StatsWeeklyVolumeDto | undefined =
      await this.weeklyVolumeRepository
        .createQueryBuilder('wv')
        .select([
          'COUNT(*) as totalRecords',
          'SUM(wv.leftVolume) as totalLeftVolume',
          'SUM(wv.rightVolume) as totalRightVolume',
          'SUM(wv.leftVolume + wv.rightVolume) as totalVolume',
          "COUNT(CASE WHEN wv.status = 'PENDING' THEN 1 END) as pendingCount",
          "COUNT(CASE WHEN wv.status = 'PROCESSED' THEN 1 END) as processedCount",
        ])
        .where(
          'wv.weekStartDate = :weekStartDate AND wv.weekEndDate = :weekEndDate',
          {
            weekStartDate,
            weekEndDate,
          },
        )
        .getRawOne();
    if (!stats) return null;
    return {
      weekStartDate,
      weekEndDate,
      totalRecords: parseInt(stats.totalRecords) || 0,
      totalLeftVolume: parseFloat(stats.totalLeftVolume) || 0,
      totalRightVolume: parseFloat(stats.totalRightVolume) || 0,
      totalVolume: parseFloat(stats.totalVolume) || 0,
      pendingCount: parseInt(stats.pendingCount) || 0,
      processedCount: parseInt(stats.processedCount) || 0,
    };
  }

  /**
   * Obtiene la lista paginada de todos los WeeklyVolume de un usuario
   */
  async getUserWeeklyVolumes(
    dto: GetUserWeeklyVolumesDto,
  ): Promise<Paginated<WeeklyVolumeResponseDto>> {
    try {
      const queryBuilder = this.weeklyVolumeRepository
        .createQueryBuilder('wv')
        .where('wv.userId = :userId', { userId: dto.userId });

      // Aplicar filtro por status si se proporciona
      if (dto.status) {
        queryBuilder.andWhere('wv.status = :status', { status: dto.status });
      }

      // Aplicar filtro por fecha de inicio si se proporciona
      if (dto.startDate) {
        queryBuilder.andWhere('wv.weekStartDate >= :startDate', {
          startDate: new Date(dto.startDate),
        });
      }

      // Aplicar filtro por fecha de fin si se proporciona
      if (dto.endDate) {
        queryBuilder.andWhere('wv.weekEndDate <= :endDate', {
          endDate: new Date(dto.endDate),
        });
      }

      // Ordenar por fecha de creación descendente
      queryBuilder.orderBy('wv.createdAt', 'DESC');

      const weeklyVolumes = await queryBuilder.getMany();

      const weeklyVolumeResponses: WeeklyVolumeResponseDto[] =
        weeklyVolumes.map((volume) => ({
          id: volume.id,
          leftVolume: volume.leftVolume,
          rightVolume: volume.rightVolume,
          commissionEarned: volume.commissionEarned,
          weekStartDate: volume.weekStartDate,
          weekEndDate: volume.weekEndDate,
          status: volume.status,
          selectedSide: volume.selectedSide,
          processedAt: volume.processedAt,
          metadata: volume.metadata,
          createdAt: volume.createdAt,
          updatedAt: volume.updatedAt,
        }));

      return await paginate(weeklyVolumeResponses, dto);
    } catch (error) {
      this.logger.error(
        `Error al obtener WeeklyVolumes del usuario ${dto.userId}: ${this.getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Obtiene el detalle de un WeeklyVolume específico por ID
   */
  async getWeeklyVolumeDetail(
    dto: GetWeeklyVolumeDetailDto,
  ): Promise<WeeklyVolumeResponseDto> {
    try {
      const weeklyVolume = await this.weeklyVolumeRepository.findOne({
        where: { id: dto.id },
      });

      if (!weeklyVolume) {
        throw new Error(`WeeklyVolume con ID ${dto.id} no encontrado`);
      }

      return {
        id: weeklyVolume.id,
        leftVolume: weeklyVolume.leftVolume,
        rightVolume: weeklyVolume.rightVolume,
        commissionEarned: weeklyVolume.commissionEarned,
        weekStartDate: weeklyVolume.weekStartDate,
        weekEndDate: weeklyVolume.weekEndDate,
        status: weeklyVolume.status,
        selectedSide: weeklyVolume.selectedSide,
        processedAt: weeklyVolume.processedAt,
        metadata: weeklyVolume.metadata,
        createdAt: weeklyVolume.createdAt,
        updatedAt: weeklyVolume.updatedAt,
      };
    } catch (error) {
      this.logger.error(
        `Error al obtener detalle del WeeklyVolume ${dto.id}: ${this.getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Obtiene el historial paginado de un WeeklyVolume específico
   */
  async getWeeklyVolumeHistory(
    dto: GetWeeklyVolumeHistoryDto,
  ): Promise<Paginated<WeeklyVolumeHistoryResponseDto>> {
    try {
      // Verificar que el WeeklyVolume existe
      const weeklyVolume = await this.weeklyVolumeRepository.findOne({
        where: { id: dto.weeklyVolumeId },
      });

      if (!weeklyVolume) {
        throw new Error(
          `WeeklyVolume con ID ${dto.weeklyVolumeId} no encontrado`,
        );
      }

      const history = await this.weeklyVolumeHistoryRepository.find({
        where: { weeklyVolume: { id: dto.weeklyVolumeId } },
        order: { createdAt: 'DESC' },
      });

      const historyResponses: WeeklyVolumeHistoryResponseDto[] = history.map(
        (historyItem) => ({
          id: historyItem.id,
          paymentId: historyItem.paymentId,
          volumeSide: historyItem.volumeSide,
          volume: historyItem.volume,
          metadata: historyItem.metadata,
          createdAt: historyItem.createdAt,
          updatedAt: historyItem.updatedAt,
        }),
      );

      return await paginate(historyResponses, dto);
    } catch (error) {
      this.logger.error(
        `Error al obtener historial del WeeklyVolume ${dto.weeklyVolumeId}: ${this.getErrorMessage(error)}`,
      );
      throw error;
    }
  }

  /**
   * Procesa los volúmenes semanales pendientes (lógica del corte)
   */
  async processWeeklyVolumes(): Promise<{
    processed: number;
    successful: number;
    failed: number;
    totalPoints: number;
  }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      this.logger.log('Iniciando procesamiento de volúmenes semanales');

      const lastWeekDates = getPreviousWeekDates();

      const pendingVolumes = await this.weeklyVolumeRepository.find({
        where: {
          status: VolumeProcessingStatus.PENDING,
          weekStartDate: lastWeekDates.weekStart,
          weekEndDate: lastWeekDates.weekEnd,
        },
        relations: ['history'],
      });

      this.logger.log(
        `Encontrados ${pendingVolumes.length} volúmenes pendientes para procesar`,
      );

      let processed = 0;
      let successful = 0;
      let failed = 0;
      let totalPoints = 0;

      const currentWeekDates = getWeekDates();

      for (const volume of pendingVolumes) {
        try {
          // Verificar membresía activa
          const membershipInfo =
            await this.membershipService.getUserMembershipInfo(volume.userId);

          if (
            !membershipInfo ||
            membershipInfo.status !== MembershipStatus.ACTIVE
          ) {
            this.logger.warn(
              `Usuario ${volume.userId} no tiene una membresía activa`,
            );

            volume.status = VolumeProcessingStatus.CANCELLED;
            volume.processedAt = new Date();
            volume.metadata = {
              reason: 'Membresía inactiva',
              processedAt: new Date().toISOString().split('T')[0],
              leftVolume: volume.leftVolume,
              rightVolume: volume.rightVolume,
            };
            await queryRunner.manager.save(volume);

            // Crear volumen para la siguiente semana sin carry over
            await this.createNextWeekVolume(
              volume.userId,
              currentWeekDates,
              0,
              queryRunner,
            );

            processed++;
            failed++;
            continue;
          }

          // Verificar piernas activas del árbol MLM
          const hasLeftLeg = await this.checkLeg(
            volume.userId,
            VolumeSide.LEFT,
          );
          const hasRightLeg = await this.checkLeg(
            volume.userId,
            VolumeSide.RIGHT,
          );

          if (!hasLeftLeg || !hasRightLeg) {
            this.logger.warn(
              `Usuario ${volume.userId} no tiene hijos en ambos lados`,
            );

            volume.status = VolumeProcessingStatus.CANCELLED;
            volume.processedAt = new Date();
            volume.metadata = {
              reason:
                !hasLeftLeg && !hasRightLeg
                  ? 'No tiene directos activos en ninguna pierna'
                  : !hasLeftLeg
                    ? 'No tiene directo activo en la pierna izquierda'
                    : 'No tiene directo activo en la pierna derecha',
              processedAt: new Date().toISOString().split('T')[0],
              leftVolume: volume.leftVolume,
              rightVolume: volume.rightVolume,
            };

            await queryRunner.manager.save(volume);

            // Transferir volumen completo a la siguiente semana
            const carryOverVolume = volume.leftVolume + volume.rightVolume;
            await this.createNextWeekVolume(
              volume.userId,
              currentWeekDates,
              carryOverVolume,
              queryRunner,
            );

            processed++;
            failed++;
            continue;
          }

          // Procesar comisión binaria
          const result = await this.processBinaryCommission(
            volume,
            membershipInfo,
            queryRunner,
          );

          if (result.success) {
            totalPoints += result.pointsEarned;
            successful++;
          } else {
            failed++;
          }

          processed++;
        } catch (error) {
          const errorMessage = this.getErrorMessage(error);
          this.logger.error(
            `Error procesando volumen ${volume.id}: ${errorMessage}`,
          );
          failed++;
          processed++;
        }
      }

      await queryRunner.commitTransaction();

      this.logger.log(
        `Procesamiento de volúmenes completado. Procesados: ${processed}, Exitosos: ${successful}, Fallidos: ${failed}, Puntos totales: ${totalPoints}`,
      );

      // TODO: Enviar reporte semanal
      // await this.sendWeeklyVolumeReport({...});

      return {
        processed,
        successful,
        failed,
        totalPoints,
      };
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      this.logger.error(
        `Error general en procesamiento de volúmenes: ${errorMessage}`,
      );
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Procesa la comisión binaria para un volumen específico
   */
  private async processBinaryCommission(
    volume: WeeklyVolume,
    membershipInfo: UserMembershipInfoResponse,
    queryRunner: QueryRunner,
  ): Promise<{ success: boolean; pointsEarned: number }> {
    try {
      // Determinar lado más fuerte y más débil
      const weakerSide = volume.getWeakerSide();
      const strongerSide = volume.getStrongerSide();

      if (!weakerSide || !strongerSide) {
        this.logger.warn(
          `Volumen ${volume.id} no tiene diferencia entre lados`,
        );
        return { success: false, pointsEarned: 0 };
      }

      volume.selectedSide = weakerSide;

      const higherVolume =
        strongerSide === VolumeSide.LEFT
          ? volume.leftVolume
          : volume.rightVolume;
      const lowerVolume =
        weakerSide === VolumeSide.LEFT ? volume.leftVolume : volume.rightVolume;

      // Contar directos activos
      const { directCount } = await this.countDirectReferrals(volume.userId);

      // Aplicar límites según directos usando configuración
      const volumeLimitResult = calculateEffectiveVolume(
        lowerVolume,
        directCount,
      );
      const effectiveLowerVolume = volumeLimitResult.effectiveVolume;

      // Obtener información de membresía del usuario para obtener el porcentaje de comisión
      const membershipInfo = await this.membershipService.getUserMembershipInfo(
        volume.userId,
      );
      let commissionPercentage = 10; // Default 10%
      if (membershipInfo.hasMembership && membershipInfo.plan?.id) {
        try {
          const planDetails = await this.membershipService.getMembershipPlan(
            membershipInfo.plan.id,
            volume.userId,
          );
          commissionPercentage = planDetails.plan.commissionPercentage;
        } catch (error) {
          const errorMessage = this.getErrorMessage(error);
          this.logger.warn(
            `Error obteniendo porcentaje de comisión para usuario ${volume.userId}, usando default 10%: ${errorMessage}`,
          );
        }
      }

      // Calcular puntos a otorgar
      const pointsToAdd = effectiveLowerVolume * (commissionPercentage / 100);

      // Actualizar estado del volumen
      volume.status = VolumeProcessingStatus.PROCESSED;
      volume.processedAt = new Date();
      volume.commissionEarned = pointsToAdd;
      volume.metadata = {
        reason: 'Comisión binaria procesada',
        processedAt: new Date().toISOString().split('T')[0],
        leftVolume: volume.leftVolume,
        rightVolume: volume.rightVolume,
        commissionProcessed: pointsToAdd,
        directsCount: directCount,
        effectiveVolume: effectiveLowerVolume,
        originalVolume: lowerVolume,
        limitApplied: volumeLimitResult.limitApplied,
        limitDescription: volumeLimitResult.limitDescription,
      };

      await queryRunner.manager.save(volume);

      // Actualizar puntos del usuario
      await this.updateUserPoints(volume.userId, pointsToAdd, queryRunner);

      // Crear transacción de puntos
      const transaction = await this.createPointsTransaction(
        volume,
        pointsToAdd,
        effectiveLowerVolume,
        directCount,
        commissionPercentage,
        volumeLimitResult,
        queryRunner,
      );

      // Vincular pagos del historial del volumen
      await this.linkVolumeHistoryPayments(
        volume,
        weakerSide,
        transaction,
        queryRunner,
      );

      // Crear carry-over para la siguiente semana
      const carryOverVolume = Math.max(0, higherVolume - lowerVolume);
      const currentWeekDates = getWeekDates();
      await this.createNextWeekVolumeWithCarryOver(
        volume.userId,
        currentWeekDates,
        carryOverVolume,
        strongerSide,
        queryRunner,
      );

      return { success: true, pointsEarned: pointsToAdd };
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      this.logger.error(`Error procesando comisión binaria: ${errorMessage}`);
      return { success: false, pointsEarned: 0 };
    }
  }

  /**
   * Verifica si el usuario tiene pierna activa en el lado especificado
   * Implementación equivalente al monolito con queries recursivas
   */
  private async checkLeg(userId: string, side: VolumeSide): Promise<boolean> {
    try {
      // 1. Obtener usuario con sus hijos directos
      const userWithChildren =
        await this.usersService.getUserWithChildren(userId);

      if (!userWithChildren || !userWithChildren.referralCode) {
        this.logger.warn(`Usuario ${userId} no encontrado o sin referralCode`);
        return false;
      }

      // 2. Determinar el hijo raíz según el lado
      const rootChildId =
        side === VolumeSide.LEFT
          ? userWithChildren.leftChildId
          : userWithChildren.rightChildId;

      if (!rootChildId) {
        this.logger.debug(`Usuario ${userId} no tiene hijo ${side}`);
        return false;
      }

      // 3. Obtener todos los descendientes en esa pierna
      const descendants = await this.usersService.getDescendantsInLeg(
        rootChildId,
        side,
      );

      if (!descendants || descendants.length === 0) {
        this.logger.debug(
          `No se encontraron descendientes en pierna ${side} para usuario ${userId}`,
        );
        return false;
      }

      // 4. Verificar si hay membresías activas en la pierna
      const hasActiveMemberships =
        await this.usersService.checkActiveMembershipsInLeg(
          descendants,
          userWithChildren.referralCode,
        );

      this.logger.debug(
        `Verificación pierna ${side} para usuario ${userId}: ${descendants.length} descendientes, membresías activas: ${hasActiveMemberships}`,
      );

      return hasActiveMemberships;
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      this.logger.error(
        `Error verificando pierna ${side} para usuario ${userId}: ${errorMessage}`,
      );
      return false;
    }
  }

  /**
   * Cuenta los referidos directos activos
   */
  private async countDirectReferrals(
    userId: string,
  ): Promise<{ directCount: number }> {
    try {
      const directReferrals =
        await this.usersService.getDirectReferrals(userId);
      return { directCount: directReferrals?.length || 0 };
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      this.logger.error(
        `Error contando directos para usuario ${userId}: ${errorMessage}`,
      );
      return { directCount: 0 };
    }
  }

  /**
   * Actualiza los puntos del usuario
   */
  private async updateUserPoints(
    userId: string,
    pointsToAdd: number,
    queryRunner: QueryRunner,
  ): Promise<void> {
    let userPoints = await this.userPointsRepository.findOne({
      where: { userId },
    });

    if (!userPoints) {
      // Obtener info del usuario para crear registro
      const userInfo = await this.usersService.getUser(userId);

      userPoints = this.userPointsRepository.create({
        userId,
        userEmail: userInfo.email,
        userName:
          `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim(),
        availablePoints: 0,
        totalEarnedPoints: 0,
        totalWithdrawnPoints: 0,
      });
    }

    userPoints.availablePoints =
      Number(userPoints.availablePoints) + pointsToAdd;
    userPoints.totalEarnedPoints =
      Number(userPoints.totalEarnedPoints) + pointsToAdd;

    await queryRunner.manager.save(userPoints);
  }

  /**
   * Crea transacción de puntos por comisión binaria
   */
  private async createPointsTransaction(
    volume: WeeklyVolume,
    pointsEarned: number,
    effectiveVolume: number,
    directCount: number,
    commissionPercentage: number,
    volumeLimitResult: { limitApplied: boolean; limitDescription: string },
    queryRunner: QueryRunner,
  ): Promise<PointsTransaction> {
    const transaction = this.pointsTransactionRepository.create({
      userId: volume.userId,
      userEmail: volume.userEmail,
      userName: volume.userName,
      amount: pointsEarned,
      type: PointTransactionType.BINARY_COMMISSION,
      status: PointTransactionStatus.COMPLETED,
      metadata: {
        weekStartDate: volume.weekStartDate,
        weekEndDate: volume.weekEndDate,
        leftVolume: volume.leftVolume,
        rightVolume: volume.rightVolume,
        selectedSide:
          volume.selectedSide === VolumeSide.LEFT ? 'Izquierdo' : 'Derecho',
        commissionPercentage,
        directsActive: directCount,
        effectiveVolume,
        originalLowerVolume: Math.min(volume.leftVolume, volume.rightVolume),
        volumeLimitApplied: volumeLimitResult.limitApplied,
        volumeLimitDescription: volumeLimitResult.limitDescription,
      },
    });

    return await queryRunner.manager.save(transaction);
  }

  /**
   * Vincula los pagos del historial del volumen con la transacción de puntos
   */
  private async linkVolumeHistoryPayments(
    volume: WeeklyVolume,
    selectedSide: VolumeSide,
    transaction: PointsTransaction,
    queryRunner: QueryRunner,
  ): Promise<void> {
    const volumeHistoryWithPayments =
      await this.weeklyVolumeHistoryRepository.find({
        where: {
          weeklyVolume: { id: volume.id },
          volumeSide: selectedSide,
        },
        select: {
          id: true,
          paymentId: true,
        },
      });

    for (const history of volumeHistoryWithPayments) {
      if (history.paymentId) {
        const transactionPayment =
          this.pointsTransactionPaymentRepository.create({
            pointsTransaction: transaction,
            paymentId: parseInt(history.paymentId), // Convertir string a number
            amount: history.volume, // Usar el volumen como amount
            paymentMethod: 'MEMBERSHIP_PAYMENT', // Método de pago por defecto
            notes: `Vinculado desde volumen semanal - ${selectedSide === VolumeSide.LEFT ? 'Izquierdo' : 'Derecho'}`,
          });
        await queryRunner.manager.save(transactionPayment);
      }
    }
  }

  /**
   * Crea volumen para la siguiente semana (sin carry-over específico)
   */
  private async createNextWeekVolume(
    userId: string,
    weekDates: { weekStart: Date; weekEnd: Date },
    carryOverVolume: number,
    queryRunner: QueryRunner,
  ): Promise<void> {
    const existingVolume = await this.weeklyVolumeRepository.findOne({
      where: {
        userId,
        weekStartDate: weekDates.weekStart,
        weekEndDate: weekDates.weekEnd,
      },
    });

    if (!existingVolume) {
      const userInfo = await this.usersService.getUser(userId);

      const newVolume = this.weeklyVolumeRepository.create({
        userId,
        userEmail: userInfo.email,
        userName:
          `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim(),
        leftVolume: carryOverVolume,
        rightVolume: carryOverVolume,
        weekStartDate: weekDates.weekStart,
        weekEndDate: weekDates.weekEnd,
        status: VolumeProcessingStatus.PENDING,
        metadata: {
          carryOver: carryOverVolume,
          reason: carryOverVolume > 0 ? 'Volumen transferido' : 'Nuevo período',
        },
      });

      await queryRunner.manager.save(newVolume);
    }
  }

  /**
   * Crea volumen para la siguiente semana con carry-over específico por lado
   */
  private async createNextWeekVolumeWithCarryOver(
    userId: string,
    weekDates: { weekStart: Date; weekEnd: Date },
    carryOverVolume: number,
    strongerSide: VolumeSide,
    queryRunner: QueryRunner,
  ): Promise<void> {
    const existingVolume = await this.weeklyVolumeRepository.findOne({
      where: {
        userId,
        weekStartDate: weekDates.weekStart,
        weekEndDate: weekDates.weekEnd,
      },
    });

    if (existingVolume) {
      // Actualizar volumen existente
      if (strongerSide === VolumeSide.LEFT) {
        existingVolume.leftVolume =
          Number(existingVolume.leftVolume) + carryOverVolume;
      } else {
        existingVolume.rightVolume =
          Number(existingVolume.rightVolume) + carryOverVolume;
      }

      await queryRunner.manager.save(existingVolume);
    } else {
      // Crear nuevo volumen
      const userInfo = await this.usersService.getUser(userId);

      const newVolume = this.weeklyVolumeRepository.create({
        userId,
        userEmail: userInfo.email,
        userName:
          `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim(),
        leftVolume: strongerSide === VolumeSide.LEFT ? carryOverVolume : 0,
        rightVolume: strongerSide === VolumeSide.RIGHT ? carryOverVolume : 0,
        weekStartDate: weekDates.weekStart,
        weekEndDate: weekDates.weekEnd,
        status: VolumeProcessingStatus.PENDING,
        metadata: {
          carryOverSide: strongerSide,
          carryOverAmount: carryOverVolume,
          reason: 'Carry-over de volumen procesado',
        },
      });

      await queryRunner.manager.save(newVolume);
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
