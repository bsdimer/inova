import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppBackground } from '../src/components/AppBackground';
import { ArrowBubble } from '../src/components/ArrowBubble';
import { GlassCircleButton } from '../src/components/GlassCircleButton';
import { GlassView } from '../src/components/GlassView';
import { PressableScale } from '../src/components/PressableScale';
import { metrics, rs } from '../src/theme/responsive';
import { glass, radius } from '../src/theme/tokens';

type ExpenseIcon = keyof typeof Ionicons.glyphMap;

// TODO(M3): monthly cash-box expenses from the billing API.
const MOCK = {
  building: 'Резиденция Оборище',
  address: 'ул. Оборище 12, София',
  expenses: [
    { id: 'e1', name: 'Ток', amount: 850, icon: 'flash-outline' as ExpenseIcon },
    { id: 'e2', name: 'Вода', amount: 420, icon: 'water-outline' as ExpenseIcon },
    { id: 'e3', name: 'Асансьор', amount: 1200, icon: 'swap-vertical-outline' as ExpenseIcon },
    { id: 'e4', name: 'Почистване', amount: 980, icon: 'sparkles-outline' as ExpenseIcon },
    { id: 'e5', name: 'Охрана', amount: 1500, icon: 'shield-checkmark-outline' as ExpenseIcon },
    { id: 'e6', name: 'Ремонти', amount: 740, icon: 'construct-outline' as ExpenseIcon },
    { id: 'e7', name: 'Озеленяване', amount: 320, icon: 'leaf-outline' as ExpenseIcon },
    { id: 'e8', name: 'Интернет', amount: 180, icon: 'wifi-outline' as ExpenseIcon },
    { id: 'e9', name: 'Снегопочистване', amount: 80, icon: 'snow-outline' as ExpenseIcon },
  ],
};

const MONTHS_BG = [
  'януари',
  'февруари',
  'март',
  'април',
  'май',
  'юни',
  'юли',
  'август',
  'септември',
  'октомври',
  'ноември',
  'декември',
] as const;

function formatEuro(value: number) {
  return `${value.toLocaleString('bg-BG')} €`;
}

function monthLabel(year: number, monthIndex: number) {
  return `${MONTHS_BG[monthIndex]} ${year}`;
}

export default function Cash() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Mock starts on March 2026 to match the design.
  const [cursor, setCursor] = useState({ year: 2026, month: 2 });

  const total = useMemo(
    () => MOCK.expenses.reduce((sum, item) => sum + item.amount, 0),
    [],
  );

  const label = monthLabel(cursor.year, cursor.month);

  const shiftMonth = (delta: number) => {
    setCursor((prev) => {
      const date = new Date(prev.year, prev.month + delta, 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });
  };

  return (
    <View style={styles.container}>
      <AppBackground variant="blur" />
      <View style={styles.darkScrim} pointerEvents="none" />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: insets.top + rs(18, 14),
            paddingBottom: insets.bottom + rs(36, 28),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(380)} style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Назад"
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={rs(26, 23)} color={glass.textPrimary} />
          </Pressable>
          <GlassCircleButton
            icon="ellipsis-horizontal"
            onPress={() => router.push('/menu')}
            accessibilityLabel="Отвори менюто"
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(420).delay(60)} style={styles.titleBlock}>
          <Text style={styles.title}>Месечни разходи</Text>
          <Text style={styles.building}>{MOCK.building}</Text>
          <Text style={styles.address}>{MOCK.address}</Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(430).delay(120)} style={styles.summary}>
          <Text style={styles.summaryLabel}>Общо за {label}</Text>
          <Text style={styles.summaryValue}>{formatEuro(total)}</Text>
          <View style={styles.monthRow}>
            <GlassCircleButton
              icon="chevron-back"
              size={rs(36, 32)}
              onPress={() => shiftMonth(-1)}
              accessibilityLabel="Предишен месец"
            />
            <Text style={styles.monthLabel}>{label}</Text>
            <GlassCircleButton
              icon="chevron-forward"
              size={rs(36, 32)}
              onPress={() => shiftMonth(1)}
              accessibilityLabel="Следващ месец"
            />
          </View>
        </Animated.View>

        <View style={styles.list}>
          {MOCK.expenses.map((item, i) => (
            <Animated.View key={item.id} entering={FadeInUp.duration(380).delay(160 + i * 40)}>
              <PressableScale
                haptic={false}
                onPress={() => undefined}
                accessibilityRole="button"
                accessibilityLabel={`${item.name}, ${formatEuro(item.amount)}`}
              >
                <GlassView
                  rounded={radius.pill}
                  intensity={50}
                  overlayColor="rgba(255,255,255,0.1)"
                  borderColor="rgba(255,255,255,0.35)"
                  contentStyle={styles.row}
                >
                  <Ionicons name={item.icon} size={rs(20, 18)} color={glass.textPrimary} />
                  <Text style={styles.rowLabel} numberOfLines={1}>
                    {item.name} — {formatEuro(item.amount)}
                  </Text>
                  <ArrowBubble size={rs(28, 26)} />
                </GlassView>
              </PressableScale>
            </Animated.View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  darkScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(24,20,17,0.45)',
  },
  scroll: {
    paddingHorizontal: metrics.screenPadding,
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
    marginTop: rs(16, 12),
    gap: rs(3, 2),
  },
  title: {
    fontSize: rs(30, 26),
    fontWeight: '700',
    letterSpacing: -0.4,
    color: glass.textPrimary,
    marginBottom: rs(6, 4),
  },
  building: {
    fontSize: rs(16, 14),
    fontWeight: '600',
    color: glass.textPrimary,
  },
  address: {
    fontSize: rs(14, 13),
    color: glass.textSecondary,
  },
  summary: {
    marginTop: rs(22, 18),
    marginBottom: rs(18, 14),
    gap: rs(4, 3),
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: rs(14, 13),
    color: glass.textSecondary,
    textAlign: 'center',
  },
  summaryValue: {
    fontSize: rs(36, 30),
    fontWeight: '800',
    letterSpacing: -0.5,
    color: glass.textPrimary,
    textAlign: 'center',
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: rs(14, 12),
    marginTop: rs(6, 4),
  },
  monthLabel: {
    fontSize: rs(15, 14),
    fontWeight: '500',
    color: glass.textSecondary,
    minWidth: rs(110, 100),
    textAlign: 'center',
  },
  list: {
    // Standard spacing — denser than the previous thick cards, not as
    // cramped as the design render.
    gap: rs(10, 8),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: rs(52, 48),
    paddingVertical: rs(10, 9),
    paddingLeft: rs(16, 14),
    paddingRight: rs(10, 9),
    gap: rs(12, 10),
  },
  rowLabel: {
    flex: 1,
    fontSize: rs(15, 14),
    fontWeight: '600',
    color: glass.textPrimary,
  },
});
