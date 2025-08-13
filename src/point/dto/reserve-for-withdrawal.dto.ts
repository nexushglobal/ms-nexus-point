import { ReservedPointsTransactionDto } from './reserved-points-transaction.dto';

export class ReserveForWithdrawal {
  success: boolean;
  pointsTransaction: ReservedPointsTransactionDto[];
}
