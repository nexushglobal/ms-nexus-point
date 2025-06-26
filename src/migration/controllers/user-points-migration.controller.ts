import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { UserPointsMigrationData } from '../interfaces/user-points.interfaces';
import { UserPointsMigrationService } from '../services/user-points-migration.service';

interface UserPointsMigrationPayload {
  userPoints: UserPointsMigrationData[];
}

@Controller()
export class UserPointsMigrationController {
  private readonly logger = new Logger(UserPointsMigrationController.name);

  constructor(
    private readonly userPointsMigrationService: UserPointsMigrationService,
  ) {}

  @MessagePattern({ cmd: 'point.migrate.userPoints' })
  async migrateUserPoints(@Payload() payload: UserPointsMigrationPayload) {
    this.logger.log('📨 Solicitud de migración de puntos de usuarios recibida');

    if (!payload.userPoints || !Array.isArray(payload.userPoints)) {
      throw new Error(
        'Faltan datos requeridos: userPoints es obligatorio y debe ser un array',
      );
    }

    this.logger.log(
      `📊 Total de registros de puntos de usuarios a migrar: ${payload.userPoints.length}`,
    );

    // Contar transacciones y payments totales para logging
    const totalTransactions = payload.userPoints.reduce(
      (total, up) => total + (up.transactions?.length || 0),
      0,
    );

    const totalPayments = payload.userPoints.reduce(
      (total, up) =>
        total +
        (up.transactions?.reduce(
          (txTotal, tx) => txTotal + (tx.payments?.length || 0),
          0,
        ) || 0),
      0,
    );

    this.logger.log(`📊 Total de transacciones a migrar: ${totalTransactions}`);
    this.logger.log(`📊 Total de payments a migrar: ${totalPayments}`);

    const validation = this.userPointsMigrationService.validateUserPointsData(
      payload.userPoints,
    );

    if (!validation.valid) {
      throw new Error(
        `Datos de puntos de usuarios inválidos: ${validation.errors.join(', ')}`,
      );
    }

    const result = await this.userPointsMigrationService.migrateUserPoints(
      payload.userPoints,
    );

    return result;
  }
}
