import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, type Href } from 'expo-router';
import React, { useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { AppBackground } from '../src/components/AppBackground';
import { ArrowBubble } from '../src/components/ArrowBubble';
import { GlassCircleButton } from '../src/components/GlassCircleButton';
import { GlassView } from '../src/components/GlassView';
import { PressableScale } from '../src/components/PressableScale';
import { BrandLockup } from '../src/components/SosedoLogo';
import { metrics, rs } from '../src/theme/responsive';
import { glass, radius } from '../src/theme/tokens';

type IconName = keyof typeof Ionicons.glyphMap;

interface Slice {
  id: string;
  label: string;
  amount: number;
  pct: number;
  icon: IconName;
  color: string;
}

// TODO(M3): cashbox hub aggregates from the billing / property APIs.
const MOCK = {
  building: 'Резиденция Оборище',
  address: 'ул. Оборище 12, София',
  monthlyTotal: 6270,
  slices: [
    {
      id: 'utils',
      label: 'Ток и вода',
      amount: 2821,
      pct: 45,
      icon: 'flash-outline' as IconName,
      color: 'rgba(255,255,255,0.95)',
    },
    {
      id: 'clean',
      label: 'Почистване',
      amount: 1568,
      pct: 25,
      icon: 'sparkles-outline' as IconName,
      color: 'rgba(255,255,255,0.72)',
    },
    {
      id: 'repair',
      label: 'Ремонти',
      amount: 1254,
      pct: 20,
      icon: 'construct-outline' as IconName,
      color: 'rgba(255,255,255,0.5)',
    },
    {
      id: 'other',
      label: 'Други',
      amount: 627,
      pct: 10,
      icon: 'ellipsis-horizontal' as IconName,
      color: 'rgba(255,255,255,0.32)',
    },
  ] satisfies Slice[],
  deposit: { balance: 9100, goal: 15000 },
  unpaidCount: 8,
  feeBlurb: 'Разходите се разпределят спрямо идеалните части на всеки собственик в сградата.',
};

function formatEuro(value: number) {
  return `${value.toLocaleString('bg-BG')} €`;
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startDeg: number,
  endDeg: number,
) {
  const large = endDeg - startDeg > 180 ? 1 : 0;
  const so = polar(cx, cy, rOuter, startDeg);
  const eo = polar(cx, cy, rOuter, endDeg);
  const si = polar(cx, cy, rInner, endDeg);
  const ei = polar(cx, cy, rInner, startDeg);
  return [
    `M ${so.x} ${so.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${eo.x} ${eo.y}`,
    `L ${si.x} ${si.y}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${ei.x} ${ei.y}`,
    'Z',
  ].join(' ');
}

function ExpensesDonut({ total, slices, size }: { total: number; slices: Slice[]; size: number }) {
  // Extra room around the ring so the icon/percent callouts never clip.
  const pad = rs(48, 42);
  const box = size + pad * 2;
  const cx = box / 2;
  const cy = box / 2;
  const rOuter = size * 0.42;
  const rInner = size * 0.28;
  const gap = 3;

  let cursor = 0;
  const arcs = slices.map((slice) => {
    const sweep = (slice.pct / 100) * 360 - gap;
    const start = cursor + gap / 2;
    const end = start + Math.max(sweep, 0.5);
    cursor += (slice.pct / 100) * 360;
    return { ...slice, start, end, mid: (start + end) / 2 };
  });

  const bubble = rs(40, 36);
  const iconSize = rs(20, 18);
  const calloutR = rOuter + pad * 0.52;

  return (
    <View style={{ width: box, height: box, alignSelf: 'center' }}>
      <Svg width={box} height={box}>
        <Circle
          cx={cx}
          cy={cy}
          r={(rOuter + rInner) / 2}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={rOuter - rInner}
          fill="none"
        />
        <G>
          {arcs.map((a) => (
            <Path key={a.id} d={arcPath(cx, cy, rOuter, rInner, a.start, a.end)} fill={a.color} />
          ))}
        </G>
      </Svg>
      <View style={styles.donutCenter} pointerEvents="none">
        <Text style={styles.donutTotal}>{formatEuro(total)}</Text>
      </View>
      {arcs.map((a) => {
        const pos = polar(cx, cy, calloutR, a.mid);
        // Percent label sits on the side of the bubble that faces away
        // from the ring, so it never overlaps the slices.
        const onLeftHalf = a.mid > 180;
        return (
          <View
            key={`callout-${a.id}`}
            style={[
              styles.callout,
              {
                top: pos.y - bubble / 2,
                flexDirection: onLeftHalf ? 'row-reverse' : 'row',
                ...(onLeftHalf
                  ? { right: box - pos.x - bubble / 2 }
                  : { left: pos.x - bubble / 2 }),
              },
            ]}
            pointerEvents="none"
          >
            <View style={[styles.calloutBubbleShell, { width: bubble, height: bubble }]}>
              <View style={styles.calloutBubble}>
                <LinearGradient
                  colors={[
                    'rgba(255,255,255,0.38)',
                    'rgba(255,255,255,0.2)',
                    'rgba(255,255,255,0.14)',
                  ]}
                  locations={[0, 0.5, 1]}
                  start={{ x: 0.2, y: 0 }}
                  end={{ x: 0.8, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                {/* Soft bloom behind the glyph for the shiny glow. */}
                <Ionicons
                  name={a.icon}
                  size={iconSize + 2}
                  color="rgba(255,255,255,0.35)"
                  style={styles.calloutIconGlow}
                />
                <Ionicons
                  name={a.icon}
                  size={iconSize}
                  color="#FFFFFF"
                  style={styles.calloutIcon}
                />
              </View>
            </View>
            <Text style={styles.calloutPct}>{a.pct}%</Text>
          </View>
        );
      })}
    </View>
  );
}

export default function KasaHub() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const depositPct = useMemo(
    () => Math.round((MOCK.deposit.balance / MOCK.deposit.goal) * 100),
    [],
  );

  const go = (href: Href) => router.push(href);

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
        <Animated.View entering={FadeInDown.duration(360)} style={styles.headerRow}>
          <GlassCircleButton
            icon="arrow-back"
            size={rs(50, 46)}
            onPress={() => router.back()}
            accessibilityLabel="Назад"
          />
          <View style={styles.brandCenter} pointerEvents="none">
            <BrandLockup align="center" />
          </View>
          <GlassCircleButton
            icon="ellipsis-horizontal"
            size={rs(50, 46)}
            onPress={() => router.push('/menu')}
            accessibilityLabel="Отвори менюто"
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(420).delay(60)} style={styles.titleBlock}>
          <Text style={styles.title}>Каса</Text>
          <Text style={styles.building}>{MOCK.building}</Text>
          <Text style={styles.address}>{MOCK.address}</Text>
        </Animated.View>

        {/* Monthly expenses → /cash */}
        <Animated.View entering={FadeInUp.duration(420).delay(120)}>
          <PressableScale
            haptic={false}
            onPress={() => go('/cash')}
            accessibilityRole="button"
            accessibilityLabel="Месечни разходи"
          >
            <GlassView
              rounded={radius.lg}
              intensity={55}
              overlayColor="rgba(255,255,255,0.1)"
              borderColor="rgba(255,255,255,0.35)"
              contentStyle={styles.expensesCard}
            >
              <Text style={styles.cardTitle}>Месечни разходи</Text>
              <ExpensesDonut total={MOCK.monthlyTotal} slices={MOCK.slices} size={rs(220, 200)} />
              <View style={styles.breakdown}>
                {MOCK.slices.map((slice) => (
                  <View key={slice.id} style={styles.breakdownRow}>
                    <Ionicons name={slice.icon} size={rs(18, 16)} color={glass.textPrimary} />
                    <Text style={styles.breakdownLabel} numberOfLines={1}>
                      {slice.label}
                    </Text>
                    <Text style={styles.breakdownAmount}>{formatEuro(slice.amount)}</Text>
                    <Text style={styles.breakdownPct}>{slice.pct}%</Text>
                  </View>
                ))}
              </View>
              <View style={styles.cardArrow}>
                <ArrowBubble size={rs(34, 30)} />
              </View>
            </GlassView>
          </PressableScale>
        </Animated.View>

        {/* Deposit → /deposit */}
        <Animated.View entering={FadeInUp.duration(420).delay(180)} style={styles.section}>
          <PressableScale
            haptic={false}
            onPress={() => go('/deposit')}
            accessibilityRole="button"
            accessibilityLabel="Депозит"
          >
            <GlassView
              rounded={radius.lg}
              intensity={55}
              overlayColor="rgba(255,255,255,0.1)"
              borderColor="rgba(255,255,255,0.35)"
              contentStyle={styles.depositCard}
            >
              <View style={styles.depositTop}>
                <View style={styles.depositTexts}>
                  <Text style={styles.cardTitle}>Депозит</Text>
                  <Text style={styles.depositValue}>{formatEuro(MOCK.deposit.balance)}</Text>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${depositPct}%` }]} />
                  </View>
                  <Text style={styles.progressMeta}>
                    {depositPct}% от {formatEuro(MOCK.deposit.goal)} цел
                  </Text>
                </View>
                <ArrowBubble size={rs(34, 30)} />
              </View>
            </GlassView>
          </PressableScale>
        </Animated.View>

        {/* Fee explainer → /how-to-pay */}
        <Animated.View entering={FadeInUp.duration(420).delay(240)} style={styles.section}>
          <PressableScale
            haptic={false}
            onPress={() => go('/how-to-pay')}
            accessibilityRole="button"
            accessibilityLabel="Как се оформя таксата"
          >
            <GlassView
              rounded={radius.lg}
              intensity={55}
              overlayColor="rgba(255,255,255,0.1)"
              borderColor="rgba(255,255,255,0.35)"
              contentStyle={styles.feeCard}
            >
              <View style={styles.feeTexts}>
                <Text style={styles.cardTitle}>Как се оформя таксата</Text>
                <Text style={styles.feeBody}>{MOCK.feeBlurb}</Text>
              </View>
              <ArrowBubble size={rs(34, 30)} />
            </GlassView>
          </PressableScale>
        </Animated.View>

        {/* Unpaid apartments → apartments wheel */}
        <Animated.View entering={FadeInUp.duration(420).delay(300)} style={styles.section}>
          <PressableScale
            haptic={false}
            onPress={() => go('/building/apartments')}
            accessibilityRole="button"
            accessibilityLabel="Неплатени задължения"
          >
            <GlassView
              rounded={radius.lg}
              intensity={55}
              overlayColor="rgba(255,255,255,0.1)"
              borderColor="rgba(255,255,255,0.35)"
              contentStyle={styles.unpaidCard}
            >
              <MaterialCommunityIcons name="door" size={rs(24, 21)} color={glass.textPrimary} />
              <Text style={styles.unpaidText}>
                {MOCK.unpaidCount} апартамента с неплатени задължения
              </Text>
              <ArrowBubble size={rs(34, 30)} />
            </GlassView>
          </PressableScale>
        </Animated.View>
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
    minHeight: rs(56, 50),
  },
  brandCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    marginTop: rs(20, 15),
    marginBottom: rs(18, 14),
    gap: rs(4, 3),
  },
  title: {
    fontSize: rs(34, 30),
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
  section: {
    marginTop: rs(14, 12),
  },
  expensesCard: {
    padding: rs(18, 15),
    paddingBottom: rs(22, 18),
    gap: rs(12, 10),
  },
  cardTitle: {
    fontSize: rs(18, 16),
    fontWeight: '700',
    color: glass.textPrimary,
  },
  donutCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutTotal: {
    fontSize: rs(22, 19),
    fontWeight: '800',
    letterSpacing: -0.3,
    color: glass.textPrimary,
  },
  callout: {
    position: 'absolute',
    alignItems: 'center',
    gap: rs(7, 6),
  },
  calloutBubbleShell: {
    borderRadius: 999,
    ...Platform.select({
      ios: {
        shadowColor: '#FFFFFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.45,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
      default: {},
    }),
  },
  calloutBubble: {
    flex: 1,
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth * 1.5,
    borderColor: 'rgba(255,255,255,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  calloutIconGlow: {
    position: 'absolute',
  },
  calloutIcon: {
    ...Platform.select({
      ios: {
        shadowColor: '#FFFFFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.95,
        shadowRadius: 6,
      },
      default: {},
    }),
  },
  calloutPct: {
    fontSize: rs(15, 13),
    fontWeight: '800',
    letterSpacing: -0.2,
    color: glass.textPrimary,
  },
  breakdown: {
    gap: rs(12, 10),
    marginTop: rs(4, 2),
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(10, 8),
  },
  breakdownLabel: {
    flex: 1,
    fontSize: rs(15, 14),
    fontWeight: '500',
    color: glass.textPrimary,
  },
  breakdownAmount: {
    fontSize: rs(15, 14),
    fontWeight: '700',
    color: glass.textPrimary,
  },
  breakdownPct: {
    width: rs(36, 32),
    textAlign: 'right',
    fontSize: rs(14, 13),
    fontWeight: '600',
    color: glass.textSecondary,
  },
  cardArrow: {
    position: 'absolute',
    right: rs(16, 14),
    bottom: rs(14, 12),
  },
  depositCard: {
    padding: rs(18, 15),
  },
  depositTop: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: rs(12, 10),
  },
  depositTexts: {
    flex: 1,
    gap: rs(6, 4),
  },
  depositValue: {
    fontSize: rs(32, 28),
    fontWeight: '800',
    letterSpacing: -0.4,
    color: glass.textPrimary,
  },
  progressTrack: {
    height: rs(10, 9),
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
    marginTop: rs(4, 2),
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  progressMeta: {
    fontSize: rs(13, 12),
    color: glass.textSecondary,
  },
  feeCard: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: rs(12, 10),
    padding: rs(18, 15),
  },
  feeTexts: {
    flex: 1,
    gap: rs(8, 6),
  },
  feeBody: {
    fontSize: rs(14, 13),
    lineHeight: rs(21, 19),
    color: glass.textSecondary,
  },
  unpaidCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(12, 10),
    paddingVertical: rs(16, 14),
    paddingHorizontal: rs(16, 14),
  },
  unpaidText: {
    flex: 1,
    fontSize: rs(15, 14),
    fontWeight: '600',
    color: glass.textPrimary,
  },
});
