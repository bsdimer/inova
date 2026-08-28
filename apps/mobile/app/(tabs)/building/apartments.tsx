import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApartmentWheel, type WheelItem } from '../../../src/components/ApartmentWheel';
import { AppBackground } from '../../../src/components/AppBackground';
import { GlassCircleButton } from '../../../src/components/GlassCircleButton';
import { GlassView } from '../../../src/components/GlassView';
import { PressableScale } from '../../../src/components/PressableScale';
import { metrics, rs } from '../../../src/theme/responsive';
import { glass, palette, radius } from '../../../src/theme/tokens';

// TODO(M2/M3): building info and per-apartment obligation status come from the
// property/fees APIs.
const MOCK = {
  building: 'Резиденция Оборище',
  address: 'ул. Оборище 12, София',
  totalApartments: 180,
  withDebt: [
    { id: 'a1', label: 'АП. 1-А', entrance: 'А' },
    { id: 'a2', label: 'АП. 2-А', entrance: 'А' },
    { id: 'a3', label: 'АП. 3-Б', entrance: 'Б' },
    { id: 'a5', label: 'АП. 5-Б', entrance: 'Б' },
    { id: 'a7', label: 'АП. 7-В', entrance: 'В' },
    { id: 'a9', label: 'АП. 9-А', entrance: 'А' },
    { id: 'a11', label: 'АП. 11-А', entrance: 'А' },
    { id: 'a12', label: 'АП. 12-В', entrance: 'В' },
    { id: 'a14', label: 'АП. 14-Б', entrance: 'Б' },
    { id: 'a16', label: 'АП. 16-А', entrance: 'А' },
    { id: 'a18', label: 'АП. 18-Б', entrance: 'Б' },
    { id: 'a21', label: 'АП. 21-В', entrance: 'В' },
    { id: 'a24', label: 'АП. 24-А', entrance: 'А' },
    { id: 'a27', label: 'АП. 27-Б', entrance: 'Б' },
    { id: 'a30', label: 'АП. 30-В', entrance: 'В' },
  ],
  debtCount: 53,
};

const INFO_TEXT =
  'При неплатени входни такси за период от два месеца, системата автоматично подава ' +
  'информацията за просроченото задължение към адвокат за последващи действия.';

const FILTERS = ['Всички', 'Вход А', 'Вход Б', 'Вход В'] as const;
type Filter = (typeof FILTERS)[number];

