import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsEnum,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { VolumeSide } from '../entities/weekly-volume.entity';

export class VolumeUserAssignmentDto {
  @IsString({ message: 'El campo ID de usuario es una cadena de texto' })
  @IsNotEmpty({ message: 'El campo ID de usuario es obligatorio' })
  id: string;

  @IsEnum(VolumeSide, {
    message: 'El campo del lado del volumen es: LEFT o RIGHT',
  })
  @IsNotEmpty({ message: 'El campo del lado del volumen es obligatorio' })
  site: VolumeSide;

  @IsString({ message: 'El campo de pago es una cadena de texto' })
  @IsNotEmpty({ message: 'El campo de pago es obligatorio' })
  paymentId: string;
}

export class CreateVolumeDto {
  @IsNumber({}, { message: 'El campo de monto es un número' })
  @IsNotEmpty({ message: 'El campo de monto es obligatorio' })
  monto: number;

  @IsNumber({}, { message: 'El campo de volumen es un número' })
  @IsNotEmpty({ message: 'El campo de volumen es obligatorio' })
  volumen: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VolumeUserAssignmentDto)
  users: VolumeUserAssignmentDto[];
}

export class CreateVolumeResponseDto {
  processed: ProcessedVolumeDto[];
  failed: FailedVolumeDto[];
}

export class ProcessedVolumeDto {
  userId: string;
  side: VolumeSide;
  volumeAdded: number;
  action: 'created' | 'updated';
  weeklyVolumeId: number;
}

export class FailedVolumeDto {
  userId: string;
  reason: string;
}
