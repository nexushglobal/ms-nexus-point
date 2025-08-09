import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserRank } from './user_ranks.entity';

@Entity('ranks')
export class Rank {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  code: string;

  // Requisitos Básicos
  @Column({
    type: 'decimal',
    name: 'required_pay_leg_qv',
    precision: 15,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  requiredPayLegQv: number; // QV Pierna de Pago (lado más débil)

  @Column({
    type: 'decimal',
    name: 'required_total_tree_qv',
    precision: 15,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  requiredTotalTreeQv: number; // QV Árbol Total

  @Column({
    name: 'required_directs',
  })
  requiredDirects: number; // Equipos Mínimos (directos)

  // Restricciones de Equipos
  @Column({
    nullable: true,
    name: 'required_active_teams',
  })
  requiredActiveTeams?: number; // Equipos Activos: equipos con volumen en el período

  @Column({
    nullable: true,
    name: 'required_qualified_teams',
  })
  requiredQualifiedTeams?: number; // Equipos Calificados: equipos directos con rango específico

  @Column({
    nullable: true,
    name: 'required_qualified_rank_id',
  })
  requiredQualifiedRankId?: number; // ID del rango mínimo requerido para equipos calificados

  // Restricciones de Árbol de Patrocinio
  @Column({
    type: 'decimal',
    name: 'required_sponsorship_branch_qv',
    precision: 15,
    scale: 2,
    nullable: true,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  maxSponsorshipBranchQv?: number; // Máximo QV de cualquier rama de patrocinio

  // Balance de Piernas
  @Column({
    type: 'decimal',
    name: 'required_leg_balance_percentage',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  maxLegBalancePercentage?: number; // Máximo % del volumen de una sola pierna binaria

  // Profundidad Mínima
  @Column({
    nullable: true,
    name: 'min_depth_levels',
  })
  minDepthLevels?: number; // Niveles mínimos de profundidad en cada pierna

  // Campos de control existentes
  @Column({
    default: true,
    name: 'is_active',
  })
  isActive: boolean;

  @Column({
    type: 'jsonb',
    nullable: true,
  })
  benefits?: Record<string, any>;

  // Orden del rango para facilitar comparaciones
  @Column({
    unique: true,
    name: 'rank_order',
  })
  rankOrder: number; // 1 para EJECUTIVO, 2 para EJECUTIVO SENIOR, etc.

  // Descripción del rango
  @Column({
    type: 'text',
    nullable: true,
    name: 'description',
  })
  description?: string;

  // Relaciones existentes
  @OneToMany(() => UserRank, (userRank) => userRank.currentRank)
  @JoinColumn({ name: 'current_rank_id' })
  currentUserRanks: UserRank[];

  @OneToMany(() => UserRank, (userRank) => userRank.highestRank)
  @JoinColumn({ name: 'highest_rank_id' })
  highestUserRanks: UserRank[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
