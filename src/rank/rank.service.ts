import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { Rank } from './entities/rank.entity';
import { UserRank } from './entities/user_ranks.entity';
import {
  MonthlyVolumeRank,
  MonthlyVolumeStatus,
} from '../monthly_volume/entities/monthly_volume_ranks.entity';
import { UsersService } from '../common/services/users.service';
import { MembershipService } from '../common/services/memberships.service';
import { MembershipStatus } from 'src/point/enums/status-membership.enum';
import {
  GetCurrentRankResponse,
  RankInfo,
  UserVolumeData,
} from './types/rank.types';

@Injectable()
export class RankService {
  private readonly logger = new Logger(RankService.name);

  constructor(
    @InjectRepository(Rank)
    private readonly rankRepository: Repository<Rank>,
    @InjectRepository(UserRank)
    private readonly userRankRepository: Repository<UserRank>,
    @InjectRepository(MonthlyVolumeRank)
    private readonly monthlyVolumeRankRepository: Repository<MonthlyVolumeRank>,
    private readonly usersService: UsersService,
    private readonly membershipService: MembershipService,
  ) {}

  async getCurrentRank(userId: string): Promise<GetCurrentRankResponse> {
    try {
      this.logger.log(`Getting current rank for user: ${userId}`);

      // Get user rank info
      const userRank = await this.userRankRepository.findOne({
        where: { userId },
        relations: ['currentRank', 'highestRank'],
      });

      if (!userRank) {
        throw new RpcException({
          status: HttpStatus.NOT_FOUND,
          message: 'Usuario no encontrado',
          service: 'rank',
        });
      }

      // Get current month volume (PENDING status represents current month)
      const currentMonthVolume = await this.monthlyVolumeRankRepository.findOne(
        {
          where: {
            userId,
            status: MonthlyVolumeStatus.PENDING,
          },
        },
      );

      if (!currentMonthVolume) {
        throw new RpcException({
          status: HttpStatus.NOT_FOUND,
          message: 'Volumen mensual actual no encontrado',
          service: 'rank',
        });
      }

      // Get all ranks ordered by rankOrder
      const allRanks = await this.rankRepository.find({
        where: { isActive: true },
        order: { rankOrder: 'ASC' },
      });

      // Calculate next rank now (what rank user would get today if processed)
      const nextRankNow = await this.calculateRankBasedOnCurrentData(
        userId,
        currentMonthVolume,
        allRanks,
      );

      // Calculate next rank requirements
      const nextRankReq = await this.calculateNextRankRequirements(
        userRank.currentRank,
        currentMonthVolume,
        allRanks,
        userId,
      );

      // Get current user data for requirements
      const currentData = await this.buildUserVolumeData(
        userId,
        currentMonthVolume,
      );

      return {
        currentRank: {
          id: userRank.currentRank.id,
          name: userRank.currentRank.name,
          code: userRank.currentRank.code,
        },
        highestRank: userRank.highestRank
          ? {
              id: userRank.highestRank.id,
              name: userRank.highestRank.name,
              code: userRank.highestRank.code,
            }
          : undefined,
        nextRankNow,
        nextRankReq,
        currentData,
      };
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);

      this.logger.error(
        `Error getting current rank for user ${userId}: ${errorMessage}`,
      );

      if (error instanceof RpcException) {
        throw error;
      }

      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: `Error interno del servidor: ${errorMessage}`,
        service: 'rank',
        timestamp: new Date().toISOString(),
      });
    }
  }

  private async calculateRankBasedOnCurrentData(
    userId: string,
    currentVolume: MonthlyVolumeRank,
    allRanks: Rank[],
  ): Promise<RankInfo> {
    // Find highest rank user qualifies for based on current data
    let qualifiedRank = allRanks[0]; // Start with lowest rank

    for (const rank of allRanks) {
      const qualifies = await this.checkRankQualification(
        userId,
        rank,
        currentVolume,
      );
      if (qualifies) {
        qualifiedRank = rank;
      } else {
        break; // Since ranks are ordered, first failure means no higher ranks qualify
      }
    }

    return {
      id: qualifiedRank.id,
      name: qualifiedRank.name,
      code: qualifiedRank.code,
    };
  }

  private async calculateNextRankRequirements(
    currentRank: Rank,
    currentVolume: MonthlyVolumeRank,
    allRanks: Rank[],
    userId: string,
  ): Promise<RankInfo & { requerimientos: string[] }> {
    // Find next rank after current
    const currentRankIndex = allRanks.findIndex((r) => r.id === currentRank.id);
    const nextRank = allRanks[currentRankIndex + 1];

    if (!nextRank) {
      // User is already at highest rank
      return {
        id: currentRank.id,
        name: currentRank.name,
        code: currentRank.code,
        requerimientos: ['Ya tienes el rango más alto disponible'],
      };
    }

    const requirements = await this.getRankRequirements(
      userId,
      nextRank,
      currentVolume,
    );

    return {
      id: nextRank.id,
      name: nextRank.name,
      code: nextRank.code,
      requerimientos: requirements,
    };
  }

  private async checkRankQualification(
    userId: string,
    rank: Rank,
    currentVolume: MonthlyVolumeRank,
  ): Promise<boolean> {
    try {
      // 1. Check pay leg QV (menor volumen entre izquierda y derecha)
      const payLegQv = Math.min(
        currentVolume.leftVolume,
        currentVolume.rightVolume,
      );
      if (payLegQv < rank.requiredPayLegQv) {
        return false;
      }

      // 2. Check total tree QV
      const totalTreeQv = currentVolume.leftVolume + currentVolume.rightVolume;
      if (totalTreeQv < rank.requiredTotalTreeQv) {
        return false;
      }

      // 3. Check direct referrals with active membership
      if (rank.requiredDirects > 0) {
        const activeDirects = await this.getActiveDirectReferrals(userId);
        if (activeDirects < rank.requiredDirects) {
          return false;
        }
      }

      // 4. Check active teams (teams with current month volume)
      if (rank.requiredActiveTeams) {
        const activeTeams = await this.getActiveTeamsCount(userId);
        if (activeTeams < rank.requiredActiveTeams) {
          return false;
        }
      }

      // 5. Check qualified teams (teams with specific rank)
      if (rank.requiredQualifiedTeams && rank.requiredQualifiedRankId) {
        const qualifiedTeams = await this.getQualifiedTeamsCount(
          userId,
          rank.requiredQualifiedRankId,
        );
        if (qualifiedTeams < rank.requiredQualifiedTeams) {
          return false;
        }
      }

      // 6. Check sponsorship branch limits
      if (rank.maxSponsorshipBranchQv || rank.maxLegBalancePercentage) {
        const branchCheck = await this.checkSponsorshipBranchLimits(
          userId,
          rank,
          totalTreeQv,
        );
        if (!branchCheck) {
          return false;
        }
      }

      // 7. Check minimum depth levels
      if (rank.minDepthLevels) {
        const depthCheck = await this.checkMinDepthLevels(
          userId,
          rank.minDepthLevels,
        );
        if (!depthCheck) {
          return false;
        }
      }

      // 8. Check user has active membership
      const hasActiveMembership = await this.checkActiveMembership(userId);
      if (!hasActiveMembership) {
        return false;
      }

      return true;
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      this.logger.error(`Error checking rank qualification: ${errorMessage}`);
      return false;
    }
  }

  private async getRankRequirements(
    userId: string,
    rank: Rank,
    currentVolume: MonthlyVolumeRank,
  ): Promise<string[]> {
    const requirements: string[] = [];

    // 1. Pay leg QV requirement
    const payLegQv = Math.min(
      currentVolume.leftVolume,
      currentVolume.rightVolume,
    );
    if (payLegQv < rank.requiredPayLegQv) {
      const needed = rank.requiredPayLegQv - payLegQv;
      requirements.push(
        `Necesitas ${needed.toFixed(2)} QV más en tu pierna de pago (lado más débil)`,
      );
    }

    // 2. Total tree QV requirement
    const totalTreeQv = currentVolume.leftVolume + currentVolume.rightVolume;
    if (totalTreeQv < rank.requiredTotalTreeQv) {
      const needed = rank.requiredTotalTreeQv - totalTreeQv;
      requirements.push(
        `Necesitas ${needed.toFixed(2)} QV más en volumen total del árbol`,
      );
    }

    // 3. Direct referrals requirement
    if (rank.requiredDirects > 0) {
      const activeDirects = await this.getActiveDirectReferrals(userId);
      if (activeDirects < rank.requiredDirects) {
        const needed = rank.requiredDirects - activeDirects;
        requirements.push(
          `Necesitas ${needed} referidos directos más con membresía activa`,
        );
      }
    }

    // 4. Active teams requirement
    if (rank.requiredActiveTeams) {
      const activeTeams = await this.getActiveTeamsCount(userId);
      if (activeTeams < rank.requiredActiveTeams) {
        const needed = rank.requiredActiveTeams - activeTeams;
        requirements.push(
          `Necesitas ${needed} equipos activos más (con volumen en el mes actual)`,
        );
      }
    }

    // 5. Qualified teams requirement
    if (rank.requiredQualifiedTeams && rank.requiredQualifiedRankId) {
      const qualifiedTeams = await this.getQualifiedTeamsCount(
        userId,
        rank.requiredQualifiedRankId,
      );
      if (qualifiedTeams < rank.requiredQualifiedTeams) {
        const needed = rank.requiredQualifiedTeams - qualifiedTeams;
        const requiredRank = await this.rankRepository.findOne({
          where: { id: rank.requiredQualifiedRankId },
        });
        requirements.push(
          `Necesitas ${needed} equipos más con rango ${requiredRank?.name || 'requerido'}`,
        );
      }
    }

    // 6. Sponsorship branch limits
    if (rank.maxSponsorshipBranchQv || rank.maxLegBalancePercentage) {
      const branchCheck = await this.checkSponsorshipBranchLimits(
        userId,
        rank,
        totalTreeQv,
      );
      if (!branchCheck) {
        requirements.push(
          'Necesitas equilibrar mejor el volumen entre tus ramas de patrocinio',
        );
      }
    }

    // 7. Minimum depth levels
    if (rank.minDepthLevels) {
      const depthCheck = await this.checkMinDepthLevels(
        userId,
        rank.minDepthLevels,
      );
      if (!depthCheck) {
        requirements.push(
          `Necesitas al menos ${rank.minDepthLevels} niveles de profundidad en tu árbol`,
        );
      }
    }

    // 8. Active membership
    const hasActiveMembership = await this.checkActiveMembership(userId);
    if (!hasActiveMembership) {
      requirements.push('Necesitas tener una membresía activa');
    }

    if (requirements.length === 0) {
      requirements.push('¡Cumples todos los requisitos para este rango!');
    }

    return requirements;
  }

  private async getActiveDirectReferrals(userId: string): Promise<number> {
    try {
      // Get direct referrals by user ID
      const directReferralIds = await this.getDirectReferralIds(userId);

      if (directReferralIds.length === 0) {
        return 0;
      }

      // Check membership for each direct referral
      let activeCount = 0;
      for (const referralId of directReferralIds) {
        try {
          const membershipInfo =
            await this.membershipService.getUserMembershipInfo(referralId);
          if (
            membershipInfo.hasMembership &&
            membershipInfo.status === MembershipStatus.ACTIVE
          ) {
            activeCount++;
          }
        } catch (error) {
          const errorMessage = this.getErrorMessage(error);
          this.logger.warn(
            `Could not check membership for referral ${referralId}: ${errorMessage}`,
          );
        }
      }

      return activeCount;
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      this.logger.error(
        `Error getting active direct referrals: ${errorMessage}`,
      );
      return 0;
    }
  }

  private async getActiveTeamsCount(userId: string): Promise<number> {
    try {
      // Count direct referrals that have current month volume with PENDING status
      const directReferrals = await this.getDirectReferralIds(userId);

      if (directReferrals.length === 0) {
        return 0;
      }

      const activeTeams = await this.monthlyVolumeRankRepository.count({
        where: {
          userId: In(directReferrals),
          status: MonthlyVolumeStatus.PENDING,
        },
      });

      return activeTeams;
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      this.logger.error(`Error getting active teams count: ${errorMessage}`);
      return 0;
    }
  }

  private async getQualifiedTeamsCount(
    userId: string,
    requiredRankId: number,
  ): Promise<number> {
    try {
      const directReferrals = await this.getDirectReferralIds(userId);

      if (directReferrals.length === 0) {
        return 0;
      }

      const qualifiedTeams = await this.userRankRepository.count({
        where: {
          userId: In(directReferrals),
          currentRank: { id: requiredRankId },
        },
      });

      return qualifiedTeams;
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      this.logger.error(`Error getting qualified teams count: ${errorMessage}`);
      return 0;
    }
  }

  private async checkSponsorshipBranchLimits(
    userId: string,
    rank: Rank,
    totalTreeQv: number,
  ): Promise<boolean> {
    try {
      const directReferrals = await this.getDirectReferralIds(userId);

      if (directReferrals.length === 0) {
        return true; // No referrals means no branch limit issues
      }

      // Get volumes for each direct referral
      const directVolumes = await this.monthlyVolumeRankRepository.find({
        where: {
          userId: In(directReferrals),
          status: MonthlyVolumeStatus.PENDING,
        },
      });

      // Separate into left and right branches (this would need binary tree positioning logic)
      // For now, simplified approach - would need to implement proper binary tree positioning
      let leftBranchVolume = 0;
      let rightBranchVolume = 0;

      directVolumes.forEach((volume, index) => {
        const totalVolume = volume.leftVolume + volume.rightVolume;
        if (index % 2 === 0) {
          leftBranchVolume += totalVolume;
        } else {
          rightBranchVolume += totalVolume;
        }
      });

      // Apply max sponsorship branch QV limit
      if (rank.maxSponsorshipBranchQv) {
        leftBranchVolume = Math.min(
          leftBranchVolume,
          rank.maxSponsorshipBranchQv,
        );
        rightBranchVolume = Math.min(
          rightBranchVolume,
          rank.maxSponsorshipBranchQv,
        );
      }

      // Check max leg balance percentage
      if (rank.maxLegBalancePercentage) {
        // const maxAllowedVolume =
        //   (totalTreeQv * rank.maxLegBalancePercentage) / 100;
        const totalUsableVolume = leftBranchVolume + rightBranchVolume;

        return totalUsableVolume >= totalTreeQv;
      }

      return true;
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      this.logger.error(
        `Error checking sponsorship branch limits: ${errorMessage}`,
      );
      return false;
    }
  }

  private async checkMinDepthLevels(
    userId: string,
    minDepthLevels: number,
  ): Promise<boolean> {
    try {
      const result = await this.usersService.checkMinDepthLevels(
        userId,
        minDepthLevels,
      );
      return result;
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      this.logger.error(`Error checking min depth levels: ${errorMessage}`);
      return false;
    }
  }

  private async checkActiveMembership(userId: string): Promise<boolean> {
    try {
      const membershipInfo =
        await this.membershipService.getUserMembershipInfo(userId);
      return (
        membershipInfo.hasMembership &&
        membershipInfo.status === MembershipStatus.ACTIVE
      );
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      this.logger.error(`Error checking active membership: ${errorMessage}`);
      return false;
    }
  }

  private async getDirectReferralIds(userId: string): Promise<string[]> {
    try {
      const result = await this.usersService.getDirectReferrals(userId);
      return result;
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      this.logger.error(`Error getting direct referral IDs: ${errorMessage}`);
      return [];
    }
  }

  private async buildUserVolumeData(
    userId: string,
    currentMonthVolume: MonthlyVolumeRank,
  ): Promise<UserVolumeData> {
    try {
      // Calculate basic volume data
      const leftVolume = currentMonthVolume.leftVolume;
      const rightVolume = currentMonthVolume.rightVolume;
      const totalVolume = leftVolume + rightVolume;
      const payLegQv = Math.min(leftVolume, rightVolume);

      // Get direct referrals and count active ones
      const directReferralIds = await this.getDirectReferralIds(userId);
      const totalDirects = directReferralIds.length;
      const activeDirectReferrals = await this.getActiveDirectReferrals(userId);

      // Get active teams count
      const activeTeams = await this.getActiveTeamsCount(userId);

      // Check if user has active membership
      const hasActiveMembership = await this.checkActiveMembership(userId);

      return {
        leftVolume,
        rightVolume,
        totalVolume,
        payLegQv,
        leftDirects: currentMonthVolume.leftDirects,
        rightDirects: currentMonthVolume.rightDirects,
        totalDirects,
        activeDirectReferrals,
        activeTeams,
        hasActiveMembership,
        monthStartDate: currentMonthVolume.monthStartDate,
        monthEndDate: currentMonthVolume.monthEndDate,
        status: currentMonthVolume.status,
      };
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      this.logger.error(`Error building user volume data: ${errorMessage}`);

      // Return default data in case of error
      return {
        leftVolume: 0,
        rightVolume: 0,
        totalVolume: 0,
        payLegQv: 0,
        leftDirects: 0,
        rightDirects: 0,
        totalDirects: 0,
        activeDirectReferrals: 0,
        activeTeams: 0,
        hasActiveMembership: false,
        monthStartDate: new Date(),
        monthEndDate: new Date(),
        status: 'UNKNOWN',
      };
    }
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object' && 'message' in error)
      return String(error.message);
    return 'Error desconocido';
  }
}
