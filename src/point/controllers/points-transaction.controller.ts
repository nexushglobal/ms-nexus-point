import { Controller } from '@nestjs/common';
import { PointsTransactionService } from '../services/points-transaction.service';
import { MessagePattern } from '@nestjs/microservices';
import { FindPointsTransactionDto } from '../dto/find-weekly-volume.dto';

@Controller('points-transaction')
export class PointsTransactionController {
  constructor(
    private readonly pointsTransactionService: PointsTransactionService,
  ) {}

  @MessagePattern({ cmd: 'pointsTransaction.get' })
  async getPointsTransactions(data: FindPointsTransactionDto) {
    return this.pointsTransactionService.getPointsTransactions(data);
  }
}
