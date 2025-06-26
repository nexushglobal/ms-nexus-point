export interface PointsTransactionPaymentMigrationData {
  points_transaction_id: number;
  payment_id: number;
  createdAt: string;
  updatedAt: string;
}

export interface PointsTransactionMigrationData {
  id: number;
  amount: number;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
  metadata: Record<string, any>;
  pendingAmount: number;
  withdrawnAmount: number;
  isArchived: boolean;
  type: 'BINARY_COMMISSION' | 'DIRECT_BONUS' | 'WITHDRAWAL';
  createdAt: string;
  payments: PointsTransactionPaymentMigrationData[];
}

export interface UserPointsMigrationData {
  id: number;
  availablePoints: number;
  totalEarnedPoints: number;
  totalWithdrawnPoints: number;
  userEmail: string;
  transactions: PointsTransactionMigrationData[];
}

export interface UserPointsMigrationResult {
  success: boolean;
  message: string;
  details: {
    userPoints: {
      total: number;
      created: number;
      skipped: number;
      errors: string[];
    };
    pointsTransactions: {
      total: number;
      created: number;
      skipped: number;
      errors: string[];
    };
    pointsTransactionPayments: {
      total: number;
      created: number;
      skipped: number;
      errors: string[];
    };
  };
}
