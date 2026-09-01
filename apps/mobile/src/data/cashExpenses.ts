import { Ionicons } from '@expo/vector-icons';

export type ExpenseIcon = keyof typeof Ionicons.glyphMap;

export type ExpenseStatus = 'paid' | 'pending';

export interface ExpenseDetail {
  id: string;
  name: string;
  amount: number;
  icon: ExpenseIcon;
  period: string;
  supplier: string;
  invoiceNumber: string;
  status: ExpenseStatus;
  paymentMethod: string;
  paymentDate: string;
  description: string;
}

// TODO(M3): monthly cash-box expenses from the billing API.
export const CASH_EXPENSES: ExpenseDetail[] = [
  {
    id: 'e1',
    name: 'Ток',
    amount: 850,
    icon: 'flash-outline',
    period: 'Март 2026',
    supplier: 'ЧЕЗ Разпределение България',
    invoiceNumber: '№ 2026-03-0142',
    status: 'paid',
    paymentMethod: 'Банков превод',
    paymentDate: '05.03.2026',
    description:
      'Разходът покрива електрозахранването на общите части — стълбища, асансьори, паркинг и външно осветление.',
  },
  {
    id: 'e2',
    name: 'Вода',
    amount: 420,
    icon: 'water-outline',
    period: 'Март 2026',
    supplier: 'Софийска вода',
    invoiceNumber: '№ 2026-03-0208',
    status: 'paid',
    paymentMethod: 'Директен дебит',
    paymentDate: '07.03.2026',
    description:
      'Водоснабдяване и отвеждане на отпадни води за общите части на сградата.',
  },
  {
    id: 'e3',
    name: 'Асансьор',
    amount: 1200,
    icon: 'swap-vertical-outline',
    period: 'Март 2026',
    supplier: 'Schindler България',
    invoiceNumber: '№ 2026-03-0311',
    status: 'paid',
    paymentMethod: 'Банков превод',
    paymentDate: '03.03.2026',
    description:
      'Месечна абонаментна поддръжка и авариен сервиз на асансьорите във всички входове.',
  },
  {
    id: 'e4',
    name: 'Почистване',
    amount: 980,
    icon: 'sparkles-outline',
    period: 'Март 2026',
    supplier: 'CleanPro ООД',
    invoiceNumber: '№ 2026-03-0415',
    status: 'paid',
    paymentMethod: 'Банков превод',
    paymentDate: '02.03.2026',
    description:
      'Ежедневно почистване на стълбища, фоайета и периодично на подземния паркинг.',
  },
  {
    id: 'e5',
    name: 'Охрана',
    amount: 1500,
    icon: 'shield-checkmark-outline',
    period: 'Март 2026',
    supplier: 'Сигурност Груп',
    invoiceNumber: '№ 2026-03-0501',
    status: 'paid',
    paymentMethod: 'Банков превод',
    paymentDate: '01.03.2026',
    description:
      '24-часова охрана и видеонаблюдение на входовете и общия паркинг.',
  },
  {
    id: 'e6',
    name: 'Ремонти',
    amount: 740,
    icon: 'construct-outline',
    period: 'Март 2026',
    supplier: 'BuildFix ЕООД',
    invoiceNumber: '№ 2026-03-0622',
    status: 'pending',
    paymentMethod: '—',
    paymentDate: '—',
    description:
      'Текущи ремонти по общи части — врати, осветление и дребни строителни дейности.',
  },
  {
    id: 'e7',
    name: 'Озеленяване',
    amount: 320,
    icon: 'leaf-outline',
    period: 'Март 2026',
    supplier: 'Green Yard',
    invoiceNumber: '№ 2026-03-0719',
    status: 'paid',
    paymentMethod: 'Карта',
    paymentDate: '10.03.2026',
    description:
      'Поддръжка на зелените площи около сградата и сезонно засаждане.',
  },
  {
    id: 'e8',
    name: 'Интернет',
    amount: 180,
    icon: 'wifi-outline',
    period: 'Март 2026',
    supplier: 'Vivacom',
    invoiceNumber: '№ 2026-03-0804',
    status: 'paid',
    paymentMethod: 'Директен дебит',
    paymentDate: '04.03.2026',
    description:
      'Интернет връзка за домофонната система и камерите за видеонаблюдение.',
  },
  {
    id: 'e9',
    name: 'Снегопочистване',
    amount: 80,
    icon: 'snow-outline',
    period: 'Март 2026',
    supplier: 'WinterCare',
    invoiceNumber: '№ 2026-03-0912',
    status: 'paid',
    paymentMethod: 'Банков превод',
    paymentDate: '12.03.2026',
    description:
      'Еднократно снегопочистване на входовете и алеите след снеговалеж.',
  },
];

export function formatEuro(value: number) {
  return `${value.toLocaleString('bg-BG')} €`;
}

export function getExpenseById(id: string) {
  return CASH_EXPENSES.find((item) => item.id === id);
}
