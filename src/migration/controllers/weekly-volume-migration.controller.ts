import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { WeeklyVolumeMigrationData } from '../interfaces/weekly-volume.interfaces';
import { WeeklyVolumeMigrationService } from '../services/weekly-volume-migration.service';

interface WeeklyVolumeMigrationPayload {
  weeklyVolumes: WeeklyVolumeMigrationData[];
}

@Controller()
export class WeeklyVolumeMigrationController {
  private readonly logger = new Logger(WeeklyVolumeMigrationController.name);

  constructor(
    private readonly weeklyVolumeMigrationService: WeeklyVolumeMigrationService,
  ) {}

  @MessagePattern({ cmd: 'point.migrate.weeklyVolumes' })
  async migrateWeeklyVolumes(@Payload() payload: WeeklyVolumeMigrationPayload) {
    this.logger.log(
      '📨 Solicitud de migración de volúmenes semanales recibida',
    );

    if (!payload.weeklyVolumes || !Array.isArray(payload.weeklyVolumes)) {
      throw new Error(
        'Faltan datos requeridos: weeklyVolumes es obligatorio y debe ser un array',
      );
    }

    this.logger.log(
      `📊 Total de volúmenes semanales a migrar: ${payload.weeklyVolumes.length}`,
    );

    // Contar historial total para logging
    const totalHistory = payload.weeklyVolumes.reduce(
      (total, volume) => total + (volume.history?.length || 0),
      0,
    );

    this.logger.log(
      `📊 Total de entradas de historial a migrar: ${totalHistory}`,
    );

    const validation =
      this.weeklyVolumeMigrationService.validateWeeklyVolumeData(
        payload.weeklyVolumes,
      );

    if (!validation.valid) {
      throw new Error(
        `Datos de volúmenes semanales inválidos: ${validation.errors.join(', ')}`,
      );
    }

    const result = await this.weeklyVolumeMigrationService.migrateWeeklyVolumes(
      payload.weeklyVolumes,
    );

    return result;
  }
}
