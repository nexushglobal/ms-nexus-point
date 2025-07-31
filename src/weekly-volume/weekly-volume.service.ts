import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  VolumeProcessingStatus,
  VolumeSide,
  WeeklyVolume,
} from './entities/weekly-volume.entity';
import { DataSource, Repository } from 'typeorm';
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

      const { weekStartDate, weekEndDate } = this.getCurrentWeekDates();
      const processedItems: ProcessedVolumeDto[] = [];
      const failedItems: FailedVolumeDto[] = [];
      let created = 0;
      let updated = 0;

      for (const userAssignment of addVolumeDto.users) {
        try {
          const user = await this.usersService.getUser(userAssignment.id);
          // Buscar volumen semanal existente para el usuario en la semana actual con status PENDING
          let weeklyVolume = await this.weeklyVolumeRepository.findOne({
            where: {
              userId: userAssignment.id,
              weekStartDate: weekStartDate,
              weekEndDate: weekEndDate,
              status: VolumeProcessingStatus.PENDING,
            },
          });

          let action: 'created' | 'updated';

          if (weeklyVolume) {
            // Actualizar volumen existente
            if (userAssignment.site === VolumeSide.LEFT) {
              weeklyVolume.leftVolume =
                Number(weeklyVolume.leftVolume) + Number(addVolumeDto.volumen);
            } else {
              weeklyVolume.rightVolume =
                Number(weeklyVolume.rightVolume) + Number(addVolumeDto.volumen);
            }
            action = 'updated';
            updated++;
          } else {
            // Crear nuevo volumen semanal
            weeklyVolume = this.weeklyVolumeRepository.create({
              userId: userAssignment.id,
              userEmail: user.email,
              userName: `${user.firstName} ${user.lastName}`,
              leftVolume:
                userAssignment.site === VolumeSide.LEFT
                  ? addVolumeDto.volumen
                  : 0,
              rightVolume:
                userAssignment.site === VolumeSide.RIGHT
                  ? addVolumeDto.volumen
                  : 0,
              weekStartDate: weekStartDate,
              weekEndDate: weekEndDate,
              status: VolumeProcessingStatus.PENDING,
              metadata: {
                createdBy: 'bulk_volume_assignment',
                paymentAmount: addVolumeDto.monto,
                createdAt: new Date().toISOString(),
              },
            });
            action = 'created';
            created++;
          }

          // Guardar el volumen semanal
          const savedWeeklyVolume =
            await queryRunner.manager.save(weeklyVolume);

          // Crear registro en el historial
          const volumeHistory = this.weeklyVolumeHistoryRepository.create({
            weeklyVolume: savedWeeklyVolume,
            paymentId: userAssignment.paymentId,
            volumeSide: userAssignment.site,
            volume: addVolumeDto.volumen,
            metadata: {
              paymentAmount: addVolumeDto.monto,
              bulkAssignment: true,
              processedAt: new Date().toISOString(),
            },
          });

          await queryRunner.manager.save(volumeHistory);

          const processedItem = new ProcessedVolumeDto();
          processedItem.userId = userAssignment.id;
          processedItem.side = userAssignment.site;
          processedItem.volumeAdded = addVolumeDto.volumen;
          processedItem.action = action;
          processedItem.weeklyVolumeId = savedWeeklyVolume.id;

          processedItems.push(processedItem);

          this.logger.log(
            `Volumen ${action} para usuario ${userAssignment.id}: +${addVolumeDto.volumen} en lado ${userAssignment.site}`,
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
        `Asignación de volúmenes completada: ${processedItems.length} exitosos (${created} creados, ${updated} actualizados), ${failedItems.length} fallidos`,
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
