export interface HostedBot {
  id: string;
  name: string;
  entryFile: string;
  token?: string;
  botUsername?: string;
  status: 'running' | 'stopped' | 'starting' | 'error';
  pid: number | null;
  uptimeSeconds: number;
  startTime: string | null;
  createdAt: string;
  autoRestart: boolean;
  fileCount?: number;
  error?: string;
}

export interface BotStatus {
  status: 'running' | 'stopped' | 'starting' | 'error';
  pid: number | null;
  uptimeSeconds: number;
  startTime: string | null;
  pythonVersion: string;
  botInfo?: {
    ok: boolean;
    username?: string;
    firstName?: string;
    id?: number;
    error?: string;
  };
  logSummary: {
    totalLogs: number;
    lastLogTime: string | null;
  };
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'otp' | 'system';
  message: string;
}

export interface ServiceRange {
  range: string;
  country: string;
}

export interface ServiceItem {
  sid: string;
  ranges: ServiceRange[];
}

export interface UserRecord {
  user_id: string;
  username?: string;
  full_name?: string;
  balance: number;
  total_numbers?: number;
  referral_count?: number;
  created_at?: string;
  is_banned?: boolean;
}

export interface WithdrawRecord {
  payment_id: string;
  user_id: string | number;
  method: string;
  amount: number;
  number: string;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: string;
}

export interface OtpRecord {
  id: string;
  number: string;
  otp: string;
  service?: string;
  country?: string;
  full_sms?: string;
  timestamp: string;
}
