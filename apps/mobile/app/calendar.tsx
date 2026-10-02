import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppBackground } from '../src/components/AppBackground';
import { GlassCircleButton } from '../src/components/GlassCircleButton';
import { GlassView } from '../src/components/GlassView';
import { PressableScale } from '../src/components/PressableScale';
import { metrics, rs } from '../src/theme/responsive';
import { glass, palette, radius } from '../src/theme/tokens';

type Category = 'payments' | 'cleaning' | 'maintenance' | 'other';
type Filter = 'all' | Category;
type IconName = keyof typeof Ionicons.glyphMap;

interface CalendarEvent {
  id: string;
  date: string;
  category: Category;
  title: string;
  time: string;
  icon: IconName;
}

const MONTHS = [
  'Януари',
  'Февруари',
  'Март',
  'Април',
  'Май',
  'Юни',
  'Юли',
  'Август',
  'Септември',
  'Октомври',
  'Ноември',
  'Декември',
] as const;

const MONTHS_LOWER = MONTHS.map((name) => name.toLowerCase());
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'] as const;
const WEEKDAYS_LONG = [
  'понеделник',
  'вторник',
  'сряда',
  'четвъртък',
  'петък',
  'събота',
  'неделя',
] as const;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Всички' },
  { key: 'payments', label: 'Плащания' },
  { key: 'cleaning', label: 'Чистота' },
  { key: 'maintenance', label: 'Поддръжка' },
  { key: 'other', label: 'Други' },
];

const CATEGORY_LABEL: Record<Category, string> = {
  payments: 'Плащания',
  cleaning: 'Чистота',
  maintenance: 'Поддръжка',
  other: 'Други',
};

// TODO(M3+): events come from charges, payments, issues and notices.
const MOCK = {
  building: 'Резиденция Оборище',
  address: 'ул. Оборище 12, София',
  events: [
    {
      id: 'e1',
      date: '2026-03-04',
      category: 'cleaning',
      title: 'Почистване на входа',
      time: '08:00 - 09:00 ч.',
      icon: 'sparkles-outline',
    },
    {
      id: 'e2',
      date: '2026-03-10',
      category: 'payments',
      title: 'Плащане на такса',
      time: '09:00 - 10:00 ч.',
      icon: 'wallet-outline',
    },
    {
      id: 'e3',
      date: '2026-03-11',
      category: 'payments',
      title: 'Краен срок за март',
      time: '18:00 ч.',
      icon: 'card-outline',
    },
    {
      id: 'e4',
      date: '2026-03-18',
      category: 'maintenance',
      title: 'Профилактика на асансьора',
      time: '10:00 - 12:00 ч.',
      icon: 'construct-outline',
    },
    {
      id: 'e5',
      date: '2026-03-21',
      category: 'other',
      title: 'Среща с домоуправителя',
      time: '17:30 ч.',
      icon: 'people-outline',
    },
    {
      id: 'e6',
      date: '2026-03-24',
      category: 'cleaning',
      title: 'Измиване на стълбището',
      time: '09:00 ч.',
      icon: 'sparkles-outline',
    },
    {
      id: 'e7',
      date: '2026-03-25',
      category: 'payments',
      title: 'Отчет на касата',
      time: '11:00 ч.',
      icon: 'calculator-outline',
    },
    {
      id: 'e8',
      date: '2026-03-28',
      category: 'maintenance',
      title: 'Смяна на осветление',
      time: '14:00 - 15:00 ч.',
      icon: 'construct-outline',
    },
    {
      id: 'e9',
      date: '2026-03-31',
      category: 'other',
      title: 'Общо събрание',
      time: '19:00 ч.',
      icon: 'megaphone-outline',
    },
  ] satisfies CalendarEvent[],
};

const INITIAL = new Date(2026, 2, 10);

function dateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function sameDay(a: Date, b: Date): boolean {
  return dateKey(a) === dateKey(b);
}

/** Monday-first grid of this month only. Leading blanks keep the 1st on the right weekday. */
function monthCells(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= days; day += 1) cells.push(new Date(year, month, day));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function weekdayLong(date: Date): string {
  return WEEKDAYS_LONG[(date.getDay() + 6) % 7];
}

