export interface RankInfo {
  id: number;
  name: string;
  code: string;
}

export interface UserVolumeData {
  leftVolume: number;
  rightVolume: number;
  totalVolume: number;
  payLegQv: number;
  leftDirects: number;
  rightDirects: number;
  totalDirects: number;
  activeDirectReferrals: number;
  activeTeams: number;
  hasActiveMembership: boolean;
  monthStartDate: Date;
  monthEndDate: Date;
  status: string;
}

export interface GetCurrentRankResponse {
  currentRank: RankInfo;
  highestRank?: RankInfo;
  nextRankNow: RankInfo;
  nextRankReq: RankInfo & {
    requerimientos: string[];
  };
  currentData: UserVolumeData;
}
