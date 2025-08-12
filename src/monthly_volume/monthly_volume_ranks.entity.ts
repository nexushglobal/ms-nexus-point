import { Rank } from 'src/rank/entities/rank.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum MonthlyVolumeStatus {
  PENDING = 'PENDING',
  PROCESSED = 'PROCESSED',
  CANCELLED = 'CANCELLED',
}

@Entity('monthly_volume_ranks')
@Index(['userId', 'monthStartDate'], { unique: true })
@Index(['monthStartDate', 'monthEndDate'])
@Index(['status', 'monthStartDate'])
export class MonthlyVolumeRank {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', unique: true })
  userId: string; // UUID del usuario desde el microservicio de usuarios

  @Column({ name: 'user_email' })
  userEmail: string; // Email para referencia rápida

  @Column({ name: 'user_name', nullable: true })
  userName?: string; // Nombre completo para referencia

  @ManyToOne(() => Rank, { nullable: true })
  @JoinColumn({ name: 'assigned_rank_id' })
  assignedRank?: Rank;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  totalVolume: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  leftVolume: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  rightVolume: number;

  @Column({
    type: 'int',
    default: 0,
  })
  leftDirects: number;

  @Column({
    type: 'int',
    default: 0,
  })
  rightDirects: number;

  @Column({ type: 'date' })
  monthStartDate: Date;

  @Column({ type: 'date' })
  monthEndDate: Date;

  @Column({
    type: 'enum',
    enum: MonthlyVolumeStatus,
    default: MonthlyVolumeStatus.PENDING,
  })
  status: MonthlyVolumeStatus;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
