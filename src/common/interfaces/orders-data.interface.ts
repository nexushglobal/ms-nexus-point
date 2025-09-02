export interface UserPeriodOrderDto {
  userId: string;
  startDate: string;
  endDate: string;
}

export interface UserOrderSummaryDto {
  userId: string;
  totalAmount: number;
  orderCount: number;
  meetsMinimumAmount: boolean; // >= 300
}

export interface FindUserOrdersByPeriodResponseDto {
  usersOrdersSummary: UserOrderSummaryDto[];
  totalUsersProcessed: number;
}
