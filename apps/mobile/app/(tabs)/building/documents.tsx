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

// TODO(M2): building documents — protocols, contracts, reports from the property API.
const MOCK = {
  building: 'Резиденция Оборище',
  address: 'ул. Оборище 12, София',
  documents: [
    {
      id: 'd1',
      label: 'Устав на етажната собственост',
      category: 'ЕС',
    },
    {
      id: 'd2',
      label: 'Правилник за вътрешния ред',
      category: 'сграда',
    },
    {
      id: 'd3',
      label: 'Договор за поддръжка на асансьор',
      category: 'договори',
    },
    {
      id: 'd4',
      label: 'Протокол от общо събрание – 15.04.2024',
      category: 'ЕС',
    },
    {
      id: 'd5',
      label: 'План за управление на сградата',
      category: 'сграда',
    },
    {
      id: 'd6',
      label: 'Договор за почистване на общи части',
      category: 'договори',
    },
    {
      id: 'd7',
      label: 'Застрахователна полица на сградата',
      category: 'други',
    },
    {
      id: 'd8',
      label: 'Протокол от общо събрание – 12.11.2023',
      category: 'ЕС',
    },
    {
      id: 'd9',
      label: 'Договор за охрана',
      category: 'договори',
    },
    {
      id: 'd10',
      label: 'Технически паспорт на сградата',
      category: 'сграда',
    },
  ],
};

const FILTERS = [
  { key: 'all', label: 'Всички' },
  { key: 'сграда', label: 'За сградата' },
  { key: 'договори', label: 'Договори' },
  { key: 'ЕС', label: 'Етажна собственост (ЕС)' },
  { key: 'други', label: 'Други' },
] as const;

type FilterKey = (typeof FILTERS)[number]['key'];

export default function Documents() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<FilterKey>('all');

  const wheelItems = useMemo<WheelItem[]>(
    () =>
      MOCK.documents
        .filter((d) => filter === 'all' || d.category === filter)
        .map((d) => ({ id: d.id, label: d.label })),
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
          <Text style={styles.title}>Документи на сградата</Text>
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
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
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
            icon="file-document-outline"
            showChevron
            cardWidth={rs(280, 240)}
            emptyText="Няма документи в тази категория"
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
    fontSize: rs(28, 24),
    fontWeight: '700',
    letterSpacing: -0.4,
    color: glass.textPrimary,
    marginBottom: rs(6, 4),
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
