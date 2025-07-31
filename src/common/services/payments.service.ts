import { Injectable } from '@nestjs/common';
import { MessagingService } from 'src/messaging/messaging.service';

@Injectable()
export class PaymentsService {
  constructor(private readonly client: MessagingService) {}
}
