import { IsNumber, IsPositive } from 'class-validator';

export class GetWeeklyVolumeDetailDto {
  @IsNumber()
  @IsPositive()
  id: number;
}
