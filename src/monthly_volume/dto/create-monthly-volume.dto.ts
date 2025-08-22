import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsEnum,
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { VolumeSide } from '../../weekly-volume/entities/weekly-volume.entity';

export class MonthlyVolumeUserAssignmentDto {
  @IsString({ message: 'El campo ID de usuario es una cadena de texto' })
  @IsNotEmpty({ message: 'El campo ID de usuario es obligatorio' })
  userId: string;

  @IsString({ message: 'El campo nombre de usuario es una cadena de texto' })
  @IsNotEmpty({ message: 'El campo nombre de usuario es obligatorio' })
  userName: string;

  @IsString({ message: 'El campo email de usuario es una cadena de texto' })
  @IsNotEmpty({ message: 'El campo email de usuario es obligatorio' })
  userEmail: string;

  @IsEnum(VolumeSide, {
    message: 'El campo del lado del volumen es: LEFT o RIGHT',
  })
  @IsNotEmpty({ message: 'El campo del lado del volumen es obligatorio' })
  site: VolumeSide;

  @IsString({ message: 'El campo de pago es una cadena de texto' })
  @IsOptional()
  paymentId?: string;

  @IsNumber({}, { message: 'El campo leftDirects debe ser un número' })
  @IsOptional()
  leftDirects?: number;

  @IsNumber({}, { message: 'El campo rightDirects debe ser un número' })
  @IsOptional()
  rightDirects?: number;
}

export class CreateMonthlyVolumeDto {
  @IsNumber({}, { message: 'El campo de monto es un número' })
  @IsNotEmpty({ message: 'El campo de monto es obligatorio' })
  amount: number;

  @IsNumber({}, { message: 'El campo de volumen es un número' })
  @IsNotEmpty({ message: 'El campo de volumen es obligatorio' })
  volume: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MonthlyVolumeUserAssignmentDto)
  users: MonthlyVolumeUserAssignmentDto[];
}

export class CreateMonthlyVolumeResponseDto {
  processed: ProcessedMonthlyVolumeDto[];
  failed: FailedMonthlyVolumeDto[];
}

export class ProcessedMonthlyVolumeDto {
  userId: string;
  side: VolumeSide;
  volumeAdded: number;
  directsAdded?: number;
  action: 'created' | 'updated';
  monthlyVolumeId: number;
  totalVolumeAfter: number;
}

export class FailedMonthlyVolumeDto {
  userId: string;
  reason: string;
}
