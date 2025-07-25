import { MembershipStatus } from '../enums/status-membership.enum';

export interface UserMembershipInfoResponse {
  hasMembership: boolean;
  membershipId?: number;
  status?: MembershipStatus;
  plan?: {
    id: number;
    name: string;
    price: number;
  };
  message?: string;
  endDate?: Date;
}
