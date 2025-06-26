import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { envs } from 'src/config/envs';
import {
  WeeklyVolume,
  VolumeProcessingStatus,
  VolumeSide,
} from 'src/weekly-volume/entities/weekly-volume.entity';
import { WeeklyVolumeHistory } from 'src/weekly-volume/entities/weekly-volume-history.entity';
import {
  WeeklyVolumeMigrationData,
  WeeklyVolumeMigrationResult,
} from '../interfaces/weekly-volume.interfaces';

@Injectable()
export class WeeklyVolumeMigrationService {
  private readonly logger = new Logger(WeeklyVolumeMigrationService.name);
  private readonly usersClient: ClientProxy;

  // Set para controlar IDs procesados
  private processedWeeklyVolumeIds = new Set<number>();

  // Contador autoincremental para WeeklyVolumeHistory IDs
  private historyIdCounter = 1;

  constructor(
    @InjectRepository(WeeklyVolume)
    private weeklyVolumeRepository: Repository<WeeklyVolume>,
    @InjectRepository(WeeklyVolumeHistory)
    private weeklyVolumeHistoryRepository: Repository<WeeklyVolumeHistory>,
  ) {
    this.usersClient = ClientProxyFactory.create({
      transport: Transport.NATS,
      options: {
        servers: [envs.NATS_SERVERS],
      },
    });
  }

  async migrateWeeklyVolumes(
    weeklyVolumesData: WeeklyVolumeMigrationData[],
  ): Promise<WeeklyVolumeMigrationResult> {
    this.logger.log('🚀 Iniciando migración de volúmenes semanales...');

    const result: WeeklyVolumeMigrationResult = {
      success: true,
      message: '',
      details: {
        weeklyVolumes: { total: 0, created: 0, skipped: 0, errors: [] },
        weeklyVolumeHistory: { total: 0, created: 0, skipped: 0, errors: [] },
      },
    };

    try {
      // Limpiar set de IDs procesados
      this.processedWeeklyVolumeIds.clear();

      // Inicializar contador autoincremental
      await this.initializeHistoryIdCounter();

      // Paso 1: Crear WeeklyVolumes
      this.logger.log('📊 Creando volúmenes semanales...');
      await this.createWeeklyVolumes(
        weeklyVolumesData,
        result.details.weeklyVolumes,
      );

      // Paso 2: Crear WeeklyVolumeHistory
      this.logger.log('📜 Creando historial de volúmenes...');
      await this.createWeeklyVolumeHistory(
        weeklyVolumesData,
        result.details.weeklyVolumeHistory,
      );

      result.message =
        'Migración de volúmenes semanales completada exitosamente';
      this.logger.log(
        '✅ Migración de volúmenes semanales completada exitosamente',
      );
    } catch (error) {
      result.success = false;
      result.message = `Error durante la migración de volúmenes semanales: ${error.message}`;
      this.logger.error(
        '❌ Error durante la migración de volúmenes semanales:',
        error,
      );
      throw error;
    }

    return result;
  }

  private async createWeeklyVolumes(
    weeklyVolumesData: WeeklyVolumeMigrationData[],
    details: any,
  ): Promise<void> {
    details.total = weeklyVolumesData.length;

    for (const volumeData of weeklyVolumesData) {
      try {
        // Verificar si el volumen semanal ya existe por ID
        const existingVolume = await this.weeklyVolumeRepository.findOne({
          where: { id: volumeData.id },
        });

        if (existingVolume) {
          this.logger.warn(
            `⚠️ WeeklyVolume con ID ${volumeData.id} ya existe, saltando...`,
          );
          this.processedWeeklyVolumeIds.add(volumeData.id);
          details.skipped++;
          continue;
        }

        // Buscar información del usuario por email
        const userInfo = await this.getUserByEmail(volumeData.userEmail.trim());

        if (!userInfo) {
          const errorMsg = `Usuario no encontrado: ${volumeData.userEmail}`;
          details.errors.push(errorMsg);
          this.logger.warn(`⚠️ ${errorMsg}`);
          continue;
        }

        // Crear nuevo volumen semanal conservando el ID original
        const newWeeklyVolume = this.weeklyVolumeRepository.create({
          id: volumeData.id, // ⭐ Conservar el ID original
          userId: userInfo.id,
          userEmail: userInfo.email,
          userName: userInfo.fullName,
          leftVolume: Number(volumeData.leftVolume),
          rightVolume: Number(volumeData.rightVolume),
          commissionEarned: volumeData.commissionEarned
            ? Number(volumeData.commissionEarned)
            : undefined,
          weekStartDate: new Date(volumeData.weekStartDate),
          weekEndDate: new Date(volumeData.weekEndDate),
          status: this.mapVolumeProcessingStatus(volumeData.status),
          selectedSide: volumeData.selectedSide
            ? this.mapVolumeSide(volumeData.selectedSide)
            : undefined,
          processedAt: volumeData.processedAt
            ? new Date(volumeData.processedAt)
            : undefined,
          metadata: volumeData.metadata || undefined,
          createdAt: new Date(volumeData.createdAt),
          updatedAt: new Date(volumeData.createdAt), // Usar createdAt como updatedAt por defecto
        });

        const savedVolume =
          await this.weeklyVolumeRepository.save(newWeeklyVolume);
        this.processedWeeklyVolumeIds.add(volumeData.id);
        details.created++;

        this.logger.log(
          `✅ WeeklyVolume creado: ${volumeData.userEmail} (L:${volumeData.leftVolume}, R:${volumeData.rightVolume}) -> ID: ${savedVolume.id} (conservado)`,
        );
      } catch (error) {
        const errorMsg = `Error creando WeeklyVolume ${volumeData.id} para ${volumeData.userEmail}: ${error.message}`;
        details.errors.push(errorMsg);
        this.logger.error(`❌ ${errorMsg}`);
      }
    }
  }

