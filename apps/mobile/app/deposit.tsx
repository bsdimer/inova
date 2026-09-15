import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { AppBackground } from '../src/components/AppBackground';
import { ArrowBubble } from '../src/components/ArrowBubble';
import { GlassCircleButton } from '../src/components/GlassCircleButton';
import { GlassView } from '../src/components/GlassView';
import { PressableScale } from '../src/components/PressableScale';
import { BrandLockup } from '../src/components/InovaLogo';
import { metrics, rs, screen } from '../src/theme/responsive';
import { glass, radius } from '../src/theme/tokens';

// TODO(M3): deposit fund balance, history and chart from the billing API.
const MOCK = {
  building: 'Резиденция Оборище',
  address: 'ул. Оборище 12, София',
  balance: 9100,
  goal: 15000,
  purpose: 'За извънредни разходи',
  chart: [
    { label: "Май '25", value: 4200 },
    { label: "Юли '25", value: 5600 },
    { label: "Сеп '25", value: 6100 },
    { label: "Ное '25", value: 7200 },
    { label: "Яну '26", value: 8100 },
    { label: "Мар '26", value: 9100 },
  ],
  movements: [
    {
      id: 'm1',
      title: 'Месечна вноска',
      date: 'Март 2026',
      amount: 50,
      direction: 'in' as const,
    },
    {
      id: 'm2',
      title: 'Месечна вноска',
      date: 'Февруари 2026',
      amount: 50,
      direction: 'in' as const,
    },
    {
      id: 'm3',
      title: 'Ремонт входна врата',
      date: '25.02.2026',
      amount: 800,
      direction: 'out' as const,
    },
    {
      id: 'm4',
      title: 'Месечна вноска',
      date: 'Януари 2026',
      amount: 50,
      direction: 'in' as const,
    },
    {
      id: 'm5',
      title: 'Смяна на осветление',
      date: '18.01.2026',
      amount: 350,
      direction: 'out' as const,
    },
  ],
  about:
    'Депозитният фонд се натрупва от месечни вноски на собствениците и се използва само за извънредни и спешни разходи, след решение на Общото събрание.',
};

function formatEuro(value: number) {
  return `${value.toLocaleString('bg-BG')} €`;
}

