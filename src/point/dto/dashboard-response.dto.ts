export class DashboardResponseDto {
  availablePoints: number;
  availableLotPoints: number;
  monthlyVolume?: {
    leftVolume: number;
    rightVolume: number;
    monthStartDate: Date;
    monthEndDate: Date;
  };
  rank?: {
    name: string;
  };
  weeklyVolume?: {
    leftVolume: number;
    rightVolume: number;
    weekStartDate: Date;
    weekEndDate: Date;
  };
}
