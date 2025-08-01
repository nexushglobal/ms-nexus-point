export interface GetMembershipPlanResponse {
  plan: {
    id: number;
    name: string;
    price: number;
    checkAmount: number;
    binaryPoints: number;
    commissionPercentage: number;
    directCommissionAmount?: number;
  };
}
