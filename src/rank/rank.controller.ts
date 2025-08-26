import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { RankService } from './rank.service';

@Controller()
export class RankController {
  constructor(private readonly rankService: RankService) {}

  @MessagePattern({ cmd: 'rank.getCurrentRank' })
  async getCurrentRank(@Payload() { userId }: { userId: string }) {
    return this.rankService.getCurrentRank(userId);
  }

  @MessagePattern({ cmd: 'rank.getUsersCurrentRankBatch' })
  async getUsersCurrentRankBatch(@Payload() { userIds }: { userIds: string[] }) {
    return this.rankService.getUsersCurrentRankBatch(userIds);
  }
}
