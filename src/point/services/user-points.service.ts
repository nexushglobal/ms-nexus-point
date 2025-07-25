import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserPoints } from '../entities/user-points.entity';
import { UsersService } from 'src/common/services/users.service';
import { RpcException } from '@nestjs/microservices';
import { MembershipService } from 'src/common/services/memberships.service';
import { PointsEventsService } from './points-events.service';

@Injectable()
export class UserPointsService {
  constructor(
    @InjectRepository(UserPoints)
    private readonly userPointsRepository: Repository<UserPoints>,
    private readonly usersService: UsersService,
    private readonly membershipService: MembershipService,
    private readonly pointsEventsService: PointsEventsService,
  ) {}

  async getUserPoints(userId: string) {
    const user = await this.usersService.getUser(userId);
    if (!user)
      throw new RpcException({
        status: HttpStatus.NOT_FOUND,
        message: `Usuario con ID ${userId} no encontrado`,
      });
    // try {
    let userPoints = await this.userPointsRepository.findOne({
      where: { userId },
    });
    if (!userPoints) {
      userPoints = this.userPointsRepository.create({
        userId: user.id,
        userName: user.lastName,
        userEmail: user.email,
        availablePoints: 0,
        totalEarnedPoints: 0,
        totalWithdrawnPoints: 0,
      });
      await this.userPointsRepository.save(userPoints);
    }
    const membershipInfo =
      await this.membershipService.getUserMembershipInfo(userId);
    await this.pointsEventsService.emitPointsUpdate(userId, membershipInfo);
    return {
      availablePoints: userPoints.availablePoints,
      totalEarnedPoints: userPoints.totalEarnedPoints,
      totalWithdrawnPoints: userPoints.totalWithdrawnPoints,
      membershipPlan: membershipInfo.plan
        ? {
            name: membershipInfo.plan.name,
          }
        : null,
    };
  }

  async getUserLotPoints(userId: string) {
    const user = await this.usersService.getUser(userId);
    if (!user)
      throw new RpcException({
        status: HttpStatus.NOT_FOUND,
        message: `Usuario con ID ${userId} no encontrado`,
      });
    // try {
    const userPoints = await this.userPointsRepository.findOne({
      where: { userId },
    });
    if (!userPoints)
      throw new RpcException({
        status: HttpStatus.NOT_FOUND,
        message: `Usuario con ID ${userId} no tiene puntos`,
      });
    const membershipInfo =
      await this.membershipService.getUserMembershipInfo(userId);
    return {
      availableLotPoints: userPoints.availableLotPoints | 0,
      totalEarnedLotPoints: userPoints.totalEarnedLotPoints | 0,
      totalWithdrawnLotPoints: userPoints.totalWithdrawnLotPoints | 0,
      membershipPlan: membershipInfo.plan
        ? {
            name: membershipInfo.plan.name,
          }
        : null,
    };
  }
}
