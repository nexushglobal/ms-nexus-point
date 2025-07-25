import { Injectable } from '@nestjs/common';
import { MessagingService } from 'src/messaging/messaging.service';
import { UserMembershipInfoResponse } from 'src/point/interfaces/user-membership-info-response.interface';

@Injectable()
export class MembershipService {
  constructor(private readonly client: MessagingService) {}

  async getUserMembershipInfo(
    userId: string,
  ): Promise<UserMembershipInfoResponse> {
    return await this.client.send(
      { cmd: 'membership.getUserMembershipInfo' },
      { userId },
    );
  }
}
