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
import { Rank } from './rank.entity';

@Entity('user_ranks')
@Index(['user'])
export class UserRank {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', unique: true })
  userId: string; // UUID del usuario desde el microservicio de usuarios

  @Column({ name: 'user_email' })
  userEmail: string; // Email para referencia rápida

  @Column({ name: 'user_name', nullable: true })
  userName?: string; // Nombre completo para referencia

  @ManyToOne(() => Rank, { nullable: false })
  @JoinColumn({ name: 'current_rank_id' })
  currentRank: Rank;

  @ManyToOne(() => Rank, { nullable: true })
  @JoinColumn({ name: 'highest_rank_id' })
  highestRank?: Rank;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
