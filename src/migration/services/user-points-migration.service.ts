// src/migration/services/user-points-migration.service.ts

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
import { UserPoints } from 'src/point/entities/user-points.entity';
import {
  PointsTransaction,
  PointTransactionType,
  PointTransactionStatus,
} from 'src/point/entities/points-transaction.entity';
import { PointsTransactionPayment } from 'src/point/entities/points-transaction-payment.entity';
import {
  UserPointsMigrationData,
  UserPointsMigrationResult,
} from '../interfaces/user-points.interfaces';

@Injectable()
export class UserPointsMigrationService {
  private readonly logger = new Logger(UserPointsMigrationService.name);
  private readonly usersClient: ClientProxy;
  private readonly paymentClient: ClientProxy;

  // Sets para controlar IDs procesados
  private processedUserPointsIds = new Set<number>();
  private processedTransactionIds = new Set<number>();

  // Contador autoincremental para PointsTransactionPayment IDs
  private paymentIdCounter = 1;

  constructor(
    @InjectRepository(UserPoints)
    private userPointsRepository: Repository<UserPoints>,
    @InjectRepository(PointsTransaction)
    private pointsTransactionRepository: Repository<PointsTransaction>,
    @InjectRepository(PointsTransactionPayment)
    private pointsTransactionPaymentRepository: Repository<PointsTransactionPayment>,
  ) {
    this.usersClient = ClientProxyFactory.create({
      transport: Transport.NATS,
      options: {
        servers: [envs.NATS_SERVERS],
      },
    });

    this.paymentClient = ClientProxyFactory.create({
      transport: Transport.NATS,
      options: {
        servers: [envs.NATS_SERVERS],
      },
    });
  }

  async migrateUserPoints(
    userPointsData: UserPointsMigrationData[],
  ): Promise<UserPointsMigrationResult> {
    this.logger.log('🚀 Iniciando migración de puntos de usuarios...');

    const result: UserPointsMigrationResult = {
      success: true,
      message: '',
      details: {
        userPoints: { total: 0, created: 0, skipped: 0, errors: [] },
        pointsTransactions: { total: 0, created: 0, skipped: 0, errors: [] },
        pointsTransactionPayments: {
          total: 0,
          created: 0,
          skipped: 0,
          errors: [],
        },
      },
    };

    try {
      // Limpiar sets de IDs procesados
      this.processedUserPointsIds.clear();
      this.processedTransactionIds.clear();

      // Inicializar contador autoincremental
      await this.initializePaymentIdCounter();

      // Paso 1: Crear UserPoints
      this.logger.log('💰 Creando registros de puntos de usuarios...');
      await this.createUserPoints(userPointsData, result.details.userPoints);

      // Paso 2: Crear PointsTransactions
      this.logger.log('📊 Creando transacciones de puntos...');
      await this.createPointsTransactions(
        userPointsData,
        result.details.pointsTransactions,
      );

      // Paso 3: Crear PointsTransactionPayments
      this.logger.log('💳 Creando relaciones transacción-pago...');
      await this.createPointsTransactionPayments(
        userPointsData,
        result.details.pointsTransactionPayments,
      );

      result.message =
        'Migración de puntos de usuarios completada exitosamente';
      this.logger.log(
        '✅ Migración de puntos de usuarios completada exitosamente',
      );
    } catch (error) {
      result.success = false;
      result.message = `Error durante la migración de puntos de usuarios: ${error.message}`;
      this.logger.error(
        '❌ Error durante la migración de puntos de usuarios:',
        error,
      );
      throw error;
    }

    return result;
  }

