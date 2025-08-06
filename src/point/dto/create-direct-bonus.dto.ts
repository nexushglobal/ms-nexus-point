import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsString,
  ValidateNested,
  IsObject,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PointTransactionType } from '../entities/points-transaction.entity';

export class DirectBonusUserDto {
  @IsString()
  @IsNotEmpty()
  userId: string; // ID del usuario que compró (para buscar su referente)

  @IsString()
  @IsNotEmpty()
  userName: string; // Nombre del usuario que compró

  @IsString()
  @IsNotEmpty()
  userEmail: string; // Email del usuario que compró

  @IsString()
  @IsOptional()
  paymentReference?: string; // Referencia del pago de este usuario

  @IsNumber()
  @IsOptional()
  paymentId?: number; // ID del pago de este usuario

  @IsNumber()
  @IsNotEmpty()
  directBonus: number; // Bono directo

  @IsObject()
  @IsNotEmpty()
  metadata: Record<string, any>; // Metadata obligatoria

  @IsEnum(PointTransactionType)
  @IsNotEmpty()
  type: PointTransactionType; // Tipo de transacción de puntos
}

export class CreateDirectBonusDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DirectBonusUserDto)
  users: DirectBonusUserDto[];
}

export class ProcessedDirectBonusDto {
  referrerUserId: string; // ID del referente que recibió los puntos
  bonusPoints: number; // Cantidad de puntos otorgados
  paymentReference: string; // Referencia del pago
  transactionId: number; // ID de la transacción de puntos creada
  previousPoints: number; // Puntos que tenía antes
  currentPoints: number; // Puntos que tiene ahora
}

export class FailedDirectBonusDto {
  userId: string; // ID del usuario que falló
  userName: string; // Nombre del usuario que falló
  userEmail: string; // Email del usuario que falló
  paymentReference: string; // Referencia del pago
  reason: string; // Razón del fallo
}

export class DirectBonusResponseDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProcessedDirectBonusDto)
  processed: ProcessedDirectBonusDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FailedDirectBonusDto)
  failed: FailedDirectBonusDto[];
}
