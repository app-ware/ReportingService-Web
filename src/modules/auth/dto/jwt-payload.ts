export interface JwtPayload {
  sub: number;
  username: string |null; 
  centerId: number | null;
  centerType: number | null;
  isAdmin: boolean |null;
}
