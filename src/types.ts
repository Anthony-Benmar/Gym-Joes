export type MemberStatus = 'Activo' | 'Por Vencer' | 'Vencido';
export type PaymentStatus = 'Pendiente' | 'Aprobado' | 'Rechazado';

export interface Member {
  id: number;
  name: string;
  dni: string;
  phone: string;
  plan: string;
  start: string;
  end: string;
  status: MemberStatus;
}

export interface Product {
  id: number;
  name: string;
  category: string;
  cost: number;
  price: number;
  stock: number;
  min: number;
}

export interface Transaction {
  id: string;
  date: string;
  time: string;
  concept: string;
  staff: string;
  method: string;
  total: number;
}

export interface Payment {
  id: number;
  name: string;
  dni: string;
  phone: string;
  voucher: string;
  voucherFile?: string;
  voucherFileName?: string;
  plan: string;
  price: number;
  date: string;
  status: PaymentStatus;
  note: string;
  reviewedAt?: string;
}

export interface ClassBooking {
  id: string;
  dni: string;
  name: string;
  className: string;
  date: string;
  time: string;
  status: string;
  createdAt: string;
}

export interface StockMovement {
  id: number;
  date: string;
  product: string;
  type: string;
  quantity: number;
  user: string;
}

export interface StaffUser {
  id: number;
  fullname: string;
  username: string;
  passwordSalt?: string;
  passwordHash?: string;
  role: 'admin' | 'staff';
  status: 'Activo' | 'Inactivo';
}

export interface GymPlan {
  name: string;
  days: number;
  duration: string;
  price: number;
  description: string;
  featured: boolean;
  benefits: string[];
}

export interface AppData {
  members: Member[];
  inventory: Product[];
  transactions: Transaction[];
  payments: Payment[];
  bookings: ClassBooking[];
  stockMovements: StockMovement[];
  users: StaffUser[];
  plans: GymPlan[];
}

export type ClassSession = {
  name: string;
  coach: string;
  time: string;
  day: number;
  level: string;
  icon: string;
  date: string;
};
