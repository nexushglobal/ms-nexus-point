import { Injectable } from '@nestjs/common';
import { MessagingService } from 'src/messaging/messaging.service';
import { GetUserResponse } from '../interfaces/get-user-response.interface';
import { GetUserByIdInfoResponse } from '../interfaces/get-user-by-id-info-response.interface';

@Injectable()
export class UsersService {
  constructor(private readonly client: MessagingService) {}

  async getUser(userId: string): Promise<GetUserResponse> {
    return await this.client.send({ cmd: 'user.getUserBasicInfo' }, { userId });
  }

  async getUserByIdInfo(userId: string): Promise<GetUserByIdInfoResponse> {
    return await this.client.send({ cmd: 'user.findById' }, { id: userId });
  }

  async getUserByReferralCode(
    referralCode: string,
  ): Promise<GetUserByIdInfoResponse> {
    return await this.client.send(
      { cmd: 'user.findByReferralCode' },
      { code: referralCode },
    );
  }

  async checkMinDepthLevels(
    userId: string,
    minDepthLevels: number,
  ): Promise<boolean> {
    return await this.client.send(
      { cmd: 'user.tree.checkMinDepthLevels' },
      { userId, minDepthLevels },
    );
  }

  async getDirectReferrals(userId: string): Promise<string[]> {
    return await this.client.send(
      { cmd: 'user.tree.getDirectReferrals' },
      { userId },
    );
  }

  async getParentChain(userId: string) {
    return await this.client.send(
      { cmd: 'user.tree.getParentChain' },
      { userId },
    );
  }

  async getUserWithChildren(userId: string): Promise<{
    id: string;
    referralCode: string;
    leftChildId?: string;
    rightChildId?: string;
  }> {
    return await this.client.send(
      { cmd: 'user.getUserWithChildren' },
      { userId },
    );
  }

  async getDescendantsInLeg(
    userId: string,
    side: 'LEFT' | 'RIGHT',
  ): Promise<string[]> {
    return await this.client.send(
      { cmd: 'user.tree.getDescendantsInLeg' },
      { userId, side },
    );
  }

  async checkActiveMembershipsInLeg(
    descendantIds: string[],
    referralCode: string,
  ): Promise<boolean> {
    return await this.client.send(
      { cmd: 'user.tree.checkActiveMembershipsInLeg' },
      { descendantIds, referralCode },
    );
  }

  // async getActiveAncestorsWithMembership(
  //   userId: string,
  // ): Promise<ActiveAncestorDto[]> {
  //   return await this.client.send(
  //     { cmd: 'users.getActiveAncestorsWithMembership' },
  //     { userId },
  //   );
  // }
}
