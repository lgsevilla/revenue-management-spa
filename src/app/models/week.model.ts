export interface Week {
  weekEnding: string;
  targetRevenue: number;
  actualRevenue?: number;
  revenuePerFte?: number;
  openOrders?: number;

  revenueToTarget: number;
  fteToTarget: number;
  
  market: string;
  region: string;
}