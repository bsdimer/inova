import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import React, { useMemo } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSession } from '../../../src/api/client';
import { AppBackground } from '../../../src/components/AppBackground';
import { ArrowBubble } from '../../../src/components/ArrowBubble';
import { GlassCircleButton } from '../../../src/components/GlassCircleButton';
import { GlassView } from '../../../src/components/GlassView';
import { GridTile } from '../../../src/components/GridTile';
import { PressableScale } from '../../../src/components/PressableScale';
import { BrandLockup } from '../../../src/components/InovaLogo';
import { floatingTabClearance, metrics, rs } from '../../../src/theme/responsive';
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

const HEADER_HEIGHT = rs(46, 42);
const WELCOME_MARGIN = rs(18, 12);
const HELLO_LINE = rs(26, 22);
const NAME_LINE = rs(44, 38);
const BUILDING_BLOCK = rs(48, 42);
const DUES_MARGIN = rs(12, 8);
const DUES_BLOCK = DUES_MARGIN + rs(14, 12) * 2 + rs(52, 46);
const GRID_MARGIN = rs(10, 8);
const MIN_SPACER = rs(6, 4);
const MIN_TILE = rs(112, 100);

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const padTop = insets.top + rs(10, 6);

  // Shrink the pair of tiles until both rows sit fully above the tab bar.
  // Leftover height on a tall phone becomes the photo gap under the name.
  const tileHeight = useMemo(() => {
    const chrome =
      padTop +
      floatingTabClearance(insets.bottom) +
      HEADER_HEIGHT +
      WELCOME_MARGIN +
      HELLO_LINE +
      NAME_LINE +
      MIN_SPACER +
      BUILDING_BLOCK +
      DUES_BLOCK +
      GRID_MARGIN +
      rs(20, 16);
    const room = windowHeight - chrome - metrics.gridGap;
    return Math.max(MIN_TILE, Math.min(metrics.homeTileHeight, Math.floor(room / 2)));
  }, [insets.bottom, padTop, windowHeight]);

  const descriptionLines = tileHeight < rs(150, 134) ? 2 : 3;

  return (
    <View style={styles.container}>
      <AppBackground variant="hero" />

      <View
        style={[
          styles.column,
          { paddingTop: padTop, paddingBottom: floatingTabClearance(insets.bottom) },
        ]}
      >
        <View style={styles.headerRow}>
          <BrandLockup />
          <GlassCircleButton
            icon="ellipsis-horizontal"
            onPress={() => router.push('/menu')}
            accessibilityLabel="Отвори менюто"
          />
        </View>

        <View style={styles.welcome}>
          <Text style={styles.hello}>Добре дошли,</Text>
          <Text style={styles.name}>
            {getSession()?.user.fullName.split(' ')[0] ?? MOCK.residentName}
          </Text>
        </View>

        <View style={styles.heroSpacer} />

        <View style={styles.buildingInfo}>
          <Text style={styles.buildingName}>{MOCK.building}</Text>
          <Text style={styles.buildingAddress}>{MOCK.address}</Text>
        </View>

        <View style={styles.duesWrap}>
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
        </View>

        <View style={styles.grid}>
          {[QUICK_CARDS.slice(0, 2), QUICK_CARDS.slice(2)].map((row) => (
            <View key={row[0].title} style={[styles.tileRow, { height: tileHeight }]}>
              {row.map((card) => (
                <View key={card.title} style={styles.tileCell}>
                  <GridTile
                    onPress={() => {
                      if (card.route) router.push(card.route);
                    }}
                    accessibilityLabel={card.title}
                    height={tileHeight}
                    contentStyle={styles.quickCard}
                  >
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
                      <Text style={styles.quickDescription} numberOfLines={descriptionLines}>
                        {card.description}
                      </Text>
                    </View>
                    <View style={styles.quickArrow}>
                      <ArrowBubble />
                    </View>
                  </GridTile>
                </View>
              ))}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  column: {
    flex: 1,
    paddingHorizontal: metrics.screenPadding,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: HEADER_HEIGHT,
  },
  welcome: {
    marginTop: WELCOME_MARGIN,
    gap: rs(2, 1),
  },
  hello: {
    fontSize: rs(22, 19),
    lineHeight: HELLO_LINE,
    color: glass.textPrimary,
  },
  name: {
    fontSize: rs(40, 34),
    lineHeight: NAME_LINE,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: glass.textPrimary,
  },
  heroSpacer: {
    flexGrow: 1,
    flexShrink: 1,
    minHeight: MIN_SPACER,
  },
  buildingInfo: {
    height: BUILDING_BLOCK,
    justifyContent: 'center',
    gap: rs(4, 3),
  },
  buildingName: {
    fontSize: rs(21, 18),
    lineHeight: rs(26, 22),
    fontWeight: '700',
    color: glass.textPrimary,
  },
  buildingAddress: {
    fontSize: rs(15, 14),
    lineHeight: rs(18, 16),
    color: glass.textSecondary,
  },
  duesWrap: {
    marginTop: DUES_MARGIN,
  },
  duesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: rs(12, 10),
    paddingVertical: rs(14, 12),
    paddingHorizontal: rs(16, 14),
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
    marginTop: GRID_MARGIN,
    gap: metrics.gridGap,
  },
  tileRow: {
    flexDirection: 'row',
    gap: metrics.gridGap,
  },
  tileCell: {
    flex: 1,
  },
  quickCard: {
    justifyContent: 'flex-start',
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
    gap: rs(4, 3),
    marginTop: rs(12, 10),
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
  },
  quickArrow: {
    position: 'absolute',
    right: rs(12, 10),
    bottom: rs(12, 10),
  },
});
