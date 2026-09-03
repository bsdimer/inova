import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import React, { useCallback, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSession } from '../../../src/api/client';
import { AppBackground } from '../../../src/components/AppBackground';
import { ArrowBubble } from '../../../src/components/ArrowBubble';
import { GlassCircleButton } from '../../../src/components/GlassCircleButton';
import { GlassView } from '../../../src/components/GlassView';
import { PressableScale } from '../../../src/components/PressableScale';
import { BrandLockup } from '../../../src/components/SosedoLogo';
import { metrics, rs } from '../../../src/theme/responsive';
import { glass, palette, radius } from '../../../src/theme/tokens';

// TODO(M2/M3): resident name, building and balance come from the API.
const MOCK = {
  residentName: 'Иван',
  building: 'Резиденция Оборище',
  address: 'ул. Оборище 12, София',
  outstanding: '20 €',
  unreadNotices: 3,
};

interface QuickCard {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  route: Href | null;
  badge?: number;
}

const QUICK_CARDS: QuickCard[] = [
  {
    icon: 'card-outline',
    title: 'Каса',
    description: 'Всички плащания и отчети на едно място.',
    // Home Каса hub → monthly expenses / deposit / unpaid from there.
    route: '/kasa',
  },
  {
    icon: 'stats-chart-outline',
    title: 'Анкети',
    description: 'Вашият глас за важните решения.',
    route: '/surveys',
  },
  {
    icon: 'time-outline',
    title: 'История',
    description: 'Хронология на ключовите събития',
    route: '/home/history',
  },
  {
    icon: 'notifications-outline',
    title: 'Известия',
    description: 'Важното за сградата, винаги навреме.',
    route: '/messages',
    badge: MOCK.unreadNotices,
  },
];

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  // Snap back to the rest position when the tab regains focus — a leftover
  // scroll offset (or a bounce frozen by the tab switch) would otherwise leave
  // a stray gap between the cards and the tab bar.
  useFocusEffect(
    useCallback(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, []),
  );

  return (
    <View style={styles.container}>
      <AppBackground variant="hero" />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + rs(16, 10), paddingBottom: insets.bottom + rs(96, 86) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(400)} style={styles.headerRow}>
          <BrandLockup />
          <GlassCircleButton
            icon="ellipsis-horizontal"
            onPress={() => router.push('/menu')}
            accessibilityLabel="Отвори менюто"
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(420).delay(80)} style={styles.welcome}>
          <Text style={styles.hello}>Добре дошли,</Text>
          <Text style={styles.name}>
            {getSession()?.user.fullName.split(' ')[0] ?? MOCK.residentName}
          </Text>
        </Animated.View>

        {/* Stretchy photo area: absorbs extra height on tall screens so the
            grid always rests just above the tab bar without scrolling. */}
        <View style={styles.heroSpacer} />

        <Animated.View entering={FadeInDown.duration(420).delay(140)} style={styles.buildingInfo}>
          <Text style={styles.buildingName}>{MOCK.building}</Text>
          <Text style={styles.buildingAddress}>{MOCK.address}</Text>
        </Animated.View>

        {/* Current dues + pay CTA */}
        <Animated.View entering={FadeInUp.duration(420).delay(220)}>
          <GlassView contentStyle={styles.duesCard}>
            <View style={styles.duesText}>
              <Text style={styles.duesLabel}>Текущо задължение</Text>
              <Text style={styles.duesValue}>{MOCK.outstanding}</Text>
            </View>
            {/* TODO(M4): home payment / Каса flow — not monthly building expenses. */}
            <PressableScale
              onPress={() => undefined}
              style={styles.payButton}
              accessibilityRole="button"
              accessibilityLabel="Плащане"
            >
              <Ionicons name="card-outline" size={rs(20, 18)} color={palette.white} />
              <Text style={styles.payLabel}>Плащане</Text>
              <Ionicons name="arrow-forward" size={rs(17, 15)} color={palette.white} />
            </PressableScale>
          </GlassView>
        </Animated.View>

        {/* Quick-access grid */}
        <View style={styles.grid}>
          {QUICK_CARDS.map((card, i) => (
            <Animated.View
              key={card.title}
              entering={FadeInUp.duration(400).delay(300 + i * 70)}
              style={styles.cell}
            >
              <PressableScale
                haptic={false}
                onPress={() => {
                  if (card.route) router.push(card.route);
                }}
                accessibilityRole="button"
                accessibilityLabel={card.title}
              >
                <GlassView rounded={radius.lg} contentStyle={styles.quickCard}>
                  <View style={styles.quickIconWrap}>
                    <Ionicons name={card.icon} size={rs(26, 23)} color={glass.textPrimary} />
                    {card.badge ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{card.badge}</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.quickTexts}>
                    <Text style={styles.quickTitle}>{card.title}</Text>
                    <Text style={styles.quickDescription}>{card.description}</Text>
                  </View>
                  <View style={styles.quickArrow}>
                    <ArrowBubble />
                  </View>
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
  scroll: {
    flexGrow: 1,
    paddingHorizontal: metrics.screenPadding,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  welcome: {
    marginTop: rs(44, 32),
    gap: rs(2, 1),
  },
  hello: {
    fontSize: rs(22, 19),
    color: glass.textPrimary,
  },
  name: {
    fontSize: rs(40, 34),
    fontWeight: '800',
    letterSpacing: -0.5,
    color: glass.textPrimary,
  },
  heroSpacer: {
    flexGrow: 1,
    minHeight: rs(28, 20),
  },
  buildingInfo: {
    gap: rs(4, 3),
  },
  buildingName: {
    fontSize: rs(21, 18),
    fontWeight: '700',
    color: glass.textPrimary,
  },
  buildingAddress: {
    fontSize: rs(15, 14),
    color: glass.textSecondary,
  },
  duesCard: {
    marginTop: rs(30, 22),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: rs(12, 10),
    padding: rs(18, 15),
  },
  duesText: {
    gap: rs(4, 3),
    flexShrink: 1,
  },
  duesLabel: {
    fontSize: rs(14, 13),
    color: glass.textSecondary,
  },
  duesValue: {
    fontSize: rs(30, 26),
    fontWeight: '800',
    letterSpacing: -0.5,
    color: glass.textPrimary,
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(8, 6),
    backgroundColor: palette.goldBlack,
    borderRadius: radius.pill,
    paddingHorizontal: rs(18, 14),
    height: rs(52, 46),
  },
  payLabel: {
    fontSize: rs(16, 15),
    fontWeight: '600',
    color: palette.white,
  },
  grid: {
    marginTop: rs(14, 11),
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: rs(12, 9),
  },
  cell: {
    flexBasis: '47%',
    flexGrow: 1,
  },
  quickCard: {
    minHeight: rs(178, 158),
    padding: rs(16, 13),
    justifyContent: 'space-between',
  },
  quickIconWrap: {
    alignSelf: 'flex-start',
  },
  badge: {
    position: 'absolute',
    top: -rs(6, 5),
    right: -rs(10, 9),
    minWidth: rs(18, 16),
    height: rs(18, 16),
    borderRadius: 999,
    backgroundColor: palette.orange,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: rs(11, 10),
    fontWeight: '700',
    color: palette.white,
  },
  quickTexts: {
    gap: rs(6, 5),
    marginTop: rs(26, 20),
    paddingBottom: rs(6, 4),
  },
  quickTitle: {
    fontSize: rs(19, 17),
    fontWeight: '700',
    color: glass.textPrimary,
  },
  quickDescription: {
    fontSize: rs(13, 12),
    lineHeight: rs(18, 16),
    color: glass.textSecondary,
    paddingRight: rs(30, 26),
  },
  quickArrow: {
    position: 'absolute',
    right: rs(12, 10),
    bottom: rs(12, 10),
  },
});
