/**
 * The rights in Bulgarian words (WHI-40): a user never reads a permission key.
 *
 * The names of the rights for later milestones are the ones drawn in Роли
 * (Figma 1091:10390). The seven that exist in M1 are not drawn; their names
 * and areas were approved by the stakeholder in WHI-91 on 29.09.
 */
const LABELS: Record<string, string> = {
  // M1
  'tenant.read': 'Преглед на организацията',
  'tenant.manage': 'Настройки на организацията',
  'staff.read': 'Преглед на служителите',
  'staff.manage': 'Покани и управление на служители',
  'roles.read': 'Преглед на ролите',
  'roles.manage': 'Роли и права',
  'audit.read': 'Одитен дневник',
  // Later milestones, as drawn
  'property.read': 'Преглед на сгради и имоти',
  'property.removal.request': 'Заявка за премахване на имот или жител',
  'residents.read': 'Преглед на жителите',
  'billing.read': 'Преглед на входни такси и задължения',
  'billing.write': 'Начисляване и корекции',
  'payments.record': 'Въвеждане на плащане',
  'issues.read': 'Преглед на сигнали',
  'issues.manage': 'Обработка на сигнали',
  'notifications.send': 'Изпращане на известия',
  'surveys.propose': 'Предлагане на анкета',
  'surveys.approve': 'Одобряване на анкета',
  'surveys.create': 'Създаване на анкета',
  'tasks.read': 'Преглед на задачите',
  'tasks.manage': 'Създаване и отмятане на задачи',
  'documents.upload': 'Качване на документи',
  'reports.read': 'Преглед на отчети',
  'reports.export': 'Експорт на отчети',
};

/**
 * The catalogue's areas in the drawn order, and the key prefixes each holds.
 * Служители and Одит are not drawn; they stand before Настройки.
 */
const GROUPS: { title: string; prefixes: string[] }[] = [
  { title: 'Имоти', prefixes: ['property'] },
  { title: 'Жители', prefixes: ['residents'] },
  { title: 'Финанси', prefixes: ['billing', 'payments'] },
  { title: 'Сигнали', prefixes: ['issues'] },
  { title: 'Комуникация', prefixes: ['notifications'] },
  { title: 'Анкети', prefixes: ['surveys'] },
  { title: 'Задачи', prefixes: ['tasks'] },
  { title: 'Документи', prefixes: ['documents'] },
  { title: 'Отчети', prefixes: ['reports'] },
  { title: 'Служители', prefixes: ['staff'] },
  { title: 'Настройки', prefixes: ['tenant', 'roles', 'settings'] },
  { title: 'Одит', prefixes: ['audit'] },
];

/**
 * A right's name. A key the platform adds before this list knows it shows
 * its server description rather than the code.
 */
export function permissionLabel(key: string, description?: string): string {
  return LABELS[key] ?? description ?? key;
}

/** The catalogue in areas, each right in its area's drawn order. */
export function groupPermissions<T extends { key: string }>(
  catalog: T[],
): { title: string; items: T[] }[] {
  const order = Object.keys(LABELS);
  const rank = (key: string) => (order.includes(key) ? order.indexOf(key) : order.length);
  const other: T[] = [];
  const groups = GROUPS.map(({ title }) => ({ title, items: [] as T[] }));
  for (const permission of catalog) {
    const prefix = permission.key.split('.')[0]!;
    const index = GROUPS.findIndex((group) => group.prefixes.includes(prefix));
    (index === -1 ? other : groups[index]!.items).push(permission);
  }
  if (other.length) groups.push({ title: 'Други', items: other });
  return groups
    .filter((group) => group.items.length > 0)
    .map((group) => ({ ...group, items: group.items.sort((a, b) => rank(a.key) - rank(b.key)) }));
}

/** A role's rights in the catalogue's order, so every card reads alike. */
export function sortPermissions(keys: string[]): string[] {
  const order = groupPermissions(keys.map((key) => ({ key }))).flatMap((g) => g.items);
  return order.map((p) => p.key);
}
