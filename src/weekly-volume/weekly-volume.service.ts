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
} from './dto/create-volume.dto';
import { StatsWeeklyVolumeDto } from './dto/stats-weekly-volume.dto';
import { UsersService } from 'src/common/services/users.service';

@Injectable()
export class WeeklyVolumeService {
  private readonly logger = new Logger(WeeklyVolumeService.name);
  constructor(
    @InjectRepository(WeeklyVolume)
    private readonly weeklyVolumeRepository: Repository<WeeklyVolume>,
    @InjectRepository(WeeklyVolumeHistory)
    private readonly weeklyVolumeHistoryRepository: Repository<WeeklyVolumeHistory>,
    private readonly dataSource: DataSource,
    private usersService: UsersService,
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
            userAssignment.id,
            addVolumeDto.volume,
            userAssignment.site,
            userAssignment.paymentId,
            queryRunner,
            processedItems,
          );

          this.logger.log(
            `Volumen semanal procesado para usuario ${userAssignment.id}: ${addVolumeDto.volume} en lado ${userAssignment.site}`,
          );
        } catch (error) {
          const errorMessage = this.getErrorMessage(error);
          this.logger.error(
            `Error procesando usuario ${userAssignment.id}: ${errorMessage}`,
          );
          const failedItem = new FailedVolumeDto();
          failedItem.userId = userAssignment.id;
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

  // Lógica adaptada del monolítico - método updateWeeklyVolume
  private async updateWeeklyVolume(
    userId: string,
    binaryPoints: number,
    side: VolumeSide,
    paymentId: string,
    queryRunner: QueryRunner,
    processedItems: ProcessedVolumeDto[],
  ) {
    try {
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
        if (side === VolumeSide.LEFT) {
          existingVolume.leftVolume =
            Number(existingVolume.leftVolume) + Number(binaryPoints);
        } else {
          existingVolume.rightVolume =
            Number(existingVolume.rightVolume) + Number(binaryPoints);
        }

        weeklyVolume = existingVolume;
        action = 'updated';

        this.logger.log(
          `Volumen semanal actualizado para usuario ${userId}: +${binaryPoints} en lado ${side}`,
        );
      } else {
        // Crear nuevo volumen (lógica del monolítico)
        const user = await this.usersService.getUser(userId);
        const newVolume = this.weeklyVolumeRepository.create({
          userId: userId,
          userEmail: user.email,
          userName: `${user.firstName} ${user.lastName}`,
          leftVolume: side === VolumeSide.LEFT ? binaryPoints : 0,
          rightVolume: side === VolumeSide.RIGHT ? binaryPoints : 0,
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
          `Nuevo volumen semanal creado para usuario ${userId}: ${binaryPoints} en lado ${side}`,
        );
      }

      // Guardar volumen
      const savedWeeklyVolume = await queryRunner.manager.save(weeklyVolume);

      // Crear historial (igual que en monolítico)
      const history = this.weeklyVolumeHistoryRepository.create({
        weeklyVolume: savedWeeklyVolume,
        paymentId: paymentId,
        volumeSide: side,
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
      processedItem.side = side;
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

  // Método para obtener volúmenes de un usuario específico
  async getUserWeeklyVolumes(userId: string, limit: number = 10) {
    return await this.weeklyVolumeRepository.find({
      where: { userId },
      relations: ['history'],
      order: { weekStartDate: 'DESC' },
      take: limit,
    });
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

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object' && 'message' in error)
      return String(error.message);
    return 'Error desconocido';
  }
}
