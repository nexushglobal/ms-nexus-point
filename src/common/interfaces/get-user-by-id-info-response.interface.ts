export interface GetUserByIdInfoResponse {
  _id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  photo?: string;
  nickname?: string;
  referralCode: string;
  referrerCode?: string;
}
