import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { FindPointsTransactionDto } from '../dto/find-weekly-volume.dto';
import { LotPointsTransactionService } from '../services/points-lots-transaction.service';

@Controller('points-lots-transaction')
export class LotPointsTransactionController {
  constructor(
    private readonly lotPointsTransactionService: LotPointsTransactionService,
  ) {}

  @MessagePattern({ cmd: 'pointsLotTransaction.get' })
  async getLotPointsTransactions(data: FindPointsTransactionDto) {
    return this.lotPointsTransactionService.getLotPointsTransactions(data);
  }
}
