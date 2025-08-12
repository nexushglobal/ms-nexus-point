export class ReservedPointsTransactionDto {
  id: number;
  amount: number;
  pendingAmount: number;
  type: string;
  amountUsed: number;
  originalAmount: number;
  metadata: Record<string, any>;
}