export default function CalendarScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState({
    year: INITIAL.getFullYear(),
    month: INITIAL.getMonth(),
  });
  const [selected, setSelected] = useState(INITIAL);
  const [filter, setFilter] = useState<Filter>('all');

  const cells = useMemo(
    () => monthCells(visible.year, visible.month),
    [visible.month, visible.year],
  );

  const visibleEvents = useMemo(
    () => MOCK.events.filter((event) => filter === 'all' || event.category === filter),
    [filter],
  );

  const marked = useMemo(() => {
    const keys = new Set<string>();
    for (const event of visibleEvents) keys.add(event.date);
    return keys;
  }, [visibleEvents]);

  const dayEvents = visibleEvents.filter((event) => event.date === dateKey(selected));

  const shiftMonth = (delta: number) => {
    const next = new Date(visible.year, visible.month + delta, 1);
    setVisible({ year: next.getFullYear(), month: next.getMonth() });
    setSelected(next);
  };

  return (
    <View style={styles.container}>
      <AppBackground variant="blur" />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: insets.top + rs(12, 8),
            paddingBottom: insets.bottom + rs(28, 20),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Назад"
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={rs(28, 25)} color={glass.textPrimary} />
          </Pressable>
          <GlassCircleButton
            icon="ellipsis-horizontal"
            onPress={() => router.push('/menu')}
            accessibilityLabel="Отвори менюто"
          />
        </View>

        <Animated.View entering={FadeInDown.duration(400).delay(40)} style={styles.titleBlock}>
          <Text style={styles.title}>Календар</Text>
          <Text style={styles.building}>{MOCK.building}</Text>
          <Text style={styles.address}>{MOCK.address}</Text>
        </Animated.View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          {FILTERS.map((item) => {
            const active = filter === item.key;
            return (
              <PressableScale
                key={item.key}
                haptic={false}
                onPress={() => setFilter(item.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={item.label}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                  {item.label}
                </Text>
              </PressableScale>
            );
          })}
        </ScrollView>

        <Animated.View entering={FadeInDown.duration(420).delay(80)}>
          <GlassView contentStyle={styles.calendarCard}>
            <View style={styles.monthRow}>
              <PressableScale
                haptic={false}
                onPress={() => shiftMonth(-1)}
                accessibilityRole="button"
                accessibilityLabel="Предишен месец"
                style={styles.monthButton}
              >
                <Ionicons name="chevron-back" size={rs(24, 22)} color={glass.textPrimary} />
              </PressableScale>
              <Text style={styles.monthLabel}>
                {MONTHS[visible.month]} {visible.year}
              </Text>
              <PressableScale
                haptic={false}
                onPress={() => shiftMonth(1)}
                accessibilityRole="button"
                accessibilityLabel="Следващ месец"
                style={styles.monthButton}
              >
                <Ionicons name="chevron-forward" size={rs(24, 22)} color={glass.textPrimary} />
              </PressableScale>
            </View>

            <View style={styles.weekRow}>
              {WEEKDAYS.map((day) => (
                <Text key={day} style={styles.weekday}>
                  {day}
                </Text>
              ))}
            </View>

            <View style={styles.dayGrid}>
              {Array.from({ length: cells.length / 7 }, (_, week) => (
                <View key={week} style={styles.weekRow}>
                  {cells.slice(week * 7, week * 7 + 7).map((date, index) => {
                    if (!date)
                      return <View key={`empty-${week}-${index}`} style={styles.dayCell} />;
                    const key = dateKey(date);
                    const isSelected = sameDay(date, selected);
                    const hasEvent = marked.has(key);
                    return (
                      <PressableScale
                        key={key}
                        haptic={false}
                        onPress={() => setSelected(date)}
                        accessibilityRole="button"
                        accessibilityLabel={`${date.getDate()} ${MONTHS_LOWER[date.getMonth()]}`}
                        accessibilityState={{ selected: isSelected }}
                        style={styles.dayCell}
                      >
                        <View style={[styles.dayCircle, isSelected && styles.dayCircleSelected]}>
                          <Text style={[styles.dayNumber, isSelected && styles.dayNumberSelected]}>
                            {date.getDate()}
                          </Text>
                        </View>
                        <View style={[styles.dot, hasEvent ? styles.dotOn : styles.dotOff]} />
                      </PressableScale>
                    );
                  })}
                </View>
              ))}
            </View>
          </GlassView>
        </Animated.View>

        <View style={styles.detailsHeader}>
          <Text style={styles.detailsTitle}>Детайли за деня</Text>
          <Text style={styles.detailsDate}>
            {selected.getDate()} {MONTHS_LOWER[selected.getMonth()]}, {weekdayLong(selected)}
          </Text>
        </View>

        {dayEvents.length === 0 ? (
          <GlassView contentStyle={styles.emptyCard}>
            <Text style={styles.emptyText}>Няма събития за този ден.</Text>
          </GlassView>
        ) : (
          dayEvents.map((event) => (
            <GlassView key={event.id} contentStyle={styles.eventCard}>
              <View style={styles.eventIcon}>
                <Ionicons name={event.icon} size={rs(22, 20)} color={glass.textPrimary} />
              </View>
              <View style={styles.eventBody}>
                <View style={styles.eventTag}>
                  <Text style={styles.eventTagText}>{CATEGORY_LABEL[event.category]}</Text>
                </View>
                <Text style={styles.eventTitle}>{event.title}</Text>
                <Text style={styles.eventTime}>{event.time}</Text>
              </View>
              <Ionicons name="chevron-forward" size={rs(18, 16)} color={glass.textSecondary} />
            </GlassView>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const DAY = rs(44, 38);

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    paddingHorizontal: metrics.screenPadding,
    gap: rs(12, 10),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    paddingVertical: rs(4, 3),
  },
  titleBlock: {
    gap: rs(4, 3),
  },
  title: {
    fontSize: rs(32, 28),
    lineHeight: rs(36, 32),
    fontWeight: '800',
    letterSpacing: -0.4,
    color: glass.textPrimary,
  },
  building: {
    marginTop: rs(2, 1),
    fontSize: rs(16, 15),
    fontWeight: '700',
    color: glass.textPrimary,
  },
  address: {
    fontSize: rs(14, 13),
    color: glass.textSecondary,
  },
  filters: {
    gap: rs(8, 6),
    paddingRight: metrics.screenPadding,
  },
  chip: {
    height: rs(34, 30),
    paddingHorizontal: rs(12, 10),
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: glass.fill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glass.stroke,
  },
  chipActive: {
    backgroundColor: palette.goldBlack,
    borderColor: palette.goldBlack,
    ...Platform.select({
      ios: {
        shadowColor: palette.goldBlack,
        shadowOpacity: 0.25,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 3 },
    }),
  },
  chipLabel: {
    fontSize: rs(14, 13),
    fontWeight: '600',
    color: glass.textPrimary,
  },
  chipLabelActive: {
    color: palette.white,
  },
  calendarCard: {
    paddingVertical: rs(16, 12),
    paddingHorizontal: rs(8, 6),
    gap: rs(10, 8),
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: rs(4, 2),
  },
  monthButton: {
    width: rs(44, 40),
    height: rs(44, 40),
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    fontSize: rs(22, 19),
    fontWeight: '700',
    color: glass.textPrimary,
  },
  weekRow: {
    flexDirection: 'row',
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: rs(14, 13),
    fontWeight: '600',
    color: glass.textMuted,
  },
  dayGrid: {
    gap: rs(6, 4),
  },
  dayCell: {
    flex: 1,
    height: rs(56, 50),
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircle: {
    width: DAY,
    height: DAY,
    borderRadius: DAY / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleSelected: {
    backgroundColor: palette.white,
    ...Platform.select({
      ios: {
        shadowColor: palette.white,
        shadowOpacity: 0.45,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 0 },
      },
      android: { elevation: 4 },
    }),
  },
  dayNumber: {
    fontSize: rs(18, 16),
    fontWeight: '600',
    color: glass.textPrimary,
  },
  dayNumberSelected: {
    color: palette.goldBlack,
    fontWeight: '700',
  },
  dot: {
    marginTop: rs(4, 3),
    width: rs(5, 4),
    height: rs(5, 4),
    borderRadius: 99,
  },
  dotOn: {
    backgroundColor: palette.white,
  },
  dotOff: {
    backgroundColor: 'transparent',
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: rs(8, 6),
  },
  detailsTitle: {
    fontSize: rs(18, 16),
    fontWeight: '700',
    color: glass.textPrimary,
  },
  detailsDate: {
    flexShrink: 1,
    fontSize: rs(13, 12),
    color: glass.textSecondary,
    textAlign: 'right',
  },
  emptyCard: {
    paddingVertical: rs(18, 14),
    paddingHorizontal: rs(16, 14),
  },
  emptyText: {
    fontSize: metrics.bodySize,
    color: glass.textSecondary,
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(12, 10),
    paddingVertical: rs(14, 12),
    paddingHorizontal: rs(14, 12),
  },
  eventIcon: {
    width: rs(42, 38),
    height: rs(42, 38),
    borderRadius: rs(14, 12),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: glass.fillStrong,
  },
  eventBody: {
    flex: 1,
    gap: rs(3, 2),
  },
  eventTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: rs(8, 6),
    paddingVertical: rs(2, 1),
    borderRadius: radius.pill,
    backgroundColor: glass.fillStrong,
  },
  eventTagText: {
    fontSize: rs(11, 10),
    fontWeight: '600',
    color: glass.textSecondary,
  },
  eventTitle: {
    fontSize: rs(16, 15),
    fontWeight: '700',
    color: glass.textPrimary,
  },
  eventTime: {
    fontSize: rs(13, 12),
    color: glass.textSecondary,
  },
});