  private async createWeeklyVolumeHistory(
    weeklyVolumesData: WeeklyVolumeMigrationData[],
    details: any,
  ): Promise<void> {
    // Contar total de history entries
    details.total = weeklyVolumesData.reduce(
      (total, volume) => total + (volume.history?.length || 0),
      0,
    );

    for (const volumeData of weeklyVolumesData) {
      if (!volumeData.history || volumeData.history.length === 0) {
        continue;
      }

      // Verificar que el WeeklyVolume fue procesado
      if (!this.processedWeeklyVolumeIds.has(volumeData.id)) {
        const errorMsg = `WeeklyVolume ${volumeData.id} no fue procesado para crear historial`;
        details.errors.push(errorMsg);
        this.logger.error(`❌ ${errorMsg}`);
        continue;
      }

      // Buscar el volumen por ID
      const weeklyVolume = await this.weeklyVolumeRepository.findOne({
        where: { id: volumeData.id },
      });

      if (!weeklyVolume) {
        const errorMsg = `WeeklyVolume con ID ${volumeData.id} no encontrado para crear historial`;
        details.errors.push(errorMsg);
        this.logger.error(`❌ ${errorMsg}`);
        continue;
      }

      for (const historyData of volumeData.history) {
        try {
          const newHistory = this.weeklyVolumeHistoryRepository.create({
            id: this.getNextHistoryId(), // Usar contador autoincremental
            weeklyVolume: weeklyVolume,
            paymentId: historyData.payment_id?.toString() || undefined,
            volumeSide: historyData.volumeSide
              ? this.mapVolumeSide(historyData.volumeSide)
              : undefined,
            volume: Number(historyData.volume),
            metadata: {
              originalWeeklyVolumeId: volumeData.id,
              migrationDate: new Date().toISOString(),
            },
            createdAt: new Date(historyData.createdAt),
            updatedAt: new Date(historyData.updatedAt),
          });

          await this.weeklyVolumeHistoryRepository.save(newHistory);
          details.created++;

          this.logger.log(
            `✅ WeeklyVolumeHistory creado para volumen ${volumeData.id}: ${historyData.volumeSide} ${historyData.volume}`,
          );
        } catch (error) {
          const errorMsg = `Error creando WeeklyVolumeHistory para volumen ${volumeData.id}: ${error.message}`;
          details.errors.push(errorMsg);
          this.logger.error(`❌ ${errorMsg}`);
        }
      }
    }
  }

  private async getUserByEmail(email: string): Promise<{
    id: string;
    email: string;
    fullName: string;
  } | null> {
    try {
      const user = await firstValueFrom(
        this.usersClient.send(
          { cmd: 'user.findByEmailMS' },
          { email: email.toLowerCase().trim() },
        ),
      );

      if (!user) {
        return null;
      }

      return {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
      };
    } catch (error) {
      this.logger.error(`Error buscando usuario por email ${email}:`, error);
      return null;
    }
  }

  private mapVolumeProcessingStatus(status: string): VolumeProcessingStatus {
    switch (status.toUpperCase()) {
      case 'PENDING':
        return VolumeProcessingStatus.PENDING;
      case 'PROCESSED':
        return VolumeProcessingStatus.PROCESSED;
      case 'CANCELLED':
        return VolumeProcessingStatus.CANCELLED;
      default:
        return VolumeProcessingStatus.PENDING;
    }
  }

  private mapVolumeSide(side: string): VolumeSide {
    switch (side.toUpperCase()) {
      case 'LEFT':
        return VolumeSide.LEFT;
      case 'RIGHT':
        return VolumeSide.RIGHT;
      default:
        return VolumeSide.LEFT;
    }
  }

