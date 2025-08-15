/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserPoints } from '../entities/user-points.entity';

@Injectable()
export class PointsEventsService {
  private readonly logger = new Logger(PointsEventsService.name);

  constructor(
    private eventEmitter: EventEmitter2,
    @InjectRepository(UserPoints)
    private readonly userPointsRepository: Repository<UserPoints>,
  ) {}

  async emitPointsUpdate(userId: string): Promise<void> {
    try {
      const userPoints = await this.userPointsRepository.findOne({
        where: { userId },
      });

      if (!userPoints) {
        this.logger.warn(`No points found for user ${userId}`);
        return;
      }

      const pointsData = {
        availablePoints: userPoints.availablePoints,
        totalEarnedPoints: userPoints.totalEarnedPoints,
        totalWithdrawnPoints: userPoints.totalWithdrawnPoints,
      };

      this.eventEmitter.emit('points.updated', {
        userId,
        points: pointsData,
      });

      this.logger.log(`Points update emitted for user ${userId}`);
    } catch (error) {
      this.logger.error(
        `Error emitting points update: ${error.message}`,
        error.stack,
      );
    }
  }
}