  private async createUserPoints(
    userPointsData: UserPointsMigrationData[],
    details: any,
  ): Promise<void> {
    details.total = userPointsData.length;

    for (const userPointData of userPointsData) {
      try {
        // Verificar si el registro de puntos ya existe por ID
        const existingUserPoints = await this.userPointsRepository.findOne({
          where: { id: userPointData.id },
        });

        if (existingUserPoints) {
          this.logger.warn(
            `⚠️ UserPoints con ID ${userPointData.id} ya existe, saltando...`,
          );
          this.processedUserPointsIds.add(userPointData.id);
          details.skipped++;
          continue;
        }

        // Buscar información del usuario por email
        const userInfo = await this.getUserByEmail(
          userPointData.userEmail.trim(),
        );

        if (!userInfo) {
          const errorMsg = `Usuario no encontrado: ${userPointData.userEmail}`;
          details.errors.push(errorMsg);
          this.logger.warn(`⚠️ ${errorMsg}`);
          continue;
        }

        // Crear nuevo registro de puntos conservando el ID original
        const newUserPoints = this.userPointsRepository.create({
          id: userPointData.id, // ⭐ Conservar el ID original
          userId: userInfo.id,
          userEmail: userInfo.email,
          userName: userInfo.fullName,
          availablePoints: Number(userPointData.availablePoints),
          totalEarnedPoints: Number(userPointData.totalEarnedPoints),
          totalWithdrawnPoints: Number(userPointData.totalWithdrawnPoints),
          metadata: {
            originalId: userPointData.id,
            migrationDate: new Date().toISOString(),
          },
        });

        const savedUserPoints =
          await this.userPointsRepository.save(newUserPoints);
        this.processedUserPointsIds.add(userPointData.id);
        details.created++;

        this.logger.log(
          `✅ UserPoints creado: ${userPointData.userEmail} (${userPointData.availablePoints} pts) -> ID: ${savedUserPoints.id} (conservado)`,
        );
      } catch (error) {
        const errorMsg = `Error creando UserPoints ${userPointData.id} para ${userPointData.userEmail}: ${error.message}`;
        details.errors.push(errorMsg);
        this.logger.error(`❌ ${errorMsg}`);
      }
    }
  }

  private async createPointsTransactions(
    userPointsData: UserPointsMigrationData[],
    details: any,
  ): Promise<void> {
    // Contar total de transacciones
    details.total = userPointsData.reduce(
      (total, userPoints) => total + (userPoints.transactions?.length || 0),
      0,
    );

    for (const userPointData of userPointsData) {
      if (
        !userPointData.transactions ||
        userPointData.transactions.length === 0
      ) {
        continue;
      }

      // Verificar que el UserPoints fue procesado
      if (!this.processedUserPointsIds.has(userPointData.id)) {
        const errorMsg = `UserPoints ${userPointData.id} no fue procesado para crear transacciones`;
        details.errors.push(errorMsg);
        this.logger.error(`❌ ${errorMsg}`);
        continue;
      }

      // Buscar información del usuario por email (para las transacciones)
      const userInfo = await this.getUserByEmail(
        userPointData.userEmail.trim(),
      );

      if (!userInfo) {
        const errorMsg = `Usuario no encontrado para transacciones: ${userPointData.userEmail}`;
        details.errors.push(errorMsg);
        this.logger.error(`❌ ${errorMsg}`);
        continue;
      }

      for (const transactionData of userPointData.transactions) {
        try {
          // Verificar si la transacción ya existe por ID
          const existingTransaction =
            await this.pointsTransactionRepository.findOne({
              where: { id: transactionData.id },
            });

          if (existingTransaction) {
            this.logger.warn(
              `⚠️ PointsTransaction con ID ${transactionData.id} ya existe, saltando...`,
            );
            this.processedTransactionIds.add(transactionData.id);
            details.skipped++;
            continue;
          }

          const newTransaction = this.pointsTransactionRepository.create({
            id: transactionData.id, // ⭐ Conservar el ID original
            userId: userInfo.id,
            userEmail: userInfo.email,
            userName: userInfo.fullName,
            type: this.mapTransactionType(transactionData.type),
            amount: Number(transactionData.amount),
            pendingAmount: Number(transactionData.pendingAmount),
            withdrawnAmount: Number(transactionData.withdrawnAmount),
            status: this.mapTransactionStatus(transactionData.status),
            isArchived: Boolean(transactionData.isArchived),
            createdAt: new Date(transactionData.createdAt),
            updatedAt: new Date(transactionData.createdAt), // Usar createdAt como updatedAt
          });

          const savedTransaction =
            await this.pointsTransactionRepository.save(newTransaction);
          this.processedTransactionIds.add(transactionData.id);
          details.created++;

          this.logger.log(
            `✅ PointsTransaction creada: ${transactionData.type} (${transactionData.amount}) -> ID: ${savedTransaction.id} (conservado)`,
          );
        } catch (error) {
          const errorMsg = `Error creando PointsTransaction ${transactionData.id}: ${error.message}`;
          details.errors.push(errorMsg);
          this.logger.error(`❌ ${errorMsg}`);
        }
      }
    }
  }

