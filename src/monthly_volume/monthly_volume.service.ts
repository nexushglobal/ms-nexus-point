import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import {
  MonthlyVolumeRank,
  MonthlyVolumeStatus,
} from './entities/monthly_volume_ranks.entity';
import { GetUserMonthlyVolumesDto } from './dto/get-user-monthly-volumes.dto';
import { MonthlyVolumeRankDto } from './dto/monthly-volume-rank-response.dto';
import { Paginated } from 'src/common/dto/paginated.dto';
import { paginate } from 'src/common/helpers/paginate.helper';
import {
  CreateMonthlyVolumeDto,
  CreateMonthlyVolumeResponseDto,
  FailedMonthlyVolumeDto,
  MonthlyVolumeUserAssignmentDto,
  ProcessedMonthlyVolumeDto,
} from './dto/create-monthly-volume.dto';
import { VolumeSide } from '../weekly-volume/entities/weekly-volume.entity';

@Injectable()
export class MonthlyVolumeService {
  private readonly logger = new Logger(MonthlyVolumeService.name);

  constructor(
    @InjectRepository(MonthlyVolumeRank)
    private readonly monthlyVolumeRankRepository: Repository<MonthlyVolumeRank>,
    private readonly dataSource: DataSource,
  ) {}

  async getUserMonthlyVolumes(
    getUserMonthlyVolumesDto: GetUserMonthlyVolumesDto,
  ): Promise<Paginated<MonthlyVolumeRankDto>> {
    try {
      const { userId, ...paginationDto } = getUserMonthlyVolumesDto;

      this.logger.log(`Obteniendo volúmenes mensuales para usuario: ${userId}`);

      const monthlyVolumes = await this.monthlyVolumeRankRepository.find({
        where: { userId },
        relations: ['assignedRank'],
        order: { monthStartDate: 'DESC' },
      });

      this.logger.log(
        `Se encontraron ${monthlyVolumes.length} registros de volumen mensual para el usuario ${userId}`,
      );

      const monthlyVolumeDtos: MonthlyVolumeRankDto[] = monthlyVolumes.map(
        (volume) => ({
          id: volume.id,
          assignedRank: volume.assignedRank
            ? {
                id: volume.assignedRank.id,
                name: volume.assignedRank.name,
                code: volume.assignedRank.code,
              }
            : undefined,
          totalVolume: volume.totalVolume,
          leftVolume: volume.leftVolume,
          rightVolume: volume.rightVolume,
          leftDirects: volume.leftDirects,
          rightDirects: volume.rightDirects,
          monthStartDate: volume.monthStartDate,
          monthEndDate: volume.monthEndDate,
          status: volume.status,
          metadata: volume.metadata,
          createdAt: volume.createdAt,
          updatedAt: volume.updatedAt,
        }),
      );

      return paginate(monthlyVolumeDtos, paginationDto);
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      this.logger.error(
        `Error al obtener volúmenes mensuales para usuario ${getUserMonthlyVolumesDto.userId}: ${errorMessage}`,
      );

      if (error instanceof RpcException) {
        throw error;
      }

      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: `Error interno del servidor: ${errorMessage}`,
        service: 'monthly_volume',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async createMonthlyVolume(
    createMonthlyVolumeDto: CreateMonthlyVolumeDto,
  ): Promise<CreateMonthlyVolumeResponseDto> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      this.logger.log(
        `Iniciando asignación de volúmenes mensuales para ${createMonthlyVolumeDto.users.length} usuarios`,
      );

      const processedItems: ProcessedMonthlyVolumeDto[] = [];
      const failedItems: FailedMonthlyVolumeDto[] = [];

      for (const userAssignment of createMonthlyVolumeDto.users) {
        try {
          await this.updateMonthlyVolume(
            userAssignment,
            createMonthlyVolumeDto.volume,
            queryRunner,
            processedItems,
          );

          this.logger.log(
            `Volumen mensual procesado para usuario ${userAssignment.userId}: ${createMonthlyVolumeDto.volume} en lado ${userAssignment.site}`,
          );
        } catch (error) {
          const errorMessage = this.getErrorMessage(error);
          this.logger.error(
            `Error procesando usuario ${userAssignment.userId}: ${errorMessage}`,
          );
          const failedItem = new FailedMonthlyVolumeDto();
          failedItem.userId = userAssignment.userId;
          failedItem.reason = `Error al procesar: ${errorMessage}`;
          failedItems.push(failedItem);
        }
      }

      await queryRunner.commitTransaction();

      this.logger.log(
        `Asignación de volúmenes mensuales completada: ${processedItems.length} exitosos, ${failedItems.length} fallidos`,
      );

      return {
        processed: processedItems,
        failed: failedItems,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      const errorMessage = this.getErrorMessage(error);
      this.logger.error(
        `Error en asignación de volúmenes mensuales: ${errorMessage}`,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async updateMonthlyVolume(
    userData: MonthlyVolumeUserAssignmentDto,
    binaryPoints: number,
    queryRunner: QueryRunner,
    processedItems: ProcessedMonthlyVolumeDto[],
  ) {
    try {
      const { userId, userName, userEmail, site, leftDirects, rightDirects } =
        userData;
      const { monthStartDate, monthEndDate } = this.getCurrentMonthDates();

      const existingVolume = await this.monthlyVolumeRankRepository.findOne({
        where: {
          userId: userId,
          status: MonthlyVolumeStatus.PENDING,
          monthStartDate: monthStartDate,
          monthEndDate: monthEndDate,
        },
      });

      let monthlyVolume: MonthlyVolumeRank;
      let action: 'created' | 'updated';

      if (existingVolume) {
        if (site === VolumeSide.LEFT) {
          existingVolume.leftVolume =
            Number(existingVolume.leftVolume) + Number(binaryPoints);
          if (leftDirects !== undefined) {
            existingVolume.leftDirects =
              (existingVolume.leftDirects || 0) + leftDirects;
          }
        } else {
          existingVolume.rightVolume =
            Number(existingVolume.rightVolume) + Number(binaryPoints);
          if (rightDirects !== undefined) {
            existingVolume.rightDirects =
              (existingVolume.rightDirects || 0) + rightDirects;
          }
        }

        existingVolume.totalVolume =
          Number(existingVolume.leftVolume) +
          Number(existingVolume.rightVolume);

        monthlyVolume = existingVolume;
        action = 'updated';

        this.logger.log(
          `Volumen mensual actualizado para usuario ${userId}: +${binaryPoints} en lado ${site}`,
        );
      } else {
        const newVolume = this.monthlyVolumeRankRepository.create({
          userId: userId,
          userEmail: userEmail,
          userName: userName,
          leftVolume: site === VolumeSide.LEFT ? binaryPoints : 0,
          rightVolume: site === VolumeSide.RIGHT ? binaryPoints : 0,
          totalVolume: binaryPoints,
          leftDirects: site === VolumeSide.LEFT ? leftDirects || 0 : 0,
          rightDirects: site === VolumeSide.RIGHT ? rightDirects || 0 : 0,
          monthStartDate: monthStartDate,
          monthEndDate: monthEndDate,
          status: MonthlyVolumeStatus.PENDING,
          metadata: {
            createdBy: 'bulk_monthly_volume_assignment',
            createdAt: new Date().toISOString(),
          },
        });

        monthlyVolume = newVolume;
        action = 'created';

        this.logger.log(
          `Nuevo volumen mensual creado para usuario ${userId}: ${binaryPoints} en lado ${site}`,
        );
      }

      const savedMonthlyVolume = await queryRunner.manager.save(monthlyVolume);

      const processedItem = new ProcessedMonthlyVolumeDto();
      processedItem.userId = userId;
      processedItem.side = site;
      processedItem.volumeAdded = binaryPoints;
      processedItem.directsAdded =
        site === VolumeSide.LEFT ? leftDirects : rightDirects;
      processedItem.action = action;
      processedItem.monthlyVolumeId = savedMonthlyVolume.id;
      processedItem.totalVolumeAfter = savedMonthlyVolume.totalVolume;
      processedItems.push(processedItem);
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      this.logger.error(`Error al actualizar volumen mensual: ${errorMessage}`);
      throw error;
    }
  }

  private getCurrentMonthDates(): { monthStartDate: Date; monthEndDate: Date } {
    const now = new Date();

    const monthStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
    monthStartDate.setHours(0, 0, 0, 0);

    const monthEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    monthEndDate.setHours(23, 59, 59, 999);

    return { monthStartDate, monthEndDate };
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object' && 'message' in error)
      return String(error.message);
    return 'Error desconocido';
  }
}
