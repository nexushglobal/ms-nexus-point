import { Injectable } from '@nestjs/common';
import { MessagingService } from 'src/messaging/messaging.service';
import {
  FindUserOrdersByPeriodResponseDto,
  UserPeriodOrderDto,
} from '../interfaces/orders-data.interface';
@Injectable()
export class OrdersService {
  constructor(private readonly client: MessagingService) {}

  async findUserOrdersByPeriod(
    users: UserPeriodOrderDto[],
  ): Promise<FindUserOrdersByPeriodResponseDto> {
    return await this.client.send(
      { cmd: 'orders.findUserOrdersByPeriod' },
      { users },
    );
  }
}
