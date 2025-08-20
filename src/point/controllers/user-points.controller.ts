import { Controller } from '@nestjs/common';
import { UserPointsService } from '../services/user-points.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CreateDirectBonusDto } from '../dto/create-direct-bonus.dto';

@Controller()
export class UserPointsController {
  constructor(private readonly userPointsService: UserPointsService) {}

  @MessagePattern({ cmd: 'userPoints.get' })
  async getUserPoints(@Payload() data: { userId: string }) {
    return this.userPointsService.getUserPoints(data.userId);
  }

  @MessagePattern({ cmd: 'userLotPoints.get' })
  async getUserLotPoints(@Payload() data: { userId: string }) {
    return this.userPointsService.getUserLotPoints(data.userId);
  }

  @MessagePattern({ cmd: 'userPoints.createDirectBonus' })
  async createDirectBonus(@Payload() data: CreateDirectBonusDto) {
    return this.userPointsService.createDirectBonus(data);
  }

  @MessagePattern({ cmd: 'userPoints.checkWithdrawalEligibility' })
  async checkWithdrawalEligibility(@Payload() data: { userId: string }) {
    return this.userPointsService.checkWithdrawalEligibility(data.userId);
  }
}
