import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import QRCode from 'qrcode';
import {
  Activity, ArrowDownToLine, ArrowRight, BadgeCheck, Bike, CalendarDays, Check,
  CheckCircle2, ChevronDown, CircleDollarSign, Clock3, Crown, Dumbbell, FileCheck2, Filter,
  Flower2, IdCard, LayoutDashboard, LogOut, Menu, Package, Pencil, Plus, Search, ShieldCheck,
  ShoppingBag, ShoppingCart, ScanLine, Trash2, UserRound, UserRoundPlus, Users,
  Wallet, X, Zap,
} from 'lucide-react';
import { hashPassword, verifyPassword } from './auth';
import { loadData, saveData } from './storage';
import type { AppData, ClassSession, Member, MemberStatus, Payment, Product, StaffUser } from './types';

type Area = 'portal' | 'owner';
type OwnerPage = 'dashboard' | 'members' | 'inventory' | 'payments' | 'classes' | 'pos' | 'checkin' | 'team';
type PortalPage = 'plans' | 'membership' | 'classes' | 'payments';
type Toast = { id: number; message: string; kind: 'success' | 'error' };
type ClassInfo = Omit<ClassSession, 'date'>;
type CartLine = { id: number; quantity: number };

const PLAN_OPTIONS = [
  { name: 'Pase Diario', days: 1, duration: '1 día', price: 10, description: 'Un día completo para conocer el gimnasio.', featured: false, benefits: ['Acceso a máquinas y pesas', 'Casillero y ducha'] },
  { name: 'Plan Mensual', days: 30, duration: '30 días', price: 60, description: 'Constancia que se convierte en resultados.', featured: true, benefits: ['Acceso durante el horario del gimnasio', 'Evaluación física inicial', 'Acceso a clases grupales'] },
  { name: 'Plan Trimestral', days: 90, duration: '90 días', price: 150, description: 'Entrena a largo plazo y ahorra en tu membresía.', featured: false, benefits: ['Acceso durante el horario del gimnasio', 'Asesoría nutricional inicial', 'Mejor precio por mes'] },
];

const CLASS_INFO: ClassInfo[] = [
  { name: 'Fuerza & acondicionamiento', coach: 'Entrenamiento funcional', time: '07:00', day: 1, level: 'Todos los niveles', icon: 'dumbbell' },
  { name: 'Spinning', coach: 'Cardio indoor', time: '18:30', day: 1, level: 'Intermedio', icon: 'bike' },
  { name: 'Power HIIT', coach: 'Alta intensidad', time: '07:00', day: 2, level: 'Intermedio / avanzado', icon: 'zap' },
  { name: 'Yoga & movilidad', coach: 'Flexibilidad y recuperación', time: '19:00', day: 3, level: 'Todos los niveles', icon: 'flower-2' },
  { name: 'Box fit', coach: 'Técnica y cardio', time: '18:30', day: 4, level: 'Todos los niveles', icon: 'activity' },
  { name: 'Bootcamp', coach: 'Circuito de fuerza', time: '09:00', day: 6, level: 'Todos los niveles', icon: 'flame' },
];

const CATEGORIES = ['Todos', 'Proteínas y Ganadores', 'Creatinas y Pre-entrenos', 'Bebidas e Hidratantes', 'Snacks y Alimentos', 'Accesorios / Merch'];

