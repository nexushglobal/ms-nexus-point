import { Type } from 'class-transformer';
import { IsUUID } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination.dto';

export class GetUserMonthlyVolumesDto extends PaginationDto {
  @IsUUID(4, { message: 'userId debe ser un UUID válido' })
  userId: string;
}