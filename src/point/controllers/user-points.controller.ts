import { Controller } from '@nestjs/common';
import { UserPointsService } from '../services/user-points.service';
import { MessagePattern } from '@nestjs/microservices';

@Controller()
export class UserPointsController {
  constructor(private readonly userPointsService: UserPointsService) {}

  @MessagePattern({ cmd: 'userPoints.get' })
  async getUserPoints(data: { userId: string }) {
    return this.userPointsService.getUserPoints(data.userId);
  }

  @MessagePattern({ cmd: 'userLotPoints.get' })
  async getUserLotPoints(data: { userId: string }) {
    return this.userPointsService.getUserLotPoints(data.userId);
  }
}
