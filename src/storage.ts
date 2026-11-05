import type { AppData, ClassBooking, Member, Payment, Product, StaffUser, StockMovement, Transaction } from './types';

const STORAGE_KEYS = {
  members: 'gym_members',
  inventory: 'gym_inventory',
  transactions: 'gym_transactions',
  payments: 'gym_payment_history',
  bookings: 'gym_class_bookings',
  stockMovements: 'gym_stock_movements',
  users: 'gym_users',
} as const;

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const initialData: AppData = {
  members: [
    { id: 1, name: 'Carlos Mendoza', dni: '70451238', phone: '+51 987 654 321', plan: 'Plan Trimestral', start: addDays(-74), end: addDays(16), status: 'Activo' },
    { id: 2, name: 'Sofía Rivas', dni: '71930456', phone: '+51 912 345 678', plan: 'Plan Mensual', start: addDays(-25), end: addDays(5), status: 'Por Vencer' },
    { id: 3, name: 'Diego Vargas', dni: '72841063', phone: '+51 955 443 322', plan: 'Pase Diario', start: today(), end: today(), status: 'Activo' },
    { id: 4, name: 'Valeria Gómez', dni: '73625104', phone: '+51 933 221 100', plan: 'Plan Anual', start: addDays(-120), end: addDays(245), status: 'Activo' },
    { id: 5, name: 'Mateo Silva', dni: '74819632', phone: '+51 977 888 999', plan: 'Plan Mensual', start: addDays(-45), end: addDays(-15), status: 'Vencido' },
  ],
  inventory: [
    { id: 101, name: 'Whey Protein Isolate 5lb', category: 'Proteínas y Ganadores', cost: 75, price: 95, stock: 12, min: 3 },
    { id: 102, name: 'Mass Gainer Pro 10lb', category: 'Proteínas y Ganadores', cost: 60, price: 85, stock: 5, min: 2 },
    { id: 103, name: 'Creatina Monohidratada 300g', category: 'Creatinas y Pre-entrenos', cost: 22, price: 35, stock: 18, min: 5 },
    { id: 104, name: 'Pre-Workout Explosive 300g', category: 'Creatinas y Pre-entrenos', cost: 25, price: 40, stock: 8, min: 4 },
    { id: 105, name: 'BCAA 2:1:1 400g', category: 'Creatinas y Pre-entrenos', cost: 20, price: 32, stock: 10, min: 3 },
    { id: 106, name: 'Agua Mineral 600ml', category: 'Bebidas e Hidratantes', cost: 0.5, price: 1.5, stock: 45, min: 15 },
    { id: 107, name: 'Bebida Isotónica Power 500ml', category: 'Bebidas e Hidratantes', cost: 1.2, price: 3, stock: 24, min: 10 },
    { id: 108, name: 'Energético Monster 473ml', category: 'Bebidas e Hidratantes', cost: 1.8, price: 4, stock: 14, min: 6 },
    { id: 109, name: 'Barra Proteica Choco-Nut', category: 'Snacks y Alimentos', cost: 1.5, price: 3.5, stock: 30, min: 10 },
    { id: 110, name: 'Batido Proteico Listo 500ml', category: 'Snacks y Alimentos', cost: 2.5, price: 5, stock: 16, min: 5 },
    { id: 111, name: 'Shaker Deportivo 3 Compartimentos', category: 'Accesorios / Merch', cost: 4, price: 10, stock: 9, min: 3 },
    { id: 112, name: 'Straps de Aguante de Cuero', category: 'Accesorios / Merch', cost: 7, price: 18, stock: 6, min: 2 },
  ],
  transactions: [
    { id: 'TRX-8941', date: today(), time: '10:24', concept: 'Venta: Whey Protein Isolate 5lb', staff: 'Lucía R. (Staff)', method: 'Tarjeta', total: 95 },
    { id: 'TRX-8940', date: today(), time: '09:45', concept: 'Inscripción: Plan Trimestral (Carlos M.)', staff: 'Mariano (Dueño)', method: 'Efectivo', total: 150 },
    { id: 'TRX-8939', date: today(), time: '09:12', concept: 'Venta: Agua Mineral + Barra Proteica', staff: 'Lucía R. (Staff)', method: 'Yape / Plin', total: 5 },
  ],
  payments: [],
  bookings: [],
  stockMovements: [],
  users: [
    { id: 1, fullname: 'Mariano CEO', username: 'mariano', role: 'admin', status: 'Activo' },
    { id: 2, fullname: 'Lucía R. Rivas', username: 'lucia', role: 'staff', status: 'Activo' },
  ],
};

function readKey<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function migratePaymentData(): Payment[] {
  const reviewed = readKey<Payment[]>(STORAGE_KEYS.payments, []);
  const pending = readKey<Array<Omit<Payment, 'status' | 'note'> & Partial<Pick<Payment, 'status' | 'note'>>>>('gym_pending_subscriptions', []);
  const normalizedPending: Payment[] = pending.map(payment => ({
    ...payment,
    status: payment.status || 'Pendiente',
    note: payment.note || 'Comprobante recibido. En espera de validación.',
  }));
  const merged = new Map<number, Payment>();
  [...reviewed, ...normalizedPending].forEach(payment => merged.set(Number(payment.id), payment));
  return [...merged.values()].sort((a, b) => b.id - a.id);
}

export function loadData(): AppData {
  return {
    members: readKey<Member[]>(STORAGE_KEYS.members, initialData.members),
    inventory: readKey<Product[]>(STORAGE_KEYS.inventory, initialData.inventory),
    transactions: readKey<Transaction[]>(STORAGE_KEYS.transactions, initialData.transactions),
    payments: migratePaymentData(),
    bookings: readKey<ClassBooking[]>(STORAGE_KEYS.bookings, initialData.bookings),
    stockMovements: readKey<StockMovement[]>(STORAGE_KEYS.stockMovements, initialData.stockMovements),
    users: readKey<StaffUser[]>(STORAGE_KEYS.users, initialData.users),
  };
}

export function saveData(data: AppData): void {
  const serialized: Record<string, string> = {
    [STORAGE_KEYS.members]: JSON.stringify(data.members),
    [STORAGE_KEYS.inventory]: JSON.stringify(data.inventory),
    [STORAGE_KEYS.transactions]: JSON.stringify(data.transactions),
    [STORAGE_KEYS.payments]: JSON.stringify(data.payments),
    [STORAGE_KEYS.bookings]: JSON.stringify(data.bookings),
    [STORAGE_KEYS.stockMovements]: JSON.stringify(data.stockMovements),
    [STORAGE_KEYS.users]: JSON.stringify(data.users),
    gym_pending_subscriptions: JSON.stringify(data.payments.filter(payment => payment.status === 'Pendiente')),
  };
  const previous = new Map<string, string | null>();
  Object.keys(serialized).forEach(key => previous.set(key, localStorage.getItem(key)));
  try {
    Object.entries(serialized).forEach(([key, value]) => localStorage.setItem(key, value));
  } catch (error) {
    previous.forEach((value, key) => {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    });
    throw error;
  }
}
