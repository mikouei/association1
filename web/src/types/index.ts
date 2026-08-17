// Types pour l'application Kotiz

export interface User {
  id: string;
  email: string;
  phone?: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MEMBER';
  name?: string;
}

export interface Association {
  id: string;
  name: string;
  code: string;
  type?: string;
  dbName: string;
  active: boolean;
  adminEmail?: string;
  adminName?: string;
  memberCount?: number;
  enableVehiclePlates?: boolean;
  customFieldLabel?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Member {
  id: string;
  email?: string;
  phone?: string;
  active: boolean;
  name: string;
  customFieldValue?: string;
  token?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Admin {
  id: string;
  email: string;
  phone?: string;
  active: boolean;
  createdAt: string;
}

export interface Year {
  id: string;
  year: number;
  monthlyAmount: number;
  active: boolean;
  createdAt: string;
}

export interface Payment {
  id: string;
  memberId: string;
  yearId: string;
  month: number;
  amountPaid: number;
  paymentDate: string;
  notes?: string;
}

export interface Contribution {
  id: string;
  name: string;
  description?: string;
  targetAmount: number;
  deadline?: string;
  active: boolean;
  createdAt: string;
}

export interface MemberPaymentSummary {
  memberId: string;
  memberName: string;
  customFieldValue?: string;
  months: {
    month: number;
    amountPaid: number;
    isPaid: boolean;
  }[];
  totalPaid: number;
  totalDue: number;
  remaining: number;
  percentage: number;
}

export interface LoginResponse {
  token: string;
  user: User;
  association?: Association;
}

export interface PlatformLoginResponse {
  token: string;
  user: User;
}
