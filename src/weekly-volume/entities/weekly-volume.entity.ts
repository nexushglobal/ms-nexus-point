import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { WeeklyVolumeHistory } from './weekly-volume-history.entity';

export enum VolumeProcessingStatus {
  PENDING = 'PENDING',
  PROCESSED = 'PROCESSED',
  CANCELLED = 'CANCELLED',
}

export enum VolumeSide {
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
}

@Entity('weekly_volumes')
@Index(['userId', 'weekStartDate'], { unique: true })
@Index(['weekStartDate', 'weekEndDate'])
@Index(['status', 'weekStartDate'])
export class WeeklyVolume {
  @PrimaryColumn()
  id: number;

  @Column({ name: 'user_id' })
  @Index()
  userId: string; // UUID del usuario desde el microservicio de usuarios

  @Column({ name: 'user_email' })
  userEmail: string; // Email para referencia rápida

  @Column({ name: 'user_name', nullable: true })
  userName?: string; // Nombre completo para referencia

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    name: 'left_volume',
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  leftVolume: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    name: 'right_volume',
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  rightVolume: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    name: 'commission_earned',
    transformer: {
      to: (value: number) => value,
      from: (value: string) => (value ? parseFloat(value) : null),
    },
  })
  commissionEarned?: number;

  @Column({ type: 'date', name: 'week_start_date' })
  weekStartDate: Date;

  @Column({ type: 'date', name: 'week_end_date' })
  weekEndDate: Date;

  @Column({
    type: 'enum',
    enum: VolumeProcessingStatus,
    default: VolumeProcessingStatus.PENDING,
  })
  status: VolumeProcessingStatus;

  @Column({
    type: 'enum',
    enum: VolumeSide,
    nullable: true,
    name: 'selected_side',
  })
  selectedSide?: VolumeSide;

  @Column({ name: 'processed_at', type: 'timestamp', nullable: true })
  processedAt?: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @OneToMany(() => WeeklyVolumeHistory, (history) => history.weeklyVolume, {
    cascade: true,
  })
  history: WeeklyVolumeHistory[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  validate() {
    if (this.leftVolume < 0) {
      throw new Error('El volumen izquierdo no puede ser negativo');
    }

    if (this.rightVolume < 0) {
      throw new Error('El volumen derecho no puede ser negativo');
    }

    if (this.weekStartDate && this.weekEndDate) {
      if (this.weekEndDate <= this.weekStartDate) {
        throw new Error(
          'La fecha de fin debe ser posterior a la fecha de inicio',
        );
      }
    }

    if (this.userEmail) {
      this.userEmail = this.userEmail.toLowerCase().trim();
    }

    if (this.userName) {
      this.userName = this.userName.trim();
    }
  }

  // Métodos helper
  getTotalVolume(): number {
    return this.leftVolume + this.rightVolume;
  }

  getWeakerSide(): VolumeSide | null {
    if (this.leftVolume === this.rightVolume) return null;
    return this.leftVolume < this.rightVolume
      ? VolumeSide.LEFT
      : VolumeSide.RIGHT;
  }

  getStrongerSide(): VolumeSide | null {
    if (this.leftVolume === this.rightVolume) return null;
    return this.leftVolume > this.rightVolume
      ? VolumeSide.LEFT
      : VolumeSide.RIGHT;
  }

  getVolumeBalance(): number {
    return Math.abs(this.leftVolume - this.rightVolume);
  }

  getProcessableVolume(): number {
    return Math.min(this.leftVolume, this.rightVolume);
  }

  isProcessed(): boolean {
    return this.status === VolumeProcessingStatus.PROCESSED;
  }

  canProcess(): boolean {
    return (
      this.status === VolumeProcessingStatus.PENDING &&
      this.getTotalVolume() > 0
    );
  }

  calculateCarryOver(): { left: number; right: number } {
    const processable = this.getProcessableVolume();
    return {
      left: Math.max(0, this.leftVolume - processable),
      right: Math.max(0, this.rightVolume - processable),
    };
  }
}
