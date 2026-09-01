import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApartmentWheel, type WheelItem } from '../../../src/components/ApartmentWheel';
import { AppBackground } from '../../../src/components/AppBackground';
import { GlassCircleButton } from '../../../src/components/GlassCircleButton';
import { PressableScale } from '../../../src/components/PressableScale';
import { metrics, rs } from '../../../src/theme/responsive';
import { glass, palette } from '../../../src/theme/tokens';

type HistoryCategory = 'payments' | 'expenses' | 'surveys' | 'signals' | 'assembly';

// TODO(M3+): building event timeline from charges, payments, issues, notices APIs.
const MOCK = {
  building: 'Резиденция Оборище',
  address: 'ул. Оборище 12, София',
  events: [
    {
      id: 'h1',
      label: 'Платена такса: месец',
      sub: '12.05.2024 · 14:32',
      category: 'payments' as HistoryCategory,
      icon: 'wallet-outline' as const,
    },
    {
      id: 'h2',
      label: 'Разход: асансьор',
      sub: '10.05.2024 · 09:15',
      category: 'expenses' as HistoryCategory,
      icon: 'currency-eur' as const,
    },
    {
      id: 'h3',
      label: 'Анкета: Озеленяване',
      sub: '08.05.2024 · 18:40',
      category: 'surveys' as HistoryCategory,
      icon: 'chart-bar' as const,
    },
    {
      id: 'h4',
      label: 'Сигнал: Осветление',
      sub: '05.05.2024 · 11:05',
      category: 'signals' as HistoryCategory,
      icon: 'alert-octagon-outline' as const,
    },
    {
      id: 'h5',
      label: 'Общо събрание',
      sub: '28.04.2024 · 19:00',
      category: 'assembly' as HistoryCategory,
      icon: 'account-group-outline' as const,
    },
    {
      id: 'h6',
      label: 'Платена такса: април',
      sub: '12.04.2024 · 10:22',
      category: 'payments' as HistoryCategory,
      icon: 'wallet-outline' as const,
    },
    {
      id: 'h7',
      label: 'Разход: почистване',
      sub: '03.04.2024 · 16:48',
      category: 'expenses' as HistoryCategory,
      icon: 'currency-eur' as const,
    },
    {
      id: 'h8',
      label: 'Сигнал: Паркинг',
      sub: '01.04.2024 · 08:12',
      category: 'signals' as HistoryCategory,
      icon: 'alert-octagon-outline' as const,
    },
    {
      id: 'h9',
      label: 'Анкета: Охрана',
      sub: '22.03.2024 · 12:30',
      category: 'surveys' as HistoryCategory,
      icon: 'chart-bar' as const,
    },
    {
      id: 'h10',
      label: 'Разход: ВиК',
      sub: '15.03.2024 · 13:05',
      category: 'expenses' as HistoryCategory,
      icon: 'currency-eur' as const,
    },
  ],
};

const FILTERS = [
  { key: 'all', label: 'Всички' },
  { key: 'payments', label: 'Мои плащания' },
  { key: 'expenses', label: 'Разходи' },
  { key: 'surveys', label: 'Анкети' },
  { key: 'signals', label: 'Сигнали' },
] as const;

type FilterKey = (typeof FILTERS)[number]['key'];

export default function History() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<FilterKey>('all');

  const wheelItems = useMemo<WheelItem[]>(
    () =>
      MOCK.events
        .filter((e) => filter === 'all' || e.category === filter)
        .map((e) => ({
          id: e.id,
          label: e.label,
          sub: e.sub,
          icon: e.icon,
        })),
    [filter],
  );

  return (
    <View style={styles.container}>
      <AppBackground variant="blur" />
      <View style={styles.darkScrim} pointerEvents="none" />

      <View style={[styles.content, { paddingTop: insets.top + rs(22, 16) }]}>
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
          <Text style={styles.title}>История</Text>
          <View style={styles.titleAccent} />
          <Text style={styles.building}>{MOCK.building}</Text>
          <Text style={styles.address}>{MOCK.address}</Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(430).delay(120)}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {FILTERS.map((f) => {
              const active = f.key === filter;
              return (
                <PressableScale
                  key={f.key}
                  haptic={false}
                  onPress={() => setFilter(f.key)}
                  accessibilityRole="button"
                  accessibilityLabel={`Филтър ${f.label}`}
                >
                  <View style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}>
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {f.label}
                    </Text>
                  </View>
                </PressableScale>
              );
            })}
          </ScrollView>
        </Animated.View>

        <Animated.View
          entering={FadeInUp.duration(450).delay(200)}
          style={[styles.wheelArea, { marginBottom: insets.bottom + rs(72, 62) }]}
        >
          <ApartmentWheel
            items={wheelItems}
            showChevron
            cardWidth={rs(260, 228)}
            emptyText="Няма събития в тази категория"
          />
        </Animated.View>
      </View>
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
  content: {
    flex: 1,
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
    gap: rs(4, 3),
  },
  title: {
    fontSize: rs(32, 28),
    fontWeight: '700',
    letterSpacing: -0.4,
    color: glass.textPrimary,
  },
  titleAccent: {
    width: rs(42, 36),
    height: 2,
    borderRadius: 1,
    backgroundColor: palette.orange,
    marginTop: rs(4, 3),
    marginBottom: rs(8, 6),
  },
  building: {
    fontSize: rs(17, 15),
    fontWeight: '600',
    color: glass.textPrimary,
  },
  address: {
    fontSize: rs(14, 13),
    color: glass.textSecondary,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: rs(10, 8),
    marginTop: rs(22, 16),
    paddingRight: metrics.screenPadding,
  },
  chip: {
    height: rs(42, 37),
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: rs(16, 13),
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipIdle: {
    backgroundColor: glass.fill,
    borderColor: glass.stroke,
  },
  chipActive: {
    backgroundColor: palette.goldBlack,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  chipText: {
    fontSize: rs(13, 12),
    fontWeight: '600',
    color: glass.textSecondary,
  },
  chipTextActive: {
    color: palette.white,
  },
  wheelArea: {
    flex: 1,
    marginTop: rs(14, 10),
    marginHorizontal: -metrics.screenPadding,
  },
});
