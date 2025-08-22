import { IsString } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination.dto';

export class GetUserMonthlyVolumesDto extends PaginationDto {
  @IsString()
  userId: string;
}
