import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PointsTransactionPayment } from '../entities/points-transaction-payment.entity';
import {
  PointsTransaction,
  PointTransactionType,
} from '../entities/points-transaction.entity';
import {
  WeeklyVolume,
  VolumeProcessingStatus,
} from '../../weekly-volume/entities/weekly-volume.entity';
import { WeeklyVolumeHistory } from '../../weekly-volume/entities/weekly-volume-history.entity';
import { Repository } from 'typeorm';

@Injectable()
export class PointsTransactionsPaymentService {
  constructor(
    @InjectRepository(PointsTransactionPayment)
    private readonly pointsTransactionsPaymentRepository: Repository<PointsTransactionPayment>,
    @InjectRepository(PointsTransaction)
    private readonly pointsTransactionRepository: Repository<PointsTransaction>,
    @InjectRepository(WeeklyVolume)
    private readonly weeklyVolumeRepository: Repository<WeeklyVolume>,
    @InjectRepository(WeeklyVolumeHistory)
    private readonly weeklyVolumeHistoryRepository: Repository<WeeklyVolumeHistory>,
  ) {}

  async findPaymentsByTransactionId(transactionId: string) {
    // 1. Obtener la transacción principal
    const transaction = await this.pointsTransactionRepository.findOne({
      where: { id: parseInt(transactionId) },
    });

    if (!transaction) {
      return [];
    }

    // 2. Obtener pagos de la transacción actual
    let allPaymentIds: { paymentId: string }[] = [];
    const currentPayments = await this.pointsTransactionsPaymentRepository
      .createQueryBuilder('payment')
      .select(['payment.paymentId'])
      .where('payment.pointsTransaction = :transactionId', {
        transactionId: parseInt(transactionId),
      })
      .getMany();

    allPaymentIds = currentPayments.map((p) => ({
      paymentId: p.paymentId.toString(),
    }));

    // 3. SI ES BINARY_COMMISSION, obtener pagos históricos
    if (transaction.type === PointTransactionType.BINARY_COMMISSION) {
      try {
        // Buscar el WeeklyVolume asociado a esta transacción
        const weeklyVolume = await this.weeklyVolumeRepository
          .createQueryBuilder('volume')
          .where('volume.userId = :userId', { userId: transaction.userId })
          .andWhere('volume.status = :status', {
            status: VolumeProcessingStatus.PROCESSED,
          })
          .andWhere('DATE(volume.createdAt) = DATE(:transactionDate)', {
            transactionDate: transaction.createdAt,
          })
          .orderBy('volume.createdAt', 'DESC')
          .getOne();

        if (weeklyVolume && weeklyVolume.selectedSide) {
          // Buscar la última vez que se procesó con el mismo selectedSide
          const lastSameSideVolume = await this.weeklyVolumeRepository
            .createQueryBuilder('volume')
            .where('volume.userId = :userId', { userId: transaction.userId })
            .andWhere('volume.status = :status', {
              status: VolumeProcessingStatus.PROCESSED,
            })
            .andWhere('volume.selectedSide = :selectedSide', {
              selectedSide: weeklyVolume.selectedSide,
            })
            .andWhere('volume.weekEndDate < :currentWeekEnd', {
              currentWeekEnd: new Date(weeklyVolume.weekEndDate),
            })
            .orderBy('volume.weekEndDate', 'DESC')
            .getOne();

          // Definir rango de fechas para buscar en el historial de volúmenes
          const startDate = lastSameSideVolume
            ? new Date(
                new Date(lastSameSideVolume.weekEndDate).getTime() +
                  24 * 60 * 60 * 1000,
              ) // día siguiente
            : undefined; // desde el inicio si no hay anterior

          // Buscar en WeeklyVolumeHistory TODOS los pagos del lado seleccionado
          const queryBuilder = this.weeklyVolumeHistoryRepository
            .createQueryBuilder('history')
            .innerJoin('history.weeklyVolume', 'volume')
            .where('volume.userId = :userId', { userId: transaction.userId })
            .andWhere('history.volumeSide = :selectedSide', {
              selectedSide: weeklyVolume.selectedSide,
            })
            .andWhere('history.paymentId IS NOT NULL')
            .andWhere('history.createdAt <= :endDate', {
              endDate: new Date(weeklyVolume.weekEndDate),
            });

          if (startDate) {
            queryBuilder.andWhere('history.createdAt >= :startDate', {
              startDate,
            });
          }

          const volumeHistory = await queryBuilder.getMany();

          // Obtener los paymentIds que generaron volumen del lado seleccionado
          // Solo incluir los que tienen paymentId (excluir incrementos automáticos)
          const historicalPaymentIds = volumeHistory
            .filter((h) => h.paymentId != null && h.paymentId !== '') // Filtrar null, undefined y vacíos
            .map((h) => ({
              paymentId: h.paymentId!.toString(), // ! porque ya filtramos null/undefined
            }));

          allPaymentIds = [...allPaymentIds, ...historicalPaymentIds];
        }
      } catch (error) {
        console.error(
          'Error obteniendo pagos históricos para BINARY_COMMISSION:',
          error,
        );
      }
    }
    // Eliminar duplicados
    const uniquePaymentIds = allPaymentIds.filter(
      (payment, index, self) =>
        index === self.findIndex((p) => p.paymentId === payment.paymentId),
    );
    return uniquePaymentIds;
  }
}
