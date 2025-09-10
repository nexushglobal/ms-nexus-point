import { Injectable } from '@nestjs/common';
import { MessagingService } from 'src/messaging/messaging.service';

export interface PaymentResponse {
  id: number;
  operationCode?: string | undefined;
  paymentMethod: string;
  status: string;
  amount: number;
  bankName?: string | undefined;
  userEmail: string;
}

@Injectable()
export class PaymentsService {
  constructor(private readonly client: MessagingService) {}
  async findOneById(id: number): Promise<PaymentResponse | null> {
    return await this.client.send(
      { cmd: 'orders.findUserOrdersByPeriod' },
      { id },
    );
  }
}