  /**
   * Inicializa el contador autoincremental obteniendo el último ID usado
   */
  private async initializeHistoryIdCounter(): Promise<void> {
    try {
      const lastHistory = await this.weeklyVolumeHistoryRepository
        .createQueryBuilder('history')
        .select('MAX(history.id)', 'maxId')
        .getRawOne();

      const maxId = lastHistory?.maxId || 0;
      this.historyIdCounter = maxId + 1;

      this.logger.log(
        `💡 Contador de WeeklyVolumeHistory inicializado en: ${this.historyIdCounter}`,
      );
    } catch (error) {
      this.logger.warn(
        `⚠️ Error inicializando contador, usando valor por defecto: ${error.message}`,
      );
      this.historyIdCounter = 1;
    }
  }

  /**
   * Obtiene el siguiente ID autoincremental para WeeklyVolumeHistory
   */
  private getNextHistoryId(): number {
    return this.historyIdCounter++;
  }

  validateWeeklyVolumeData(weeklyVolumesData: any[]): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!Array.isArray(weeklyVolumesData)) {
      errors.push('Los datos de volúmenes semanales deben ser un array');
      return { valid: false, errors };
    }

    weeklyVolumesData.forEach((volume, index) => {
      // Validar campos requeridos
      const requiredFields = [
        'id',
        'userEmail',
        'leftVolume',
        'rightVolume',
        'weekStartDate',
        'weekEndDate',
        'status',
        'createdAt',
      ];

      for (const field of requiredFields) {
        if (volume[field] === undefined || volume[field] === null) {
          errors.push(
            `WeeklyVolume en índice ${index} falta el campo requerido: ${field}`,
          );
        }
      }

      // Validar que el ID sea un número válido
      if (volume.id !== undefined) {
        const volumeId = Number(volume.id);
        if (isNaN(volumeId) || volumeId <= 0) {
          errors.push(
            `WeeklyVolume en índice ${index} tiene un ID inválido: ${volume.id}`,
          );
        }
      }

      // Validar valores numéricos
      const numericFields = ['leftVolume', 'rightVolume'];

      for (const field of numericFields) {
        if (
          volume[field] !== undefined &&
          (isNaN(Number(volume[field])) || Number(volume[field]) < 0)
        ) {
          errors.push(
            `WeeklyVolume en índice ${index} tiene un valor inválido para ${field}: ${volume[field]}`,
          );
        }
      }

      // Validar commissionEarned si existe
      if (
        volume.commissionEarned !== undefined &&
        volume.commissionEarned !== null &&
        (isNaN(Number(volume.commissionEarned)) ||
          Number(volume.commissionEarned) < 0)
      ) {
        errors.push(
          `WeeklyVolume en índice ${index} tiene un valor inválido para commissionEarned: ${volume.commissionEarned}`,
        );
      }

      // Validar fechas
      if (
        volume.weekStartDate &&
        isNaN(Date.parse(volume.weekStartDate as string))
      ) {
        errors.push(
          `WeeklyVolume en índice ${index} tiene una fecha de inicio inválida: ${volume.weekStartDate}`,
        );
      }

      if (
        volume.weekEndDate &&
        isNaN(Date.parse(volume.weekEndDate as string))
      ) {
        errors.push(
          `WeeklyVolume en índice ${index} tiene una fecha de fin inválida: ${volume.weekEndDate}`,
        );
      }

      // Validar status

      // Validar selectedSide si existe

      // Validar history si existe
      if (volume.history && Array.isArray(volume.history)) {
        volume.history.forEach((history: any, histIndex: number) => {
          const requiredHistFields = ['volume', 'createdAt', 'updatedAt'];

          for (const field of requiredHistFields) {
            if (history[field] === undefined || history[field] === null) {
              errors.push(
                `Historia ${histIndex} en WeeklyVolume ${index} falta el campo requerido: ${field}`,
              );
            }
          }

          // Validar volume numérico
          if (
            history.volume !== undefined &&
            (isNaN(Number(history.volume)) || Number(history.volume) < 0)
          ) {
            errors.push(
              `Historia ${histIndex} en WeeklyVolume ${index} tiene un volume inválido: ${history.volume}`,
            );
          }

          // Validar payment_id si existe
          if (
            history.payment_id !== undefined &&
            history.payment_id !== null &&
            (isNaN(Number(history.payment_id)) ||
              Number(history.payment_id) <= 0)
          ) {
            errors.push(
              `Historia ${histIndex} en WeeklyVolume ${index} tiene un payment_id inválido: ${history.payment_id}`,
            );
          }
        });
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    return emailRegex.test(email);
  }

  async onModuleDestroy() {
    await this.usersClient.close();
  }
}
