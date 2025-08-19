import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { MonthlyVolumeRank } from './entities/monthly_volume_ranks.entity';
import { GetUserMonthlyVolumesDto } from './dto/get-user-monthly-volumes.dto';
import { MonthlyVolumeRankDto } from './dto/monthly-volume-rank-response.dto';
import { Paginated } from 'src/common/dto/paginated.dto';
import { paginate } from 'src/common/helpers/paginate.helper';

@Injectable()
export class MonthlyVolumeService {
  private readonly logger = new Logger(MonthlyVolumeService.name);

  constructor(
    @InjectRepository(MonthlyVolumeRank)
    private readonly monthlyVolumeRankRepository: Repository<MonthlyVolumeRank>,
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

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object' && 'message' in error)
      return String(error.message);
    return 'Error desconocido';
  }
}
