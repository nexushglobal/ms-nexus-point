import { Injectable } from '@nestjs/common';
import { MessagingService } from 'src/messaging/messaging.service';
import { UserMembershipInfoResponse } from 'src/point/interfaces/user-membership-info-response.interface';
import { GetMembershipPlanResponse } from '../interfaces/get-membership-plan-response.interface';
import { ExpiredMembershipDto } from '../dto/expired-membership.dto';

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

  async getUsersMembershipBatch(userIds: string[]) {
    return await this.client.send(
      { cmd: 'membership.getUsersMembershipBatch' },
      { userIds },
    );
  }

  async updateMembership(
    userId: string,
    isPointLot?: boolean,
    useCard?: boolean,
    autoRenewal?: boolean,
  ) {
    return await this.client.send(
      { cmd: 'membership.updateMembership' },
      { userId, isPointLot, useCard, autoRenewal },
    );
  }

  async findExpiredMemberships(
    currentDate: string,
  ): Promise<ExpiredMembershipDto[]> {
    return await this.client.send(
      { cmd: 'membership.findExpiredMemberships' },
      { currentDate },
    );
  }

  async updateMembershipEndDate(
    membershipId: number,
    endDate: string,
  ): Promise<void> {
    return await this.client.send(
      { cmd: 'membership.updateEndDate' },
      { membershipId, endDate },
    );
  }

  async updateMembershipStatus(
    membershipId: number,
    status: string,
  ): Promise<void> {
    return await this.client.send(
      { cmd: 'membership.updateStatus' },
      { membershipId, status },
    );
  }

  async createReconsumption(data: {
    userId: string;
    membershipId: number;
    amount: number;
    paymentMethod: 'POINTS';
  }): Promise<{
    success: boolean;
    reconsumptionId: number;
    paymentId: string;
    pointsTransactionId: string;
    message: string;
    remainingPoints: number;
    amount: number;
  }> {
    return await this.client.send(
      { cmd: 'membership.createReConsumption' },
      data,
    );
  }
}
