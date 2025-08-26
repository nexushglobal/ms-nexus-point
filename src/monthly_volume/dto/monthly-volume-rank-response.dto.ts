export class MonthlyVolumeRankDto {
  id: number;
  assignedRank?: {
    id: number;
    name: string;
    code: string;
  };
  totalVolume: number;
  leftVolume: number;
  rightVolume: number;
  leftDirects: number;
  rightDirects: number;
  monthStartDate: Date;
  monthEndDate: Date;
  status: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}
