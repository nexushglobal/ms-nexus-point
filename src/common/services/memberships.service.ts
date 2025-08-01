import { Injectable } from '@nestjs/common';
import { MessagingService } from 'src/messaging/messaging.service';
import { UserMembershipInfoResponse } from 'src/point/interfaces/user-membership-info-response.interface';
import { GetMembershipPlanResponse } from '../interfaces/get-membership-plan-response.interface';

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

  async getMembershipPlan(
    id: number,
    userId: string,
  ): Promise<GetMembershipPlanResponse> {
    return await this.client.send(
      { cmd: 'membershipPlan.findOne' },
      { id, userId },
    );
  }
}
