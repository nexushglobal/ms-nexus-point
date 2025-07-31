export class StatsWeeklyVolumeDto {
  weekStartDate: Date;
  weekEndDate: Date;
  totalRecords: string;
  totalLeftVolume: string;
  totalRightVolume: string;
  totalVolume: string;
  pendingCount: string;
  processedCount: string;
}