function FundChart({
  points,
  width,
  height,
}: {
  points: { label: string; value: number }[];
  width: number;
  height: number;
}) {
  const padL = rs(36, 32);
  const padR = rs(8, 6);
  const padT = rs(12, 10);
  const padB = rs(28, 24);
  const maxY = 15000;
  const yTicks = [0, 5000, 10000, 15000];

  const coords = points.map((p, i) => {
    const x = padL + (i / Math.max(points.length - 1, 1)) * (width - padL - padR);
    const y = padT + (1 - p.value / maxY) * (height - padT - padB);
    return { x, y, ...p };
  });

  const polyline = coords.map((c) => `${c.x},${c.y}`).join(' ');

  return (
    <View>
      <Svg width={width} height={height}>
        {yTicks.map((tick) => {
          const y = padT + (1 - tick / maxY) * (height - padT - padB);
          return (
            <React.Fragment key={tick}>
              <Line
                x1={padL}
                y1={y}
                x2={width - padR}
                y2={y}
                stroke="rgba(255,255,255,0.12)"
                strokeWidth={1}
              />
            </React.Fragment>
          );
        })}
        <Polyline
          points={polyline}
          fill="none"
          stroke="rgba(255,255,255,0.9)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {coords.map((c) => (
          <Circle
            key={c.label}
            cx={c.x}
            cy={c.y}
            r={4}
            fill="#FFFFFF"
            stroke="rgba(255,255,255,0.35)"
            strokeWidth={2}
          />
        ))}
      </Svg>
      <View style={[styles.yLabels, { height: height - padB }]} pointerEvents="none">
        {[...yTicks].reverse().map((tick) => (
          <Text key={tick} style={styles.axisLabel}>
            {tick === 0 ? '0 €' : `${tick / 1000}k €`}
          </Text>
        ))}
      </View>
      <View style={[styles.xLabels, { paddingLeft: padL, paddingRight: padR }]}>
        {points.map((p) => (
          <Text key={p.label} style={styles.axisLabel}>
            {p.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

export default function Deposit() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const progress = useMemo(() => Math.min(MOCK.balance / MOCK.goal, 1), []);
  const progressPct = Math.round(progress * 100);
  const chartWidth = screen.width - metrics.screenPadding * 2 - rs(36, 30);

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
          <Text style={styles.title}>Депозит</Text>
          <Text style={styles.building}>{MOCK.building}</Text>
          <Text style={styles.address}>{MOCK.address}</Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(420).delay(120)}>
          <GlassView
            rounded={radius.lg}
            intensity={55}
            overlayColor="rgba(255,255,255,0.1)"
            borderColor="rgba(255,255,255,0.35)"
            contentStyle={styles.balanceCard}
          >
            <Text style={styles.balanceLabel}>Текущ баланс</Text>
            <Text style={styles.balanceValue}>{formatEuro(MOCK.balance)}</Text>
            <Text style={styles.balancePurpose}>{MOCK.purpose}</Text>

            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
            </View>
            <View style={styles.progressMeta}>
              <Text style={styles.progressText}>
                {formatEuro(MOCK.balance)} от {formatEuro(MOCK.goal)} цел
              </Text>
              <Text style={styles.progressText}>{progressPct}%</Text>
            </View>
          </GlassView>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(420).delay(180)} style={styles.section}>
          <GlassView
            rounded={radius.lg}
            intensity={55}
            overlayColor="rgba(255,255,255,0.1)"
            borderColor="rgba(255,255,255,0.35)"
            contentStyle={styles.chartCard}
          >
            <Text style={styles.sectionTitle}>Натрупване на фонда</Text>
            <Text style={styles.sectionSub}>Последните 12 месеца</Text>
            <FundChart points={MOCK.chart} width={chartWidth} height={rs(180, 160)} />
          </GlassView>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(420).delay(240)} style={styles.section}>
          <GlassView
            rounded={radius.lg}
            intensity={55}
            overlayColor="rgba(255,255,255,0.1)"
            borderColor="rgba(255,255,255,0.35)"
            contentStyle={styles.movementsCard}
          >
            <Text style={styles.sectionTitle}>Последни движения</Text>
            {MOCK.movements.map((item, i) => {
              const inflow = item.direction === 'in';
              return (
                <PressableScale
                  key={item.id}
                  haptic={false}
                  onPress={() => undefined}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.title}, ${formatEuro(item.amount)}`}
                  style={[
                    styles.movementRow,
                    ...(i < MOCK.movements.length - 1 ? [styles.movementRowBorder] : []),
                  ]}
                >
                  <GlassView
                    rounded={999}
                    intensity={45}
                    overlayColor="rgba(255,255,255,0.14)"
                    borderColor="rgba(255,255,255,0.4)"
                    style={styles.movementIcon}
                    contentStyle={styles.movementIconInner}
                  >
                    <Ionicons
                      name={inflow ? 'arrow-up' : 'arrow-down'}
                      size={rs(18, 16)}
                      color={glass.textPrimary}
                    />
                  </GlassView>
                  <View style={styles.movementTexts}>
                    <Text style={styles.movementTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.movementDate}>{item.date}</Text>
                  </View>
                  <Text style={styles.movementAmount}>
                    {inflow ? '+' : '−'} {formatEuro(item.amount)}
                  </Text>
                  <Ionicons name="chevron-forward" size={rs(18, 16)} color={glass.textMuted} />
                </PressableScale>
              );
            })}
          </GlassView>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(420).delay(300)} style={styles.section}>
          <PressableScale
            haptic={false}
            onPress={() => undefined}
            accessibilityRole="button"
            accessibilityLabel="За депозита"
          >
            <GlassView
              rounded={radius.lg}
              intensity={55}
              overlayColor="rgba(255,255,255,0.1)"
              borderColor="rgba(255,255,255,0.35)"
              contentStyle={styles.aboutCard}
            >
              <View style={styles.aboutTexts}>
                <Text style={styles.sectionTitle}>За депозита</Text>
                <Text style={styles.aboutBody}>{MOCK.about}</Text>
              </View>
              <ArrowBubble size={rs(36, 32)} />
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
    marginBottom: rs(20, 16),
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
  balanceCard: {
    padding: rs(20, 17),
    gap: rs(6, 4),
  },
  balanceLabel: {
    fontSize: rs(14, 13),
    color: glass.textSecondary,
  },
  balanceValue: {
    fontSize: rs(36, 30),
    fontWeight: '800',
    letterSpacing: -0.5,
    color: glass.textPrimary,
  },
  balancePurpose: {
    fontSize: rs(14, 13),
    color: glass.textSecondary,
    marginBottom: rs(10, 8),
  },
  progressTrack: {
    height: rs(10, 9),
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  progressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: rs(8, 6),
  },
  progressText: {
    fontSize: rs(13, 12),
    color: glass.textSecondary,
  },
  section: {
    marginTop: rs(14, 12),
  },
  chartCard: {
    padding: rs(18, 15),
    gap: rs(4, 3),
  },
  sectionTitle: {
    fontSize: rs(18, 16),
    fontWeight: '700',
    color: glass.textPrimary,
  },
  sectionSub: {
    fontSize: rs(13, 12),
    color: glass.textSecondary,
    marginBottom: rs(10, 8),
  },
  yLabels: {
    position: 'absolute',
    top: rs(8, 6),
    left: 0,
    justifyContent: 'space-between',
    paddingBottom: rs(4, 3),
  },
  xLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: rs(-18, -16),
  },
  axisLabel: {
    fontSize: rs(11, 10),
    color: glass.textMuted,
  },
  movementsCard: {
    paddingHorizontal: rs(14, 12),
    paddingTop: rs(16, 14),
    paddingBottom: rs(6, 4),
  },
  movementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(12, 10),
    paddingVertical: rs(12, 10),
  },
  movementRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.16)',
  },
  movementIcon: {
    width: rs(40, 36),
    height: rs(40, 36),
  },
  movementIconInner: {
    width: rs(40, 36),
    height: rs(40, 36),
    alignItems: 'center',
    justifyContent: 'center',
  },
  movementTexts: {
    flex: 1,
    gap: rs(2, 1),
  },
  movementTitle: {
    fontSize: rs(15, 14),
    fontWeight: '600',
    color: glass.textPrimary,
  },
  movementDate: {
    fontSize: rs(12, 11),
    color: glass.textSecondary,
  },
  movementAmount: {
    fontSize: rs(15, 14),
    fontWeight: '700',
    color: glass.textPrimary,
  },
  aboutCard: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: rs(12, 10),
    padding: rs(18, 15),
  },
  aboutTexts: {
    flex: 1,
    gap: rs(8, 6),
  },
  aboutBody: {
    fontSize: rs(14, 13),
    lineHeight: rs(21, 19),
    color: glass.textSecondary,
  },
});
