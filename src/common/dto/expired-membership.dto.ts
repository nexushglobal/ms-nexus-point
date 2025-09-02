export class ExpiredMembershipDto {
  id: number;
  userId: string;
  userEmail: string;
  userName: string;
  isPointLot: boolean;
  autoRenewal: boolean;
  minimumReconsumptionAmount: number;
  startDate: Date;
  endDate: Date;
  plan?: {
    id: number;
    name: string;
    binaryPoints: number;
  };
}