export default function Apartments() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>('Всички');
  const [showInfo, setShowInfo] = useState(false);

  const wheelItems = useMemo<WheelItem[]>(
    () =>
      MOCK.withDebt
        .filter((a) => filter === 'Всички' || a.entrance === filter.slice(-1))
        .map((a) => ({ id: a.id, label: a.label, sub: 'Има задължения' })),
    [filter],
  );

  return (
    <View style={styles.container}>
      <AppBackground variant="blur" />
      {/* The mockup sits on a deeper, moodier glass — darken the shared blur. */}
      <View style={styles.darkScrim} pointerEvents="none" />

      <View style={[styles.content, { paddingTop: insets.top + rs(22, 16) }]}>
        <Animated.View entering={FadeInDown.duration(380)} style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Назад към сградата"
            >
              <Ionicons name="arrow-back" size={rs(26, 23)} color={glass.textPrimary} />
            </Pressable>
            <Text style={styles.title}>Апартаменти</Text>
          </View>
          <GlassCircleButton
            icon="ellipsis-horizontal"
            onPress={() => router.push('/menu')}
            accessibilityLabel="Отвори менюто"
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(420).delay(90)} style={styles.titleBlock}>
          <Text style={styles.building}>{MOCK.building}</Text>
          <Text style={styles.address}>{MOCK.address}</Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(430).delay(150)} style={styles.counterWrap}>
          <GlassView
            rounded={radius.lg}
            intensity={65}
            overlayColor="rgba(255,255,255,0.1)"
            borderColor="rgba(255,255,255,0.45)"
            contentStyle={styles.counterCard}
          >
            <View style={styles.counterTexts}>
              <Text style={styles.counterLabel}>Имат задължения</Text>
              <Text style={styles.counterValue}>
                {MOCK.debtCount}
                <Text style={styles.counterTotal}>/{MOCK.totalApartments}</Text>
              </Text>
            </View>
            <Pressable
              onPress={() => setShowInfo(true)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Информация за задълженията"
            >
              <Ionicons
                name="information-circle-outline"
                size={rs(26, 23)}
                color={glass.textSecondary}
              />
            </Pressable>
          </GlassView>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(430).delay(210)} style={styles.chipsRow}>
          {FILTERS.map((f) => {
            const active = f === filter;
            return (
              <PressableScale
                key={f}
                haptic={false}
                onPress={() => setFilter(f)}
                accessibilityRole="button"
                accessibilityLabel={`Филтър ${f}`}
                style={styles.chipWrap}
              >
                <View style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{f}</Text>
                </View>
              </PressableScale>
            );
          })}
        </Animated.View>

        <Animated.View
          entering={FadeInUp.duration(450).delay(280)}
          style={[styles.wheelArea, { marginBottom: insets.bottom + rs(72, 62) }]}
        >
          <ApartmentWheel items={wheelItems} />
        </Animated.View>
      </View>

      {showInfo && (
        <Animated.View
          entering={FadeIn.duration(220)}
          exiting={FadeOut.duration(180)}
          style={styles.modalBackdrop}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setShowInfo(false)}
            accessibilityLabel="Затвори"
          />
          <GlassView
            rounded={radius.lg}
            intensity={55}
            overlayColor="rgba(255,255,255,0.2)"
            style={styles.modalCard}
            contentStyle={styles.modalContent}
          >
            <Pressable
              onPress={() => setShowInfo(false)}
              hitSlop={10}
              style={styles.modalClose}
              accessibilityRole="button"
              accessibilityLabel="Затвори"
            >
              <Ionicons name="close" size={rs(20, 18)} color={glass.textSecondary} />
            </Pressable>
            <View style={styles.modalIcon}>
              <Text style={styles.modalIconText}>i</Text>
            </View>
            <Text style={styles.modalText}>{INFO_TEXT}</Text>
          </GlassView>
        </Animated.View>
      )}
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(12, 10),
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
  building: {
    fontSize: rs(17, 15),
    fontWeight: '600',
    color: glass.textPrimary,
  },
  address: {
    fontSize: rs(14, 13),
    color: glass.textSecondary,
  },
  counterWrap: {
    marginTop: rs(24, 18),
  },
  counterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: rs(12, 10),
    paddingHorizontal: rs(18, 15),
  },
  counterTexts: {
    gap: rs(2, 1),
  },
  counterLabel: {
    fontSize: rs(13, 12),
    color: glass.textSecondary,
  },
  counterValue: {
    fontSize: rs(28, 24),
    fontWeight: '800',
    letterSpacing: -0.4,
    color: glass.textPrimary,
  },
  counterTotal: {
    fontSize: rs(18, 16),
    fontWeight: '600',
    color: glass.textMuted,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: rs(10, 8),
    marginTop: rs(16, 12),
  },
  chipWrap: {
    flex: 1,
  },
  chip: {
    height: rs(42, 37),
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
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
    marginTop: rs(10, 8),
    // Bleed to the screen edge so the arc runs off the right side; the bottom
    // margin (set inline with insets) keeps the arc above the tab bar.
    marginHorizontal: -metrics.screenPadding,
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10,8,7,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: metrics.screenPadding,
  },
  modalCard: {
    width: '100%',
    maxWidth: rs(420, 360),
  },
  modalContent: {
    alignItems: 'center',
    paddingVertical: rs(30, 25),
    paddingHorizontal: rs(24, 20),
    gap: rs(18, 14),
  },
  modalClose: {
    position: 'absolute',
    top: rs(14, 12),
    right: rs(14, 12),
    zIndex: 1,
  },
  modalIcon: {
    width: rs(56, 48),
    height: rs(56, 48),
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalIconText: {
    fontSize: rs(26, 22),
    fontWeight: '600',
    fontStyle: 'italic',
    color: glass.textPrimary,
  },
  modalText: {
    fontSize: rs(15, 14),
    lineHeight: rs(23, 21),
    textAlign: 'center',
    color: glass.textPrimary,
  },
});
