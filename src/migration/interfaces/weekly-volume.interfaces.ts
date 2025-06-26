export interface WeeklyVolumeHistoryMigrationData {
  volumeSide?: 'LEFT' | 'RIGHT' | null;
  volume: number;
  createdAt: string;
  updatedAt: string;
  payment_id?: number | null;
}

export interface WeeklyVolumeMigrationData {
  id: number;
  userEmail: string;
  leftVolume: number;
  rightVolume: number;
  commissionEarned?: number | null;
  weekStartDate: string;
  weekEndDate: string;
  status: 'PENDING' | 'PROCESSED' | 'CANCELLED';
  selectedSide?: 'LEFT' | 'RIGHT' | null;
  processedAt?: string | null;
  metadata?: Record<string, any> | null;
  createdAt: string;
  history?: WeeklyVolumeHistoryMigrationData[];
}

export interface WeeklyVolumeMigrationResult {
  success: boolean;
  message: string;
  details: {
    weeklyVolumes: {
      total: number;
      created: number;
      skipped: number;
      errors: string[];
    };
    weeklyVolumeHistory: {
      total: number;
      created: number;
      skipped: number;
      errors: string[];
    };
  };
}
