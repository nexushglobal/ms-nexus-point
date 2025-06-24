import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { VolumeSide, WeeklyVolume } from './weekly-volume.entity';

@Entity('weekly_volume_history')
@Index(['weeklyVolume'])
@Index(['paymentId'])
@Index(['createdAt'])
export class WeeklyVolumeHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => WeeklyVolume, (volume) => volume.history, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'weekly_volume_id' })
  weeklyVolume: WeeklyVolume;

  @Column({ name: 'payment_id', nullable: true })
  paymentId?: string;

  @Column({
    type: 'enum',
    enum: VolumeSide,
    nullable: true,
    name: 'volume_side',
  })
  volumeSide?: VolumeSide;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  volume: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  validate() {
    if (this.volume < 0) {
      throw new Error('El volumen no puede ser negativo');
    }
  }
}