const today = () => new Date().toISOString().slice(0, 10);
const makeId = () => Date.now() + Math.floor(Math.random() * 1000);
const money = (amount: number) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(amount);
const formatDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });
const getEndDate = (start: string, days: number) => {
  const date = new Date(`${start}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};
const isMemberActive = (member: Member) => ['Activo', 'Por Vencer'].includes(member.status) && member.end >= today();
const escapeCsv = (value: string | number) => {
  let text = String(value ?? '');
  if (typeof value === 'string' && /^\s*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const content = `\uFEFF${rows.map(row => row.map(escapeCsv).join(',')).join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function getUpcomingClasses(): ClassSession[] {
  const now = new Date();
  return CLASS_INFO.map(session => {
    const date = new Date(now);
    let offset = (session.day - now.getDay() + 7) % 7;
    if (offset === 0) offset = 7;
    date.setDate(date.getDate() + offset);
    return { ...session, date: date.toISOString().slice(0, 10) };
  });
}

function IconForClass({ name }: { name: string }) {
  if (name === 'bike') return <Bike size={21} />;
  if (name === 'zap') return <Zap size={21} />;
  if (name === 'flower-2') return <Flower2 size={21} />;
  if (name === 'activity' || name === 'flame') return <Activity size={21} />;
  return <Dumbbell size={21} />;
}

function IconButton({ label, onClick, children, danger = false }: { label: string; onClick: () => void; children: ReactNode; danger?: boolean }) {
  return <button className={`icon-button ${danger ? 'danger' : ''}`} onClick={onClick} aria-label={label} title={label}>{children}</button>;
}

function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'green' | 'amber' | 'red' | 'gold' | 'blue' }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className={`modal-card ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
      <header className="modal-header"><div><h2>{title}</h2></div><IconButton label="Cerrar" onClick={onClose}><X size={18} /></IconButton></header>
      {children}
    </section>
  </div>;
}

export default function App() {
  const [data, setData] = useState<AppData>(() => loadData());
  const [area, setArea] = useState<Area>('portal');
  const [portalPage, setPortalPage] = useState<PortalPage>('plans');
  const [ownerPage, setOwnerPage] = useState<OwnerPage>('dashboard');
  const [authenticatedUserId, setAuthenticatedUserId] = useState<number | null>(() => {
    const storedId = Number(sessionStorage.getItem('gym_authenticated_user_id'));
    return data.users.some(user => user.id === storedId && user.status === 'Activo') ? storedId : null;
  });
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginUserId, setLoginUserId] = useState<number | null>(null);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginConfirmation, setLoginConfirmation] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [staffMenuOpen, setStaffMenuOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mobileNav, setMobileNav] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberFilter, setMemberFilter] = useState('Todos');
  const [inventorySearch, setInventorySearch] = useState('');
  const [category, setCategory] = useState('Todos');
  const [lowStock, setLowStock] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [lookupDni, setLookupDni] = useState('');
  const [membershipResult, setMembershipResult] = useState<Member | null | undefined>();
  const [paymentDni, setPaymentDni] = useState('');
  const [bookingDni, setBookingDni] = useState('');
  const [bookingClass, setBookingClass] = useState<ClassSession | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<(typeof PLAN_OPTIONS)[number] | null>(null);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);
  const [rejectingPayment, setRejectingPayment] = useState<Payment | null>(null);
  const [voucherPreview, setVoucherPreview] = useState<string | null>(null);
  const [checkinSearch, setCheckinSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [classNameSearch, setClassNameSearch] = useState('');
  const [memberQr, setMemberQr] = useState('');

  const activeUser = data.users.find(user => user.id === authenticatedUserId);
  const isAdmin = activeUser?.role === 'admin';
  const loginAccount = data.users.find(user => user.id === loginUserId);
  const needsOwnerSetup = loginAccount?.role === 'admin' && !loginAccount.passwordHash;
  const pendingPayments = data.payments.filter(payment => payment.status === 'Pendiente');
  const activeMembersCount = data.members.filter(isMemberActive).length;
  const lowStockCount = data.inventory.filter(product => product.stock <= product.min).length;
  const totalRevenue = data.transactions.reduce((total, transaction) => total + transaction.total, 0);

  function notify(message: string, kind: Toast['kind'] = 'success') {
    const id = makeId();
    setToasts(current => [...current, { id, message, kind }]);
    window.setTimeout(() => setToasts(current => current.filter(toast => toast.id !== id)), 3500);
  }

  function commit(update: (current: AppData) => AppData, success?: string) {
    const next = update(data);
    try {
      saveData(next);
      setData(next);
      if (success) notify(success);
    } catch (error) {
      console.error('No se pudieron guardar los cambios localmente.', error);
      notify('No se pudieron guardar los cambios. Revisa el espacio disponible del navegador.', 'error');
    }
  }

  function openStaffLogin(userId?: number) {
    const preferredId = userId
      ?? authenticatedUserId
      ?? data.users.find(user => user.role === 'admin' && user.status === 'Activo')?.id
      ?? data.users.find(user => user.status === 'Activo')?.id
      ?? null;
    setLoginUserId(preferredId);
    setLoginUsername(data.users.find(user => user.id === preferredId)?.username ?? '');
    setLoginPassword('');
    setLoginConfirmation('');
    setLoginError('');
    setStaffMenuOpen(false);
    setLoginOpen(true);
  }

  function selectLoginUser(userId: number) {
    setLoginUserId(userId);
    setLoginUsername(data.users.find(user => user.id === userId)?.username ?? '');
    setLoginPassword('');
    setLoginConfirmation('');
    setLoginError('');
    setStaffMenuOpen(false);
    setLoginOpen(true);
  }

  function signOut() {
    setAuthenticatedUserId(null);
    setArea('portal');
    setOwnerPage('dashboard');
    setStaffMenuOpen(false);
    notify('Sesión cerrada.');
  }

  async function submitStaffLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loginBusy) return;
    setLoginBusy(true);
    setLoginError('');
    try {
      const username = loginUsername.trim().toLocaleLowerCase();
      const user = data.users.find(candidate =>
        candidate.id === loginUserId
        && candidate.status === 'Activo'
        && candidate.username.toLocaleLowerCase() === username,
      );
      if (!user) {
        setLoginError('Selecciona una cuenta activa e ingresa su nombre de usuario.');
        return;
      }

      if (user.role === 'admin' && !user.passwordHash) {
        if (loginPassword.length < 8) {
          setLoginError('Crea una contraseña de al menos 8 caracteres.');
          return;
        }
        if (loginPassword !== loginConfirmation) {
          setLoginError('Las contraseñas no coinciden.');
          return;
        }
        const credentials = await hashPassword(loginPassword);
        const nextData: AppData = {
          ...data,
          users: data.users.map(item => item.id === user.id
            ? { ...item, passwordSalt: credentials.salt, passwordHash: credentials.hash }
            : item),
        };
        saveData(nextData);
        setData(nextData);
      } else {
        if (!user.passwordSalt || !user.passwordHash) {
          setLoginError('Esta cuenta aún no tiene contraseña. Pide al administrador que la configure.');
          return;
        }
        const valid = await verifyPassword(loginPassword, user.passwordSalt, user.passwordHash);
        if (!valid) {
          setLoginError('Usuario o contraseña incorrectos.');
          return;
        }
      }

      setAuthenticatedUserId(user.id);
      setArea('owner');
      setOwnerPage(user.role === 'admin' ? 'dashboard' : 'members');
      setLoginOpen(false);
      setLoginPassword('');
      setLoginConfirmation('');
      notify(user.role === 'admin' && !user.passwordHash ? 'Contraseña del administrador creada.' : `Bienvenido/a, ${user.fullname}.`);
    } catch (error) {
      console.error('No se pudo completar el inicio de sesión.', error);
      setLoginError('No se pudo guardar o verificar el acceso. Usa un navegador compatible y vuelve a intentar.');
    } finally {
      setLoginBusy(false);
    }
  }

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key.startsWith('gym_')) setData(loadData());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (authenticatedUserId === null) {
      sessionStorage.removeItem('gym_authenticated_user_id');
      return;
    }
    const user = data.users.find(item => item.id === authenticatedUserId && item.status === 'Activo');
    if (!user) {
      setAuthenticatedUserId(null);
      setArea('portal');
      return;
    }
    sessionStorage.setItem('gym_authenticated_user_id', String(authenticatedUserId));
  }, [authenticatedUserId, data.users]);

  useEffect(() => {
    if (!membershipResult || membershipResult.end < today() || !isMemberActive(membershipResult)) {
      setMemberQr('');
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(`IRONFIT-MEMBER:${membershipResult.id}`, {
      width: 196,
      margin: 1,
      color: { dark: '#111311', light: '#ffffff' },
    }).then(url => {
      if (!cancelled) setMemberQr(url);
    }).catch(error => {
      console.error('No se pudo generar el QR de la membresía.', error);
      notify('No pudimos generar el código QR. Intenta actualizar la página.', 'error');
    });
    return () => { cancelled = true; };
  }, [membershipResult]);

  const filteredMembers = useMemo(() => data.members.filter(member => {
    const query = memberSearch.trim().toLocaleLowerCase();
    const matchesText = !query || [member.name, member.dni, member.phone, member.plan].some(value => String(value || '').toLocaleLowerCase().includes(query));
    const matchesStatus = memberFilter === 'Todos' || (memberFilter === 'Activos' ? isMemberActive(member) : memberFilter === 'Por vencer' ? member.status === 'Por Vencer' : member.status === 'Vencido' || member.end < today());
    return matchesText && matchesStatus;
  }), [data.members, memberSearch, memberFilter]);

  const filteredProducts = useMemo(() => data.inventory.filter(product => {
    const query = inventorySearch.trim().toLocaleLowerCase();
    return (!query || `${product.name} ${product.category}`.toLocaleLowerCase().includes(query))
      && (category === 'Todos' || product.category === category)
      && (!lowStock || product.stock <= product.min);
  }), [data.inventory, inventorySearch, category, lowStock]);

  function switchOwnerPage(page: OwnerPage) {
    if (!isAdmin && ['dashboard', 'inventory', 'payments', 'classes', 'team'].includes(page)) {
      notify('Esta sección requiere permisos de administrador.', 'error');
      return;
    }
    setOwnerPage(page);
    setMobileNav(false);
  }

  function exportMembers() {
    downloadCsv('socios-joes-gym.csv', [
      ['Nombre', 'DNI', 'Teléfono', 'Plan', 'Inicio', 'Vencimiento', 'Estado'],
      ...filteredMembers.map(member => [member.name, member.dni || '', member.phone, member.plan, member.start, member.end, member.status]),
    ]);
  }

  function exportInventory() {
    downloadCsv('inventario-joes-gym.csv', [
      ['Producto', 'Categoría', 'Costo', 'Precio', 'Stock', 'Stock mínimo'],
      ...filteredProducts.map(product => [product.name, product.category, product.cost, product.price, product.stock, product.min]),
    ]);
  }

  function exportTransactions() {
    downloadCsv('ventas-joes-gym.csv', [
      ['ID', 'Fecha', 'Hora', 'Concepto', 'Responsable', 'Método', 'Total'],
      ...data.transactions.map(transaction => [transaction.id, transaction.date, transaction.time, transaction.concept, transaction.staff, transaction.method, transaction.total]),
    ]);
  }

  function exportPayments() {
    downloadCsv('pagos-joes-gym.csv', [
      ['Nombre', 'DNI', 'Plan', 'Fecha', 'Estado', 'Observación'],
      ...data.payments.map(payment => [payment.name, payment.dni, payment.plan, payment.reviewedAt || payment.date, payment.status, payment.note]),
    ]);
  }

  function exportStockMovements() {
    downloadCsv('movimientos-stock-joes-gym.csv', [
      ['Fecha', 'Producto', 'Tipo', 'Cantidad', 'Responsable'],
      ...data.stockMovements.map(movement => [movement.date, movement.product, movement.type, movement.quantity, movement.user]),
    ]);
  }

  function saveMemberForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') || '').trim();
    const dni = String(form.get('dni') || '').trim();
    const phone = String(form.get('phone') || '').trim();
    const plan = String(form.get('plan') || 'Plan Mensual');
    const start = String(form.get('start') || today());
    const status = String(form.get('status') || 'Activo') as MemberStatus;
    if (!name || !phone || (dni && !/^\d{8,12}$/.test(dni))) {
      notify('Revisa el nombre, teléfono y formato de DNI (8 a 12 dígitos).', 'error');
      return;
    }
    const isEditing = Boolean(editingMember?.id);
    if (dni && data.members.some(member => member.dni === dni && member.id !== (isEditing ? editingMember?.id : undefined))) {
      notify('Ya existe un socio con ese DNI.', 'error');
      return;
    }
    const planInfo = PLAN_OPTIONS.find(option => option.name === plan) ?? PLAN_OPTIONS[1];
    const member: Member = { id: isEditing ? editingMember!.id : makeId(), name, dni, phone, plan, start, end: getEndDate(start, planInfo.days), status };
    commit(current => {
      const members = isEditing
        ? current.members.map(item => item.id === member.id ? member : item)
        : [member, ...current.members];
      const transactions = isEditing ? current.transactions : [{
        id: `TRX-${makeId()}`, date: today(), time: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
        concept: `Inscripción: ${plan} (${name})`, staff: activeUser?.fullname ?? 'Equipo', method: 'Efectivo', total: planInfo.price,
      }, ...current.transactions];
      return { ...current, members, transactions };
    }, editingMember ? 'Socio actualizado.' : 'Socio registrado y pago contabilizado.');
    setEditingMember(null);
  }

  function removeMember(member: Member) {
    if (!window.confirm(`¿Eliminar a ${member.name} del padrón de socios?`)) return;
    commit(current => ({ ...current, members: current.members.filter(item => item.id !== member.id) }), 'Socio eliminado.');
  }

  function saveProductForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') || '').trim();
    const isEditing = Boolean(editingProduct?.id);
    const product: Product = {
      id: isEditing ? editingProduct!.id : makeId(),
      name,
      category: String(form.get('category') || CATEGORIES[1]),
      stock: Number(form.get('stock')),
      cost: Number(form.get('cost')),
      price: Number(form.get('price')),
      min: Number(form.get('min')),
    };
    if (!name || ![product.stock, product.cost, product.price, product.min].every(Number.isFinite) || product.stock < 0 || product.min < 0 || product.price < 0 || product.cost < 0 || !Number.isInteger(product.stock) || !Number.isInteger(product.min)) {
      notify('Completa los datos del producto con valores válidos.', 'error');
      return;
    }
    const oldStock = editingProduct?.stock ?? 0;
    const movement = product.stock !== oldStock ? [{
      id: makeId(), date: new Date().toLocaleString('es-PE'), product: product.name,
      type: editingProduct ? 'Ajuste manual' : 'Ingreso inicial', quantity: product.stock - oldStock, user: activeUser?.fullname ?? 'Equipo',
    }] : [];
    commit(current => ({
      ...current,
      inventory: isEditing ? current.inventory.map(item => item.id === product.id ? product : item) : [product, ...current.inventory],
      stockMovements: [...movement, ...current.stockMovements].slice(0, 200),
    }), isEditing ? 'Producto actualizado.' : 'Producto agregado al inventario.');
    setEditingProduct(null);
  }

  function removeProduct(product: Product) {
    if (!window.confirm(`¿Eliminar ${product.name} del inventario?${product.stock ? ` Tiene ${product.stock} unidades.` : ''}`)) return;
    commit(current => ({ ...current, inventory: current.inventory.filter(item => item.id !== product.id) }), 'Producto eliminado.');
    setCart(current => current.filter(item => item.id !== product.id));
  }

  function addToCart(product: Product) {
    const line = cart.find(item => item.id === product.id);
    if (product.stock < 1 || (line?.quantity ?? 0) >= product.stock) {
      notify('No hay suficiente stock para agregar otra unidad.', 'error');
      return;
    }
    setCart(current => line
      ? current.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
      : [...current, { id: product.id, quantity: 1 }]);
  }

  function checkout() {
    if (!cart.length) return notify('Agrega productos antes de cobrar.', 'error');
    const unavailable = cart.find(line => !data.inventory.some(product => product.id === line.id && product.stock >= line.quantity));
    if (unavailable) return notify('El inventario cambió y ya no hay stock suficiente.', 'error');
    const lines = cart.map(line => {
      const product = data.inventory.find(item => item.id === line.id)!;
      return { product, quantity: line.quantity };
    });
    const total = lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
    commit(current => ({
      ...current,
      inventory: current.inventory.map(product => {
        const sold = lines.find(line => line.product.id === product.id);
        return sold ? { ...product, stock: product.stock - sold.quantity } : product;
      }),
      stockMovements: [
        ...lines.map(line => ({ id: makeId(), date: new Date().toLocaleString('es-PE'), product: line.product.name, type: 'Venta POS', quantity: -line.quantity, user: activeUser?.fullname ?? 'Equipo' })),
        ...current.stockMovements,
      ].slice(0, 200),
      transactions: [{
        id: `TRX-${makeId()}`, date: today(), time: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
        concept: `Venta POS: ${lines.map(line => `${line.quantity}x ${line.product.name}`).join(', ')}`,
        staff: activeUser?.fullname ?? 'Equipo', method: paymentMethod, total,
      }, ...current.transactions],
    }), `Venta cobrada por ${money(total)}.`);
    setCart([]);
  }

  function approvePayment(payment: Payment) {
    const start = today();
    const plan = PLAN_OPTIONS.find(option => option.name === payment.plan) ?? PLAN_OPTIONS[1];
    const member: Member = {
      id: data.members.find(existing => existing.dni === payment.dni)?.id ?? makeId(),
      name: payment.name, dni: payment.dni, phone: payment.phone, plan: payment.plan,
      start, end: getEndDate(start, plan.days), status: 'Activo',
    };
    commit(current => ({
      ...current,
      payments: current.payments.map(item => item.id === payment.id ? { ...item, status: 'Aprobado', note: 'Pago validado y membresía activada.', reviewedAt: new Date().toLocaleString('es-PE') } : item),
      members: [member, ...current.members.filter(item => item.id !== member.id)],
      transactions: [{
        id: `TRX-${makeId()}`, date: today(), time: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
        concept: `Suscripción web: ${payment.plan} (${payment.name})`, staff: activeUser?.fullname ?? 'Equipo', method: 'Transferencia / depósito', total: payment.price,
      }, ...current.transactions],
    }), `Pago aprobado y membresía activada para ${payment.name}.`);
  }

  function rejectPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rejectingPayment) return;
    const note = String(new FormData(event.currentTarget).get('note') || '').trim();
    if (note.length < 5) return notify('Describe el motivo del rechazo (mínimo 5 caracteres).', 'error');
    const id = rejectingPayment.id;
    commit(current => ({
      ...current,
      payments: current.payments.map(payment => payment.id === id ? { ...payment, status: 'Rechazado', note, reviewedAt: new Date().toLocaleString('es-PE') } : payment),
    }), 'Rechazo registrado y visible para el socio.');
    setRejectingPayment(null);
  }

  async function submitPlanRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPlan) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const name = String(values.get('name') || '').trim();
    const dni = String(values.get('dni') || '').trim();
    const phone = String(values.get('phone') || '').trim();
    const operation = String(values.get('operation') || '').trim();
    const file = (values.get('proof') as File | null) ?? null;
    if (!name || !phone || !/^\d{8,12}$/.test(dni) || !operation || !file || file.size > 600 * 1024) {
      notify('Verifica tus datos y adjunta un comprobante de máximo 600 KB.', 'error');
      return;
    }
    if (!['image/png', 'image/jpeg', 'image/webp', 'application/pdf'].includes(file.type)) {
      notify('El comprobante debe ser PNG, JPG, WEBP o PDF.', 'error');
      return;
    }
    if (data.payments.some(payment => payment.dni === dni && payment.status === 'Pendiente')) {
      notify('Ya tienes un pago pendiente de revisión para ese DNI.', 'error');
      return;
    }
    try {
      const fileData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Archivo inválido.'));
        reader.onerror = () => reject(new Error('No pudimos leer el archivo adjunto.'));
        reader.readAsDataURL(file);
      });
      const payment: Payment = {
        id: makeId(), name, dni, phone, voucher: operation, voucherFile: fileData,
        voucherFileName: file.name, plan: selectedPlan.name, price: selectedPlan.price,
        date: new Date().toLocaleString('es-PE'), status: 'Pendiente',
        note: 'Comprobante recibido. En espera de validación.',
      };
      commit(current => ({ ...current, payments: [payment, ...current.payments] }), 'Solicitud enviada. Te avisaremos al validar el comprobante.');
      setSelectedPlan(null);
      setLookupDni(dni);
      setMembershipResult(undefined);
      setPortalPage('membership');
      form.reset();
    } catch (error) {
      console.error('No se pudo procesar el comprobante de pago.', error);
      notify('No se pudo leer el comprobante. Intenta con otro archivo.', 'error');
    }
  }

  function lookupMembership() {
    if (!/^\d{8,12}$/.test(lookupDni)) {
      notify('Escribe un DNI válido de 8 a 12 dígitos.', 'error');
      setMembershipResult(null);
      return;
    }
    setMembershipResult(data.members.find(member => member.dni === lookupDni) ?? null);
  }

  function requestBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!bookingClass) return;
    const dni = String(new FormData(event.currentTarget).get('dni') || '').trim();
    if (!/^\d{8,12}$/.test(dni)) return notify('Escribe un DNI válido de 8 a 12 dígitos.', 'error');
    const member = data.members.find(item => item.dni === dni && isMemberActive(item));
    if (!member) return notify('Necesitas una membresía activa para reservar una clase.', 'error');
    const sameClass = data.bookings.filter(item => item.date === bookingClass.date && item.className === bookingClass.name);
    if (sameClass.length >= 12) return notify('Esta clase ya no tiene cupos.', 'error');
    if (data.bookings.some(item => item.dni === dni && item.date === bookingClass.date && item.time === bookingClass.time)) {
      return notify('Ya tienes una reserva en ese horario.', 'error');
    }
    commit(current => ({
      ...current,
      bookings: [...current.bookings, {
        id: `${makeId()}`, dni, name: member.name, className: bookingClass.name,
        date: bookingClass.date, time: bookingClass.time, status: 'Reservada', createdAt: new Date().toISOString(),
      }],
    }), 'Tu lugar quedó reservado.');
    setBookingClass(null);
    setBookingDni(dni);
  }

  function cancelBooking(id: string) {
    if (!window.confirm('¿Cancelar esta reserva?')) return;
    commit(current => ({ ...current, bookings: current.bookings.filter(booking => booking.id !== id) }), 'Reserva cancelada.');
  }

  function recordCheckin(member: Member) {
    if (!isMemberActive(member)) return notify(`Acceso denegado: la membresía de ${member.name} está vencida.`, 'error');
    notify(`Acceso registrado. ¡Bienvenido/a, ${member.name}!`);
  }

  async function saveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const fullname = String(form.get('fullname') || '').trim();
    const username = String(form.get('username') || '').trim();
    const password = String(form.get('password') || '');
    const role = String(form.get('role') || 'staff') as StaffUser['role'];
    const status = String(form.get('status') || 'Activo') as StaffUser['status'];
    const isEditing = Boolean(editingUser?.id);
    const id = isEditing ? editingUser!.id : makeId();
    if (!fullname || !username) return notify('Completa nombre y usuario.', 'error');
    if ((!isEditing || password) && password.length < 8) return notify('La contraseña debe tener al menos 8 caracteres.', 'error');
    if (id === authenticatedUserId && role !== 'admin') return notify('No puedes quitarte los permisos de administrador en tu propia sesión.', 'error');
    if (id === authenticatedUserId && status !== 'Activo') return notify('No puedes desactivar la cuenta de tu propia sesión.', 'error');
    if (data.users.some(user => user.username.toLowerCase() === username.toLowerCase() && user.id !== id)) return notify('Ese nombre de usuario ya existe.', 'error');
    try {
      const credentials = password ? await hashPassword(password) : undefined;
      const existing = data.users.find(user => user.id === id);
      const user: StaffUser = {
        id,
        fullname,
        username,
        role,
        status,
        passwordSalt: credentials?.salt ?? existing?.passwordSalt,
        passwordHash: credentials?.hash ?? existing?.passwordHash,
      };
      commit(current => ({
        ...current,
        users: isEditing ? current.users.map(item => item.id === id ? user : item) : [...current.users, user],
      }), 'Usuario guardado.');
      setEditingUser(null);
    } catch (error) {
      console.error('No se pudo guardar la contraseña del usuario.', error);
      notify('No se pudo guardar el usuario. Revisa el navegador y vuelve a intentar.', 'error');
    }
  }

  function removeUser(user: StaffUser) {
    if (user.id === 1 || user.id === authenticatedUserId) return notify('No puedes eliminar la cuenta propietaria o la sesión actual.', 'error');
    if (user.role === 'admin' && user.status === 'Activo' && data.users.filter(item => item.role === 'admin' && item.status === 'Activo').length === 1) {
      return notify('Debe quedar al menos un administrador activo.', 'error');
    }
    if (!window.confirm(`¿Eliminar al usuario ${user.fullname}?`)) return;
    commit(current => ({ ...current, users: current.users.filter(item => item.id !== user.id) }), 'Usuario eliminado.');
  }

  const navItems: Array<{ id: OwnerPage; label: string; icon: ReactNode; adminOnly?: boolean }> = [
    { id: 'dashboard', label: 'Resumen', icon: <LayoutDashboard size={18} />, adminOnly: true },
    { id: 'members', label: 'Socios', icon: <Users size={18} /> },
    { id: 'payments', label: 'Pagos web', icon: <FileCheck2 size={18} />, adminOnly: true },
    { id: 'classes', label: 'Clases y reservas', icon: <CalendarDays size={18} />, adminOnly: true },
    { id: 'inventory', label: 'Inventario', icon: <Package size={18} />, adminOnly: true },
    { id: 'pos', label: 'Punto de venta', icon: <ShoppingCart size={18} /> },
    { id: 'checkin', label: 'Control de acceso', icon: <ScanLine size={18} /> },
    { id: 'team', label: 'Equipo', icon: <ShieldCheck size={18} />, adminOnly: true },
  ];

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#" onClick={event => { event.preventDefault(); setArea('portal'); }}>
        <span className="brand-mark"><Crown size={22} /></span>
        <span><strong>JOE'S <em>GYM CALCA</em></strong><small>Fuerza · bienestar · comunidad</small></span>
      </a>
      <nav className="area-switch" aria-label="Cambiar sección">
        <button className={area === 'portal' ? 'active' : ''} onClick={() => setArea('portal')}><UserRound size={16} /> Portal de socios</button>
        <button className={area === 'owner' ? 'active' : ''} onClick={() => authenticatedUserId === null ? openStaffLogin() : setArea('owner')}><LayoutDashboard size={16} /> Gestión del gimnasio</button>
      </nav>
      <div className="topbar-profile">
        <span className={`online-dot ${authenticatedUserId === null ? 'offline' : ''}`} />
        <span className="profile-caption">{area === 'owner' ? activeUser?.fullname ?? 'Personal' : 'Sede Calca'}</span>
        <div className="staff-access">
          <button className="staff-access-trigger" aria-expanded={staffMenuOpen} onClick={() => setStaffMenuOpen(value => !value)}>
            <UserRound size={15} /><span>{authenticatedUserId === null ? 'Acceso personal' : 'Personal'}</span><ChevronDown size={15} />
          </button>
          {staffMenuOpen && <div className="staff-menu" role="menu">
            <strong>{authenticatedUserId === null ? 'Iniciar sesión como' : 'Cambiar de cuenta'}</strong>
            {data.users.filter(user => user.status === 'Activo').map(user => <button key={user.id} role="menuitem" onClick={() => selectLoginUser(user.id)}>
              <span className="staff-menu-avatar">{user.fullname.slice(0, 1).toLocaleUpperCase()}</span>
              <span><b>{user.fullname}</b><small>{user.role === 'admin' ? 'Administrador' : 'Recepción'}</small></span>
            </button>)}
            {authenticatedUserId !== null && <button className="staff-menu-logout" role="menuitem" onClick={signOut}><LogOut size={15} /> Cerrar sesión</button>}
          </div>}
        </div>
      </div>
    </header>

    {area === 'portal' ? <main className="portal">
      <section className="portal-hero">
        <div className="hero-copy">
          <span className="eyebrow"><span className="eyebrow-dot" /> TU SIGUIENTE NIVEL EMPIEZA AQUÍ</span>
          <h1>Más fuerte.<br /><span>Más tú.</span></h1>
          <p>Un espacio para entrenar a tu manera, encontrar tu ritmo y sentirte mejor cada día.</p>
          <button className="button button-primary hero-button" onClick={() => setPortalPage('plans')}>Encuentra tu plan <ArrowRight size={17} /></button>
          <div className="hero-meta"><span><BadgeCheck size={16} /> Entrenamiento para todos</span><span><Activity size={16} /> Comunidad que inspira</span></div>
        </div>
        <div className="hero-visual">
          <div className="hero-photo">
            <img src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1400&q=85" alt="Interior de un gimnasio moderno" />
            <div className="hero-photo-shade" />
            <div className="photo-caption"><span className="photo-icon"><Dumbbell size={18} /></span><span><strong>Un lugar para crecer</strong><small>Tu progreso, a tu ritmo.</small></span></div>
          </div>
          <div className="hero-sticker"><strong>01</strong><span>Hazlo<br />por ti.</span></div>
        </div>
      </section>

      <section className="portal-section">
        <div className="section-heading">
          <div><span className="eyebrow muted">TU GIMNASIO, A TU RITMO</span><h2>¿Qué quieres hacer hoy?</h2></div>
          <div className="portal-tabs">
            {([
              ['plans', 'Planes'],
              ['membership', 'Mi membresía'],
              ['classes', 'Clases'],
              ['payments', 'Mis pagos'],
            ] as Array<[PortalPage, string]>).map(([id, label]) => <button key={id} className={portalPage === id ? 'selected' : ''} onClick={() => setPortalPage(id)}>{label}</button>)}
          </div>
        </div>

        {portalPage === 'plans' && <>
          <div className="plan-grid">
            {PLAN_OPTIONS.map(plan => <article key={plan.name} className={`plan-card ${plan.featured ? 'featured' : ''}`}>
              {plan.featured && <span className="plan-ribbon">EL MÁS ELEGIDO</span>}
              <span className="plan-duration">{plan.duration}</span>
              <h3>{plan.name}</h3>
              <p>{plan.description}</p>
              <div className="plan-price">{money(plan.price)}<small> / {plan.days === 1 ? 'día' : `${plan.days} días`}</small></div>
              <ul>{plan.benefits.map(benefit => <li key={benefit}><Check size={16} />{benefit}</li>)}</ul>
              <button className={`button ${plan.featured ? 'button-primary' : 'button-secondary'}`} onClick={() => setSelectedPlan(plan)}>Elegir plan <ArrowRight size={16} /></button>
            </article>)}
          </div>
          <div className="trust-strip"><span><ShieldCheck size={18} /> Pago verificado por recepción</span><span><Clock3 size={18} /> Respuesta en horario de atención</span><span><Wallet size={18} /> Transferencia o billetera digital</span></div>
        </>}

        {portalPage === 'membership' && <div className="panel portal-panel">
          <div className="panel-intro"><span className="eyebrow muted">ACCESO DE SOCIOS</span><h2>Consulta tu membresía</h2><p>Ingresa el DNI registrado en tu membresía para consultar tu estado y credencial QR.</p></div>
          <form className="search-form" onSubmit={event => { event.preventDefault(); lookupMembership(); }}>
            <label className="field-with-icon"><IdCard size={19} /><input value={lookupDni} onChange={event => setLookupDni(event.target.value)} inputMode="numeric" minLength={8} maxLength={12} placeholder="Tu número de DNI" /></label>
            <button className="button button-primary">Consultar <ArrowRight size={16} /></button>
          </form>
          {membershipResult !== undefined && <div className="result-card">
            {membershipResult ? <div className="membership-result">
              <div className="member-details">
                <Badge tone={isMemberActive(membershipResult) ? 'green' : 'red'}>{isMemberActive(membershipResult) ? 'MEMBRESÍA ACTIVA' : 'MEMBRESÍA VENCIDA'}</Badge>
                <h3>{membershipResult.name}</h3>
                <div className="detail-grid">
                  <span><small>Plan</small><strong>{membershipResult.plan}</strong></span>
                  <span><small>Inicio</small><strong>{formatDate(membershipResult.start)}</strong></span>
                  <span><small>Vencimiento</small><strong>{formatDate(membershipResult.end)}</strong></span>
                </div>
                {data.payments.some(payment => payment.dni === membershipResult.dni) && <div className="small-payment-list"><strong>Movimientos de pago</strong>{data.payments.filter(payment => payment.dni === membershipResult.dni).map(payment => <span key={payment.id}>{payment.plan} · {payment.status} {payment.note && `· ${payment.note}`}</span>)}</div>}
              </div>
              {isMemberActive(membershipResult) && <div className="qr-card"><img src={memberQr} alt="Código QR de la membresía" /><small>Muéstralo en recepción</small></div>}
            </div> : <div className="empty-state"><Search size={22} /><strong>No encontramos una membresía</strong><span>Revisa el DNI o envía una solicitud de membresía.</span></div>}
          </div>}
        </div>}

        {portalPage === 'classes' && <div className="class-grid">
          {getUpcomingClasses().map(session => {
            const booked = data.bookings.filter(booking => booking.className === session.name && booking.date === session.date).length;
            return <article className="class-card" key={`${session.name}-${session.date}`}>
              <div className="class-icon"><IconForClass name={session.icon} /></div><Badge>{session.level}</Badge>
              <h3>{session.name}</h3><p>{session.coach}</p>
              <div className="class-meta"><span><CalendarDays size={15} />{formatDate(session.date)}</span><span><Clock3 size={15} />{session.time}</span></div>
              <div className="seats"><span>{Math.max(0, 12 - booked)} lugares disponibles</span><span className="seat-track"><i style={{ width: `${Math.min(100, booked / 12 * 100)}%` }} /></span></div>
              <button className="button button-secondary" disabled={booked >= 12} onClick={() => setBookingClass(session)}>{booked >= 12 ? 'Clase completa' : 'Reservar lugar'}</button>
            </article>;
          })}
          <div className="panel booking-lookup">
            <div><span className="eyebrow muted">TUS RESERVAS</span><h3>Próximas clases</h3></div>
            <form className="search-form" onSubmit={event => { event.preventDefault(); if (!/^\d{8,12}$/.test(bookingDni)) notify('Ingresa un DNI válido.', 'error'); }}>
              <input value={bookingDni} onChange={event => setBookingDni(event.target.value)} inputMode="numeric" minLength={8} maxLength={12} placeholder="Consulta con tu DNI" />
              <button className="button button-secondary">Ver reservas</button>
            </form>
            {bookingDni && <div className="booking-list">{data.bookings.filter(booking => booking.dni === bookingDni && booking.date >= today()).map(booking => <div key={booking.id}><span><strong>{booking.className}</strong><small>{formatDate(booking.date)} · {booking.time}</small></span><button className="text-button danger-text" onClick={() => cancelBooking(booking.id)}>Cancelar</button></div>)}</div>}
          </div>
        </div>}

        {portalPage === 'payments' && <div className="panel portal-panel">
          <div className="panel-intro"><span className="eyebrow muted">ESTADO DE CUENTA</span><h2>Historial de pagos</h2><p>Consulta comprobantes, validaciones y observaciones de recepción.</p></div>
          <form className="search-form" onSubmit={event => { event.preventDefault(); if (!/^\d{8,12}$/.test(paymentDni)) notify('Ingresa un DNI válido.', 'error'); }}>
            <label className="field-with-icon"><IdCard size={19} /><input value={paymentDni} onChange={event => setPaymentDni(event.target.value)} inputMode="numeric" minLength={8} maxLength={12} placeholder="Tu número de DNI" /></label>
            <button className="button button-primary">Consultar pagos</button>
          </form>
          {paymentDni && <div className="payment-history-list">{data.payments.filter(payment => payment.dni === paymentDni).map(payment => <PaymentCard key={payment.id} payment={payment} />)}</div>}
        </div>}
      </section>
    </main> : <div className="owner-layout">
      <aside className={`owner-sidebar ${mobileNav ? 'open' : ''}`}>
        <div className="sidebar-label">ADMINISTRACIÓN</div>
        <nav className="owner-nav">
          {navItems.filter(item => isAdmin || !item.adminOnly).map(item => <button key={item.id} className={ownerPage === item.id ? 'active' : ''} onClick={() => switchOwnerPage(item.id)}>
            {item.icon}<span>{item.label}</span>{item.id === 'payments' && pendingPayments.length > 0 && <b className="nav-count">{pendingPayments.length}</b>}
          </button>)}
        </nav>
        <div className="sidebar-footer"><div className="avatar">{(activeUser?.fullname ?? 'JG').slice(0, 2).toLocaleUpperCase()}</div><span><strong>{activeUser?.fullname ?? 'Equipo'}</strong><small>{isAdmin ? 'Administrador' : 'Recepción'}</small></span><button title="Cerrar sesión" aria-label="Cerrar sesión" onClick={signOut}><LogOut size={16} /></button></div>
      </aside>
      {mobileNav && <button aria-label="Cerrar menú" className="sidebar-scrim" onClick={() => setMobileNav(false)} />}
      <main className="owner-main">
        <div className="owner-toolbar">
          <button className="menu-toggle" onClick={() => setMobileNav(value => !value)}><Menu size={20} /></button>
          <label className="global-search"><Search size={17} /><input value={globalSearch} onChange={event => setGlobalSearch(event.target.value)} placeholder="Buscar socio o producto..." onKeyDown={event => {
            if (event.key !== 'Enter' || !globalSearch.trim()) return;
            if (data.members.some(member => `${member.name} ${member.dni} ${member.phone}`.toLowerCase().includes(globalSearch.toLowerCase()))) { switchOwnerPage('members'); setMemberSearch(globalSearch); }
            else { switchOwnerPage('inventory'); setInventorySearch(globalSearch); }
          }} /></label>
          <span className="today-date"><CalendarDays size={15} />{new Date().toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
        </div>

        {ownerPage === 'dashboard' && <section className="owner-content">
          <PageHeading eyebrow="VISTA GENERAL" title="Resumen del gimnasio" description="Un vistazo a la actividad y las operaciones de Joe's Gym Calca." action={<button className="button button-primary" onClick={() => { setEditingMember(null); setMemberSearch(''); switchOwnerPage('members'); setTimeout(() => document.getElementById('new-member')?.click(), 0); }}><UserRoundPlus size={17} /> Nuevo socio</button>} />
          <div className="kpi-grid">
            <KpiCard icon={<CircleDollarSign size={19} />} label="Ingresos registrados" value={money(totalRevenue)} caption="Histórico de ventas" color="gold" />
            <KpiCard icon={<Users size={19} />} label="Socios activos" value={String(activeMembersCount)} caption={`${data.members.length} en el padrón`} color="blue" />
            <KpiCard icon={<Clock3 size={19} />} label="Por vencer" value={String(data.members.filter(member => member.status === 'Por Vencer' && member.end >= today()).length)} caption="Requieren seguimiento" color="amber" />
            <KpiCard icon={<Package size={19} />} label="Stock bajo" value={String(lowStockCount)} caption="Productos por reponer" color="red" />
          </div>
          <div className="owner-columns">
            <section className="panel table-panel">
              <PanelTitle title="Actividad reciente" subtitle="Últimos movimientos registrados" action={<button className="text-button" onClick={exportTransactions}>Descargar CSV <ArrowDownToLine size={15} /></button>} />
              <TransactionsTable transactions={data.transactions.slice(0, 8)} />
            </section>
            <section className="panel attention-panel">
              <PanelTitle title="Requieren atención" subtitle="Pendientes de gestión" />
              <button className="attention-row" onClick={() => switchOwnerPage('payments')}><span className="attention-icon amber"><FileCheck2 size={18} /></span><span><strong>Comprobantes por validar</strong><small>Revisa los pagos recibidos</small></span><b>{pendingPayments.length}</b></button>
              <button className="attention-row" onClick={() => switchOwnerPage('inventory')}><span className="attention-icon red"><Package size={18} /></span><span><strong>Productos con stock bajo</strong><small>Reabastece antes de vender</small></span><b>{lowStockCount}</b></button>
              <button className="attention-row" onClick={() => switchOwnerPage('members')}><span className="attention-icon blue"><Users size={18} /></span><span><strong>Membresías por vencer</strong><small>Ofrece una renovación a tiempo</small></span><b>{data.members.filter(member => member.status === 'Por Vencer').length}</b></button>
            </section>
          </div>
        </section>}

        {ownerPage === 'members' && <section className="owner-content">
          <PageHeading eyebrow="RELACIONES CON SOCIOS" title="Socios" description="Administra perfiles, membresías y renovaciones." action={<><button className="button button-secondary" onClick={exportMembers}><ArrowDownToLine size={16} /> Exportar</button><button id="new-member" className="button button-primary" onClick={() => setEditingMember({ id: 0, name: '', dni: '', phone: '', plan: 'Plan Mensual', start: today(), end: '', status: 'Activo' })}><Plus size={17} /> Nuevo socio</button></>} />
          <section className="panel table-panel">
            <div className="filter-toolbar">
              <label className="global-search table-search"><Search size={17} /><input value={memberSearch} onChange={event => setMemberSearch(event.target.value)} placeholder="Nombre, DNI, teléfono o plan" /></label>
              <div className="filter-pills"><Filter size={15} />{['Todos', 'Activos', 'Por vencer', 'Vencidos'].map(filter => <button key={filter} className={memberFilter === filter ? 'selected' : ''} onClick={() => setMemberFilter(filter)}>{filter}</button>)}</div>
              <span className="result-count">{filteredMembers.length} socios</span>
            </div>
            <div className="table-scroll"><table><thead><tr><th>Socio</th><th>DNI / Teléfono</th><th>Plan</th><th>Vencimiento</th><th>Estado</th><th className="align-right">Acciones</th></tr></thead><tbody>
              {filteredMembers.map(member => <tr key={member.id}>
                <td><div className="member-cell"><span className="avatar soft">{member.name.slice(0, 1)}</span><strong>{member.name}</strong></div></td>
                <td><span className="stack-cell">{member.dni || 'Sin DNI'}<small>{member.phone}</small></span></td>
                <td>{member.plan}</td><td>{formatDate(member.end)}</td><td><MemberBadge member={member} /></td>
                <td className="align-right"><IconButton label="Editar socio" onClick={() => setEditingMember(member)}><Pencil size={16} /></IconButton><IconButton label="Eliminar socio" danger onClick={() => removeMember(member)}><Trash2 size={16} /></IconButton></td>
              </tr>)}
              {!filteredMembers.length && <EmptyTable colSpan={6} text="No encontramos socios con esos filtros." />}
            </tbody></table></div>
          </section>
        </section>}

        {ownerPage === 'inventory' && <section className="owner-content">
          <PageHeading eyebrow="PRODUCTOS Y REABASTECIMIENTO" title="Inventario" description="Controla existencias, costos y precios de venta." action={<><button className="button button-secondary" onClick={exportInventory}><ArrowDownToLine size={16} /> Exportar</button><button className="button button-primary" onClick={() => setEditingProduct({ id: 0, name: '', category: CATEGORIES[1], cost: 0, price: 0, stock: 0, min: 0 })}><Plus size={17} /> Agregar producto</button></>} />
          <section className="panel table-panel">
            <div className="filter-toolbar inventory-filters">
              <label className="global-search table-search"><Search size={17} /><input value={inventorySearch} onChange={event => setInventorySearch(event.target.value)} placeholder="Buscar productos..." /></label>
              <select value={category} onChange={event => setCategory(event.target.value)}>{CATEGORIES.map(option => <option key={option}>{option}</option>)}</select>
              <label className="checkbox-filter"><input type="checkbox" checked={lowStock} onChange={event => setLowStock(event.target.checked)} /> Solo stock bajo</label>
              <span className="result-count">{filteredProducts.length} productos</span>
            </div>
            <div className="table-scroll"><table><thead><tr><th>Producto</th><th>Categoría</th><th>Costo</th><th>Precio</th><th>Stock</th><th>Mínimo</th><th className="align-right">Acciones</th></tr></thead><tbody>
              {filteredProducts.map(product => <tr key={product.id}>
                <td><strong>{product.name}</strong></td><td className="subtle-cell">{product.category}</td><td>{money(product.cost)}</td><td className="price-cell">{money(product.price)}</td><td><Badge tone={product.stock <= product.min ? 'red' : 'green'}>{product.stock <= product.min ? `Bajo · ${product.stock}` : product.stock}</Badge></td><td>{product.min}</td>
                <td className="align-right"><IconButton label="Editar producto" onClick={() => setEditingProduct(product)}><Pencil size={16} /></IconButton><IconButton label="Eliminar producto" danger onClick={() => removeProduct(product)}><Trash2 size={16} /></IconButton></td>
              </tr>)}
              {!filteredProducts.length && <EmptyTable colSpan={7} text="No hay productos que coincidan con la búsqueda." />}
            </tbody></table></div>
          </section>
          <section className="panel table-panel movement-panel"><PanelTitle title="Movimientos recientes" subtitle="Entradas y salidas de almacén" action={<button className="text-button" onClick={exportStockMovements}>Exportar CSV <ArrowDownToLine size={15} /></button>} />
            <div className="table-scroll"><table><thead><tr><th>Fecha</th><th>Producto</th><th>Movimiento</th><th>Cantidad</th><th>Responsable</th></tr></thead><tbody>{data.stockMovements.slice(0, 8).map(move => <tr key={move.id}><td>{move.date}</td><td>{move.product}</td><td>{move.type}</td><td className={move.quantity > 0 ? 'positive' : 'negative'}>{move.quantity > 0 ? '+' : ''}{move.quantity}</td><td>{move.user}</td></tr>)}{!data.stockMovements.length && <EmptyTable colSpan={5} text="Los movimientos se mostrarán aquí." />}</tbody></table></div>
          </section>
        </section>}

        {ownerPage === 'payments' && <section className="owner-content">
          <PageHeading eyebrow="VALIDACIÓN DE COMPROBANTES" title="Pagos web" description="Revisa comprobantes y aprueba o rechaza solicitudes." action={<button className="button button-secondary" onClick={exportPayments}><ArrowDownToLine size={16} /> Exportar historial</button>} />
          <div className="kpi-grid compact"><KpiCard icon={<Clock3 size={18} />} label="Por revisar" value={String(pendingPayments.length)} caption="Solicitudes pendientes" color="amber" /><KpiCard icon={<CheckCircle2 size={18} />} label="Aprobados" value={String(data.payments.filter(payment => payment.status === 'Aprobado').length)} caption="Membresías activadas" color="green" /><KpiCard icon={<X size={18} />} label="Rechazados" value={String(data.payments.filter(payment => payment.status === 'Rechazado').length)} caption="Con observación para el socio" color="red" /></div>
          <section className="panel table-panel"><PanelTitle title="Solicitudes pendientes" subtitle="Comprueba los datos antes de validar el pago." />
            <div className="table-scroll"><table><thead><tr><th>Socio</th><th>Plan</th><th>Operación</th><th>Comprobante</th><th>Monto</th><th className="align-right">Acciones</th></tr></thead><tbody>{pendingPayments.map(payment => <tr key={payment.id}>
              <td><span className="stack-cell"><strong>{payment.name}</strong><small>DNI {payment.dni} · {payment.phone}</small></span></td><td>{payment.plan}</td><td>{payment.voucher}</td><td>{payment.voucherFile ? <button className="text-button" onClick={() => setVoucherPreview(payment.voucherFile!)}>{payment.voucherFileName || 'Ver archivo'} <ArrowRight size={14} /></button> : <span className="subtle-cell">Sin archivo adjunto</span>}</td><td className="price-cell">{money(payment.price)}</td>
              <td className="align-right action-pair"><button className="button button-small button-approve" onClick={() => approvePayment(payment)}><Check size={15} /> Aprobar</button><button className="button button-small button-reject" onClick={() => setRejectingPayment(payment)}>Rechazar</button></td>
            </tr>)}{!pendingPayments.length && <EmptyTable colSpan={6} text="Todo al día. No tienes comprobantes pendientes." />}</tbody></table></div>
          </section>
          <section className="panel table-panel"><PanelTitle title="Historial de validaciones" subtitle="El socio puede consultar la observación desde su portal." />
            <div className="table-scroll"><table><thead><tr><th>Socio / DNI</th><th>Plan</th><th>Fecha de revisión</th><th>Estado</th><th>Observación</th></tr></thead><tbody>{data.payments.filter(payment => payment.status !== 'Pendiente').map(payment => <tr key={payment.id}><td><span className="stack-cell"><strong>{payment.name}</strong><small>{payment.dni}</small></span></td><td>{payment.plan}</td><td>{payment.reviewedAt || payment.date}</td><td><PaymentBadge status={payment.status} /></td><td className="subtle-cell">{payment.note}</td></tr>)}{!data.payments.some(payment => payment.status !== 'Pendiente') && <EmptyTable colSpan={5} text="Aún no se han revisado solicitudes." />}</tbody></table></div>
          </section>
        </section>}

        {ownerPage === 'classes' && <section className="owner-content">
          <PageHeading eyebrow="COMUNIDAD Y ENTRENAMIENTO" title="Clases y reservas" description="Consulta las inscripciones a las próximas clases grupales." />
          <section className="panel table-panel"><div className="filter-toolbar"><label className="global-search table-search"><Search size={17} /><input value={classNameSearch} onChange={event => setClassNameSearch(event.target.value)} placeholder="Buscar socio, DNI o clase..." /></label><span className="result-count">{data.bookings.length} reservas</span></div>
            <div className="table-scroll"><table><thead><tr><th>Socio</th><th>Clase</th><th>Fecha y hora</th><th>Estado</th><th className="align-right">Acciones</th></tr></thead><tbody>{data.bookings.filter(booking => `${booking.name} ${booking.dni} ${booking.className}`.toLowerCase().includes(classNameSearch.toLowerCase())).sort((a, b) => a.date.localeCompare(b.date)).map(booking => <tr key={booking.id}><td><span className="stack-cell"><strong>{booking.name}</strong><small>DNI {booking.dni}</small></span></td><td>{booking.className}</td><td>{formatDate(booking.date)} · {booking.time}</td><td><Badge tone="green">{booking.status}</Badge></td><td className="align-right"><button className="text-button danger-text" onClick={() => cancelBooking(booking.id)}>Cancelar</button></td></tr>)}{!data.bookings.length && <EmptyTable colSpan={5} text="Todavía no hay reservas." />}</tbody></table></div>
          </section>
        </section>}

        {ownerPage === 'pos' && <section className="owner-content">
          <PageHeading eyebrow="VENTA EN MOSTRADOR" title="Punto de venta" description="Agrega productos al ticket y registra el cobro." />
          <div className="pos-layout"><section className="panel pos-products"><div className="filter-toolbar"><label className="global-search table-search"><Search size={17} /><input value={inventorySearch} onChange={event => setInventorySearch(event.target.value)} placeholder="Buscar en el inventario" /></label></div><div className="pos-product-grid">{data.inventory.filter(product => `${product.name} ${product.category}`.toLowerCase().includes(inventorySearch.toLowerCase())).map(product => <button key={product.id} className="pos-product-card" onClick={() => addToCart(product)} disabled={product.stock === 0}><span className="pos-product-icon"><ShoppingBag size={18} /></span><strong>{product.name}</strong><small>{product.stock} disponibles</small><b>{money(product.price)}</b></button>)}</div></section>
            <section className="panel cart-panel"><PanelTitle title="Ticket de venta" subtitle={`${cart.reduce((sum, line) => sum + line.quantity, 0)} artículos`} /><div className="cart-lines">{cart.map(line => { const product = data.inventory.find(item => item.id === line.id); return product ? <div className="cart-line" key={line.id}><span><strong>{product.name}</strong><small>{money(product.price)} por unidad</small></span><div className="quantity-stepper"><button onClick={() => setCart(current => current.flatMap(item => item.id !== line.id ? [item] : item.quantity > 1 ? [{ ...item, quantity: item.quantity - 1 }] : []))}>−</button><b>{line.quantity}</b><button onClick={() => addToCart(product)}>+</button></div><strong>{money(product.price * line.quantity)}</strong></div> : null; })}{!cart.length && <div className="empty-state"><ShoppingCart size={24} /><span>El ticket está vacío.</span></div>}</div><label className="input-label">Método de pago<select value={paymentMethod} onChange={event => setPaymentMethod(event.target.value)}><option>Efectivo</option><option>Transferencia</option><option>Tarjeta</option><option>Yape / Plin</option></select></label><div className="cart-total"><span>Total</span><strong>{money(cart.reduce((sum, line) => sum + (data.inventory.find(product => product.id === line.id)?.price ?? 0) * line.quantity, 0))}</strong></div><button className="button button-primary full-width" onClick={checkout} disabled={!cart.length}>Cobrar venta <ArrowRight size={16} /></button></section>
          </div>
        </section>}

        {ownerPage === 'checkin' && <section className="owner-content checkin-view">
          <PageHeading eyebrow="BIENVENIDA Y ACCESO" title="Control de acceso" description="Busca al socio por nombre, DNI o teléfono; también puedes escanear su credencial QR." />
          <label className="global-search checkin-search"><ScanLine size={20} /><input autoFocus value={checkinSearch} onChange={event => setCheckinSearch(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { const qr = checkinSearch.trim().match(/^IRONFIT-MEMBER:(\d+)$/i); const member = data.members.find(item => qr ? String(item.id) === qr[1] : `${item.name} ${item.dni} ${item.phone}`.toLowerCase().includes(checkinSearch.toLowerCase())); if (member) recordCheckin(member); else notify('No encontramos una membresía asociada.', 'error'); } }} placeholder="Nombre, DNI, teléfono o contenido del QR..." /></label>
          <div className="checkin-results">{data.members.filter(member => checkinSearch && `${member.name} ${member.dni} ${member.phone}`.toLowerCase().includes(checkinSearch.toLowerCase())).slice(0, 8).map(member => <article className="checkin-card" key={member.id}><span className="avatar soft">{member.name[0]}</span><span><strong>{member.name}</strong><small>{member.plan} · Vence {formatDate(member.end)}</small></span><MemberBadge member={member} /><button className="button button-primary button-small" disabled={!isMemberActive(member)} onClick={() => recordCheckin(member)}><Check size={15} /> Registrar acceso</button></article>)}</div>
        </section>}

        {ownerPage === 'team' && <section className="owner-content">
          <PageHeading eyebrow="PERMISOS DEL PERSONAL" title="Equipo" description="Gestiona las cuentas que pueden acceder al panel." />
          <section className="panel table-panel"><PanelTitle title="Usuarios registrados" subtitle="Los permisos se aplican dentro de esta interfaz." action={<button className="button button-primary button-small" onClick={() => setEditingUser({ id: 0, fullname: '', username: '', role: 'staff', status: 'Activo' })}><Plus size={15} /> Agregar usuario</button>} />
            <div className="table-scroll"><table><thead><tr><th>Nombre</th><th>Usuario</th><th>Rol</th><th>Estado</th><th className="align-right">Acciones</th></tr></thead><tbody>{data.users.map(user => <tr key={user.id}><td>{user.fullname}</td><td>@{user.username}</td><td>{user.role === 'admin' ? 'Administrador' : 'Recepción'}</td><td><Badge tone={user.status === 'Activo' ? 'green' : 'neutral'}>{user.status}</Badge></td><td className="align-right"><IconButton label="Editar usuario" onClick={() => setEditingUser(user)}><Pencil size={16} /></IconButton><IconButton label="Eliminar usuario" danger onClick={() => removeUser(user)}><Trash2 size={16} /></IconButton></td></tr>)}</tbody></table></div>
          </section>
          <p className="security-note"><ShieldCheck size={17} /> Las contraseñas se guardan como hash en este navegador, pero el panel y sus datos siguen siendo locales. La autenticación y los permisos deben validarse en un servidor antes de usarlo con información real.</p>
        </section>}
      </main>
    </div>}

    <footer className="footer"><span>JOE'S GYM CALCA</span><span>ENTRENA A TU MANERA</span></footer>

    {loginOpen && <Modal title={needsOwnerSetup ? 'Configura el acceso del dueño' : 'Acceso del personal'} onClose={() => setLoginOpen(false)}>
      <p className="modal-subtitle">{needsOwnerSetup ? 'Crea la contraseña inicial para proteger el acceso al panel.' : 'Selecciona tu cuenta e ingresa tus credenciales para abrir el panel de gestión.'}</p>
      <form className="form-grid login-form" onSubmit={submitStaffLogin}>
        <label className="input-label full-span">Personal
          <select value={loginUserId ?? ''} onChange={event => {
            const id = Number(event.target.value);
            setLoginUserId(id);
            setLoginUsername(data.users.find(user => user.id === id)?.username ?? '');
            setLoginPassword('');
            setLoginConfirmation('');
            setLoginError('');
          }} required>
            <option value="" disabled>Selecciona una cuenta</option>
            {data.users.filter(user => user.status === 'Activo').map(user => <option key={user.id} value={user.id}>{user.fullname} · {user.role === 'admin' ? 'Administrador' : 'Recepción'}</option>)}
          </select>
        </label>
        <label className="input-label full-span">Usuario
          <input value={loginUsername} onChange={event => setLoginUsername(event.target.value)} autoComplete="username" required maxLength={40} />
        </label>
        <label className="input-label full-span">{needsOwnerSetup ? 'Crear contraseña' : 'Contraseña'}
          <input type="password" value={loginPassword} onChange={event => setLoginPassword(event.target.value)} autoComplete={needsOwnerSetup ? 'new-password' : 'current-password'} required minLength={8} maxLength={128} />
        </label>
        {needsOwnerSetup && <label className="input-label full-span">Confirmar contraseña
          <input type="password" value={loginConfirmation} onChange={event => setLoginConfirmation(event.target.value)} autoComplete="new-password" required minLength={8} maxLength={128} />
        </label>}
        {loginError && <p className="auth-error full-span" role="alert">{loginError}</p>}
        <div className="form-actions full-span">
          <button type="button" className="button button-secondary" onClick={() => setLoginOpen(false)}>Cancelar</button>
          <button className="button button-primary" disabled={loginBusy || !loginAccount}>{loginBusy ? 'Verificando…' : needsOwnerSetup ? 'Crear acceso' : 'Ingresar'}</button>
        </div>
      </form>
      <p className="login-security-note"><ShieldCheck size={15} /> Esta versión local guarda el acceso en este navegador. Para proteger el panel en producción se requiere autenticación en un servidor.</p>
    </Modal>}

    {selectedPlan && <Modal title={`Solicitar ${selectedPlan.name}`} onClose={() => setSelectedPlan(null)}>
      <div className="checkout-summary"><span>{selectedPlan.duration} · {selectedPlan.name}</span><strong>{money(selectedPlan.price)}</strong></div>
      <div className="payment-instructions"><strong>Transfiere y adjunta tu comprobante</strong><span>Cuenta de ejemplo · Yape / Plin · Consulta los datos oficiales en recepción.</span></div>
      <form className="form-grid" onSubmit={submitPlanRequest}>
        <label className="input-label">Nombre completo<input name="name" required maxLength={100} /></label>
        <label className="input-label">DNI<input name="dni" required inputMode="numeric" minLength={8} maxLength={12} pattern="[0-9]{8,12}" /></label>
        <label className="input-label">Teléfono / WhatsApp<input name="phone" required maxLength={30} /></label>
        <label className="input-label">Número de operación<input name="operation" required maxLength={60} /></label>
        <label className="input-label full-span">Comprobante (PNG, JPG, WEBP o PDF; máx. 600 KB)<input name="proof" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" required /></label>
        <div className="form-actions full-span"><button type="button" className="button button-secondary" onClick={() => setSelectedPlan(null)}>Cancelar</button><button className="button button-primary">Enviar solicitud <ArrowRight size={16} /></button></div>
      </form>
    </Modal>}

    {editingMember && <Modal title={editingMember.id ? 'Editar socio' : 'Agregar socio'} onClose={() => setEditingMember(null)}>
      <form className="form-grid" onSubmit={saveMemberForm}>
        <label className="input-label full-span">Nombre completo<input name="name" required defaultValue={editingMember.name} maxLength={100} /></label>
        <label className="input-label">DNI<input name="dni" inputMode="numeric" minLength={8} maxLength={12} pattern="[0-9]{8,12}" defaultValue={editingMember.dni} /></label>
        <label className="input-label">Teléfono<input name="phone" required defaultValue={editingMember.phone} maxLength={30} /></label>
        <label className="input-label">Plan<select name="plan" defaultValue={editingMember.plan}>{PLAN_OPTIONS.map(plan => <option key={plan.name}>{plan.name}</option>)}</select></label>
        <label className="input-label">Inicio<input name="start" type="date" required defaultValue={editingMember.start} /></label>
        <label className="input-label full-span">Estado<select name="status" defaultValue={editingMember.status}><option>Activo</option><option>Por Vencer</option><option>Vencido</option></select></label>
        <div className="form-actions full-span"><button type="button" className="button button-secondary" onClick={() => setEditingMember(null)}>Cancelar</button><button className="button button-primary">Guardar socio</button></div>
      </form>
    </Modal>}

    {editingProduct && <Modal title={editingProduct.id ? 'Editar producto' : 'Agregar producto'} onClose={() => setEditingProduct(null)}>
      <form className="form-grid" onSubmit={saveProductForm}>
        <label className="input-label full-span">Nombre<input name="name" required defaultValue={editingProduct.name} maxLength={100} /></label>
        <label className="input-label full-span">Categoría<select name="category" defaultValue={editingProduct.category}>{CATEGORIES.slice(1).map(option => <option key={option}>{option}</option>)}</select></label>
        <label className="input-label">Stock actual<input name="stock" type="number" min="0" step="1" required defaultValue={editingProduct.stock} /></label>
        <label className="input-label">Stock mínimo<input name="min" type="number" min="0" step="1" required defaultValue={editingProduct.min} /></label>
        <label className="input-label">Costo<input name="cost" type="number" min="0" step="0.01" required defaultValue={editingProduct.cost} /></label>
        <label className="input-label">Precio de venta<input name="price" type="number" min="0" step="0.01" required defaultValue={editingProduct.price} /></label>
        <div className="form-actions full-span"><button type="button" className="button button-secondary" onClick={() => setEditingProduct(null)}>Cancelar</button><button className="button button-primary">Guardar producto</button></div>
      </form>
    </Modal>}

    {editingUser && <Modal title={editingUser.id ? 'Editar usuario' : 'Agregar usuario'} onClose={() => setEditingUser(null)}>
      <form className="form-grid" onSubmit={saveUser}>
        <input type="hidden" name="id" value={editingUser.id || ''} />
        <label className="input-label full-span">Nombre completo<input name="fullname" required defaultValue={editingUser.fullname} maxLength={100} /></label>
        <label className="input-label full-span">Nombre de usuario<input name="username" required defaultValue={editingUser.username} maxLength={40} /></label>
        <label className="input-label full-span">{editingUser.id ? 'Nueva contraseña (opcional)' : 'Contraseña inicial'}
          <input name="password" type="password" required={!editingUser.id} minLength={8} maxLength={128} autoComplete="new-password" />
          {editingUser.id && <small className="field-hint">Déjala vacía para conservar la contraseña actual; mínimo 8 caracteres para cambiarla.</small>}
        </label>
        <label className="input-label">Rol<select name="role" defaultValue={editingUser.role}><option value="staff">Recepción</option><option value="admin">Administrador</option></select></label>
        <label className="input-label">Estado<select name="status" defaultValue={editingUser.status}><option>Activo</option><option>Inactivo</option></select></label>
        <div className="form-actions full-span"><button type="button" className="button button-secondary" onClick={() => setEditingUser(null)}>Cancelar</button><button className="button button-primary">Guardar usuario</button></div>
      </form>
    </Modal>}

    {rejectingPayment && <Modal title="Rechazar comprobante" onClose={() => setRejectingPayment(null)}>
      <p className="modal-subtitle">El motivo quedará visible para <strong>{rejectingPayment.name}</strong> en su historial.</p>
      <form className="form-grid" onSubmit={rejectPayment}><label className="input-label full-span">Motivo del rechazo<textarea name="note" required minLength={5} maxLength={240} rows={4} placeholder="Indica qué dato del pago debe corregirse." /></label><div className="form-actions full-span"><button type="button" className="button button-secondary" onClick={() => setRejectingPayment(null)}>Cancelar</button><button className="button button-danger">Confirmar rechazo</button></div></form>
    </Modal>}

    {bookingClass && <Modal title="Reservar una clase" onClose={() => setBookingClass(null)}>
      <div className="checkout-summary"><span>{bookingClass.name}<small>{formatDate(bookingClass.date)} · {bookingClass.time}</small></span><Badge tone="green">{12 - data.bookings.filter(item => item.date === bookingClass.date && item.className === bookingClass.name).length} cupos</Badge></div>
      <form className="form-grid" onSubmit={requestBooking}><label className="input-label full-span">DNI asociado a tu membresía<input name="dni" required inputMode="numeric" minLength={8} maxLength={12} pattern="[0-9]{8,12}" defaultValue={bookingDni} /></label><div className="form-actions full-span"><button type="button" className="button button-secondary" onClick={() => setBookingClass(null)}>Cancelar</button><button className="button button-primary">Confirmar reserva</button></div></form>
    </Modal>}

    {voucherPreview && <Modal title="Comprobante de pago" onClose={() => { URL.revokeObjectURL(voucherPreview); setVoucherPreview(null); }} wide><iframe className="voucher-frame" title="Vista previa del comprobante" src={voucherPreview} /></Modal>}
    <div className="toast-stack" aria-live="polite">{toasts.map(toast => <div className={`toast ${toast.kind}`} key={toast.id}>{toast.kind === 'success' ? <CheckCircle2 size={18} /> : <X size={18} />}{toast.message}</div>)}</div>
  </div>;
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-heading"><div><span className="eyebrow muted">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action && <div className="heading-actions">{action}</div>}</div>;
}

function PanelTitle({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) {
  return <div className="panel-title"><span><strong>{title}</strong><small>{subtitle}</small></span>{action}</div>;
}

function KpiCard({ icon, label, value, caption, color }: { icon: ReactNode; label: string; value: string; caption: string; color: string }) {
  return <article className="kpi-card"><div className={`kpi-icon ${color}`}>{icon}</div><span className="kpi-label">{label}</span><strong className="kpi-value">{value}</strong><small>{caption}</small></article>;
}

function EmptyTable({ colSpan, text }: { colSpan: number; text: string }) {
  return <tr><td colSpan={colSpan} className="empty-table">{text}</td></tr>;
}

function MemberBadge({ member }: { member: Member }) {
  const status = member.end < today() ? 'Vencido' : member.status;
  return <Badge tone={status === 'Activo' ? 'green' : status === 'Por Vencer' ? 'amber' : 'red'}>{status}</Badge>;
}

function PaymentBadge({ status }: { status: Payment['status'] }) {
  return <Badge tone={status === 'Aprobado' ? 'green' : status === 'Pendiente' ? 'amber' : 'red'}>{status}</Badge>;
}

function PaymentCard({ payment }: { payment: Payment }) {
  return <article className="payment-history-card"><div><strong>{payment.plan} · {money(payment.price)}</strong><small>{payment.date}</small><span>{payment.note}</span></div><PaymentBadge status={payment.status} /></article>;
}

function TransactionsTable({ transactions }: { transactions: AppData['transactions'] }) {
  return <div className="table-scroll"><table><thead><tr><th>Fecha</th><th>Concepto</th><th>Responsable</th><th>Método</th><th className="align-right">Total</th></tr></thead><tbody>{transactions.map(transaction => <tr key={transaction.id}><td><span className="stack-cell">{formatDate(transaction.date)}<small>{transaction.time}</small></span></td><td>{transaction.concept}</td><td>{transaction.staff}</td><td><Badge>{transaction.method}</Badge></td><td className="align-right price-cell">{money(transaction.total)}</td></tr>)}</tbody></table></div>;
}