  private async createPointsTransactionPayments(
    userPointsData: UserPointsMigrationData[],
    details: any,
  ): Promise<void> {
    // Contar total de payments
    details.total = userPointsData.reduce(
      (total, userPoints) =>
        total +
        (userPoints.transactions?.reduce(
          (txTotal, tx) => txTotal + (tx.payments?.length || 0),
          0,
        ) || 0),
      0,
    );

    // Recopilar todos los IDs de pagos para búsqueda en lote
    const allPaymentIds = new Set<number>();
    userPointsData.forEach((userPointData) => {
      userPointData.transactions?.forEach((transactionData) => {
        transactionData.payments?.forEach((paymentData) => {
          allPaymentIds.add(paymentData.payment_id);
        });
      });
    });

    // Obtener información de todos los pagos de una vez
    const paymentsInfo = await this.getPaymentInfoBatch(
      Array.from(allPaymentIds),
    );
    this.logger.log(
      `📊 Información obtenida para ${Object.keys(paymentsInfo).length} pagos de ${allPaymentIds.size} solicitados`,
    );

    for (const userPointData of userPointsData) {
      if (
        !userPointData.transactions ||
        userPointData.transactions.length === 0
      ) {
        continue;
      }

      for (const transactionData of userPointData.transactions) {
        if (
          !transactionData.payments ||
          transactionData.payments.length === 0
        ) {
          continue;
        }

        // Verificar que la transacción fue procesada
        if (!this.processedTransactionIds.has(transactionData.id)) {
          const errorMsg = `PointsTransaction ${transactionData.id} no fue procesada para crear payments`;
          details.errors.push(errorMsg);
          this.logger.error(`❌ ${errorMsg}`);
          continue;
        }

        // Buscar la transacción por ID
        const transaction = await this.pointsTransactionRepository.findOne({
          where: { id: transactionData.id },
        });

        if (!transaction) {
          const errorMsg = `PointsTransaction con ID ${transactionData.id} no encontrada para crear payments`;
          details.errors.push(errorMsg);
          this.logger.error(`❌ ${errorMsg}`);
          continue;
        }

        for (const paymentData of transactionData.payments) {
          try {
            // Verificar si el payment ya existe
            const existingPayment =
              await this.pointsTransactionPaymentRepository.findOne({
                where: {
                  pointsTransaction: { id: transactionData.id },
                  paymentId: paymentData.payment_id,
                },
              });

            if (existingPayment) {
              this.logger.warn(
                `⚠️ PointsTransactionPayment ya existe para transacción ${transactionData.id} y pago ${paymentData.payment_id}, saltando...`,
              );
              details.skipped++;
              continue;
            }

            // Obtener información del pago desde la cache
            const paymentInfo = paymentsInfo[paymentData.payment_id];

            const newPayment = this.pointsTransactionPaymentRepository.create({
              id: this.getNextPaymentId(), // Usar contador autoincremental
              pointsTransaction: transaction,
              paymentId: paymentData.payment_id,
              amount: transaction.amount, // Usar el monto de la transacción
              paymentReference: paymentInfo?.operationCode || undefined,
              paymentMethod: paymentInfo?.paymentMethod || undefined,
              notes: paymentInfo
                ? `Pago ${paymentInfo.paymentMethod} - ${paymentInfo.status}`
                : undefined,
              metadata: {
                originalTransactionId: transactionData.id,
                originalPaymentId: paymentData.payment_id,
                migrationDate: new Date().toISOString(),
                paymentInfo: paymentInfo || null,
              },
              createdAt: new Date(paymentData.createdAt),
              updatedAt: new Date(paymentData.updatedAt),
            });

            await this.pointsTransactionPaymentRepository.save(newPayment);
            details.created++;

            this.logger.log(
              `✅ PointsTransactionPayment creado para transacción ${transactionData.id} y pago ${paymentData.payment_id}`,
            );
          } catch (error) {
            const errorMsg = `Error creando PointsTransactionPayment para transacción ${transactionData.id} y pago ${paymentData.payment_id}: ${error.message}`;
            details.errors.push(errorMsg);
            this.logger.error(`❌ ${errorMsg}`);
          }
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

  private async getPaymentInfo(paymentId: number): Promise<{
    operationCode?: string;
    paymentMethod?: string;
    status?: string;
    amount?: number;
  } | null> {
    try {
      const payment = await firstValueFrom(
        this.paymentClient.send({ cmd: 'payment.findById' }, { id: paymentId }),
      );

      if (!payment) {
        return null;
      }

      return {
        operationCode: payment.operationCode,
        paymentMethod: payment.paymentMethod,
        status: payment.status,
        amount: payment.amount,
      };
    } catch (error) {
      this.logger.warn(
        `No se pudo obtener información del pago ${paymentId}:`,
        error.message,
      );
      return null;
    }
  }

  // Método optimizado para obtener múltiples pagos de una vez
  private async getPaymentInfoBatch(paymentIds: number[]): Promise<{
    [paymentId: number]: {
      operationCode?: string;
      paymentMethod?: string;
      status?: string;
      amount?: number;
    };
  }> {
    try {
      if (paymentIds.length === 0) {
        return {};
      }

      const payments = await firstValueFrom(
        this.paymentClient.send(
          { cmd: 'payment.findByIds' },
          { ids: paymentIds },
        ),
      );

      return payments || {};
    } catch (error) {
      this.logger.warn(
        `No se pudo obtener información de los pagos en lote:`,
        error.message,
      );
      return {};
    }
  }

  private mapTransactionType(type: string): PointTransactionType {
    switch (type.toUpperCase()) {
      case 'BINARY_COMMISSION':
        return PointTransactionType.BINARY_COMMISSION;
      case 'DIRECT_BONUS':
        return PointTransactionType.DIRECT_BONUS;
      case 'WITHDRAWAL':
        return PointTransactionType.WITHDRAWAL;
      default:
        return PointTransactionType.BINARY_COMMISSION;
    }
  }

  private mapTransactionStatus(status: string): PointTransactionStatus {
    switch (status.toUpperCase()) {
      case 'PENDING':
        return PointTransactionStatus.PENDING;
      case 'COMPLETED':
        return PointTransactionStatus.COMPLETED;
      case 'CANCELLED':
        return PointTransactionStatus.CANCELLED;
      case 'FAILED':
        return PointTransactionStatus.FAILED;
      default:
        return PointTransactionStatus.PENDING;
    }
  }

  private generatePaymentId(transactionId: number, paymentId: number): number {
    // Generar un ID único combinando los IDs de transacción y pago
    // Usando un timestamp para evitar colisiones
    const timestamp = Date.now() % 1000000; // Últimos 6 dígitos del timestamp
    return parseInt(`${transactionId}${paymentId}${timestamp}`);
  }

  /**
   * Inicializa el contador autoincremental obteniendo el último ID usado
   */
  private async initializePaymentIdCounter(): Promise<void> {
    try {
      const lastPayment = await this.pointsTransactionPaymentRepository
        .createQueryBuilder('payment')
        .select('MAX(payment.id)', 'maxId')
        .getRawOne();

      const maxId = lastPayment?.maxId || 0;
      this.paymentIdCounter = maxId + 1;

      this.logger.log(
        `💡 Contador de PointsTransactionPayment inicializado en: ${this.paymentIdCounter}`,
      );
    } catch (error) {
      this.logger.warn(
        `⚠️ Error inicializando contador, usando valor por defecto: ${error.message}`,
      );
      this.paymentIdCounter = 1;
    }
  }

  /**
   * Obtiene el siguiente ID autoincremental para PointsTransactionPayment
   */
  private getNextPaymentId(): number {
    return this.paymentIdCounter++;
  }

  validateUserPointsData(userPointsData: any[]): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!Array.isArray(userPointsData)) {
      errors.push('Los datos de puntos de usuarios deben ser un array');
      return { valid: false, errors };
    }

    userPointsData.forEach((userPoints, index) => {
      // Validar campos requeridos
      const requiredFields = [
        'id',
        'availablePoints',
        'totalEarnedPoints',
        'totalWithdrawnPoints',
        'userEmail',
        'transactions',
      ];

      for (const field of requiredFields) {
        if (userPoints[field] === undefined || userPoints[field] === null) {
          errors.push(
            `UserPoints en índice ${index} falta el campo requerido: ${field}`,
          );
        }
      }

      // Validar que el ID sea un número válido
      if (userPoints.id !== undefined) {
        const userPointsId = Number(userPoints.id);
        if (isNaN(userPointsId) || userPointsId <= 0) {
          errors.push(
            `UserPoints en índice ${index} tiene un ID inválido: ${userPoints.id}`,
          );
        }
      }

      // Validar valores numéricos
      const numericFields = [
        'availablePoints',
        'totalEarnedPoints',
        'totalWithdrawnPoints',
      ];

      for (const field of numericFields) {
        if (
          userPoints[field] !== undefined &&
          (isNaN(Number(userPoints[field])) || Number(userPoints[field]) < 0)
        ) {
          errors.push(
            `UserPoints en índice ${index} tiene un valor inválido para ${field}: ${userPoints[field]}`,
          );
        }
      }

      // Validar email
      if (userPoints.userEmail && !this.isValidEmail(userPoints.userEmail)) {
        errors.push(
          `UserPoints en índice ${index} tiene un email inválido: ${userPoints.userEmail}`,
        );
      }

      // Validar transacciones si existen
      if (userPoints.transactions && Array.isArray(userPoints.transactions)) {
        userPoints.transactions.forEach((transaction: any, txIndex: number) => {
          const requiredTxFields = [
            'id',
            'amount',
            'status',
            'pendingAmount',
            'withdrawnAmount',
            'isArchived',
            'type',
            'createdAt',
            'payments',
          ];

          for (const field of requiredTxFields) {
            if (
              transaction[field] === undefined ||
              transaction[field] === null
            ) {
              errors.push(
                `Transaction ${txIndex} en UserPoints ${index} falta el campo requerido: ${field}`,
              );
            }
          }

          // Validar payments si existen
          if (transaction.payments && Array.isArray(transaction.payments)) {
            transaction.payments.forEach((payment: any, payIndex: number) => {
              const requiredPayFields = [
                'points_transaction_id',
                'payment_id',
                'createdAt',
                'updatedAt',
              ];

              for (const field of requiredPayFields) {
                if (payment[field] === undefined || payment[field] === null) {
                  errors.push(
                    `Payment ${payIndex} en Transaction ${txIndex} en UserPoints ${index} falta el campo requerido: ${field}`,
                  );
                }
              }
            });
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
    await this.paymentClient.close();
  }
}
