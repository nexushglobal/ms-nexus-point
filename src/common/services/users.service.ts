import { Injectable } from '@nestjs/common';
import { MessagingService } from 'src/messaging/messaging.service';
import { GetUserResponse } from '../interfaces/get-user-response.interface';

@Injectable()
export class UsersService {
  constructor(private readonly client: MessagingService) {}

  async getUser(userId: string): Promise<GetUserResponse> {
    return await this.client.send({ cmd: 'user.getUserBasicInfo' }, { userId });
  }
}
