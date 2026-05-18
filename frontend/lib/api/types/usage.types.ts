export interface TokenUsageBalance {
  used: number;
  allocation: number;
  reserved: number;
  available: number;
  window_start: string;
  reset_at: string;
  unlimited: boolean;
}
