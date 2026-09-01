import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApartmentsGauge } from '../../../src/components/ApartmentsGauge';
import { AppBackground } from '../../../src/components/AppBackground';
import { ArrowBubble } from '../../../src/components/ArrowBubble';
import { GlassCircleButton } from '../../../src/components/GlassCircleButton';
import { GlassView } from '../../../src/components/GlassView';
import { PressableScale } from '../../../src/components/PressableScale';
import { BrandLockup } from '../../../src/components/SosedoLogo';
import { metrics, rs, screen } from '../../../src/theme/responsive';
import { darkTheme, glass, palette, radius } from '../../../src/theme/tokens';

// TODO(M2/M3): building aggregates, cash-box balances, issues and documents
// come from the property/fees APIs.
const MOCK = {
  building: 'Резиденция Оборище',
  address: 'ул. Оборище 12, София',
  apartments: { total: 32, paid: 24, unpaid: 8 },
  cash: [
    {
      id: 'monthly',
      title: 'Каса — месечни разходи',
      value: '6 270 €',
      caption: 'Текущи месечни разходи',
      route: '/cash' as const,
    },
    {
      id: 'deposit',
      title: 'Каса — депозит',
      value: '9 100 €',
      caption: 'За извънредни разходи',
      // Deposit screen comes next — not the monthly-expenses flow.
      route: null,
    },
  ],
  issues: [
    {
      id: 'i1',
      category: 'Паркинг',
      status: 'Оправена',
      tone: 'success' as const,
      date: '31.07.2026',
      title: 'Неправилно паркирали кола на вход А',
    },
    {
      id: 'i2',
      category: 'ВиК',
      status: 'В процес',
      tone: 'progress' as const,
      date: '29.07.2026',
      title: 'Натрупана вода в подземния паркинг',
    },
  ],
  documentsCount: 12,
};

const STATUS_TONES = {
  success: darkTheme.success,
  progress: palette.orangeBright,
} as const;

const GAUGE_WIDTH = Math.min(screen.width - metrics.screenPadding * 2, 360);

export default function BuildingOverview() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <AppBackground variant="blur" />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + rs(16, 10), paddingBottom: insets.bottom + rs(116, 102) },
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

        <Animated.View entering={FadeInDown.duration(420).delay(80)} style={styles.titleBlock}>
          <Text style={styles.title}>{MOCK.building}</Text>
          <Text style={styles.address}>{MOCK.address}</Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(450).delay(160)} style={styles.gaugeWrap}>
          <PressableScale
            haptic={false}
            onPress={() => router.push('/building/apartments')}
            accessibilityRole="button"
            accessibilityLabel="Виж апартаментите"
          >
            <ApartmentsGauge
              width={GAUGE_WIDTH}
              total={MOCK.apartments.total}
              paid={MOCK.apartments.paid}
              unpaid={MOCK.apartments.unpaid}
              labels={{ total: 'Общо апартаменти', paid: 'Платили', unpaid: 'Неплатили' }}
            />
          </PressableScale>
        </Animated.View>

        {/* Cash boxes */}
        <View style={styles.grid}>
          {MOCK.cash.map((box, i) => (
            <Animated.View
              key={box.id}
              entering={FadeInUp.duration(400).delay(240 + i * 70)}
              style={styles.cell}
            >
              <PressableScale
                haptic={false}
                onPress={() => {
                  if (box.route) router.push(box.route);
                }}
                accessibilityRole="button"
                accessibilityLabel={box.title}
              >
                <GlassView rounded={radius.lg} contentStyle={styles.cashCard}>
                  <Text style={styles.cashTitle}>{box.title}</Text>
                  <Text style={styles.cashValue}>{box.value}</Text>
                  <Text style={styles.cashCaption}>{box.caption}</Text>
                  <View style={styles.cardArrow}>
                    <ArrowBubble />
                  </View>
                </GlassView>
              </PressableScale>
            </Animated.View>
          ))}
        </View>

        {/* How the fee is calculated */}
        <Animated.View entering={FadeInUp.duration(400).delay(400)}>
          <PressableScale
            haptic={false}
            onPress={() => router.push('/how-to-pay')}
            accessibilityRole="button"
            accessibilityLabel="Как се оформя таксата"
          >
            <GlassView rounded={radius.lg} contentStyle={styles.feeCard}>
              <View style={styles.feeTexts}>
                <Text style={styles.feeTitle}>Как се оформя таксата</Text>
                <Text style={styles.feeBody}>
                  Месечната такса се изчислява на база квадратура и общи части, съгласно решение на
                  Общо събрание.
                </Text>
              </View>
              <ArrowBubble />
            </GlassView>
          </PressableScale>
        </Animated.View>

        {/* Issues */}
        <Animated.View entering={FadeInUp.duration(400).delay(460)} style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Сигнали</Text>
          <PressableScale haptic={false} onPress={() => router.push('/issues')}>
            <Text style={styles.sectionLink}>Виж всички</Text>
          </PressableScale>
        </Animated.View>

        <View style={styles.grid}>
          {MOCK.issues.map((issue, i) => (
            <Animated.View
              key={issue.id}
              entering={FadeInUp.duration(400).delay(520 + i * 70)}
              style={styles.cell}
            >
              <PressableScale
                haptic={false}
                onPress={() => router.push('/issues')}
                accessibilityRole="button"
                accessibilityLabel={issue.title}
              >
                <GlassView rounded={radius.lg} contentStyle={styles.issueCard}>
                  <View style={styles.issueTop}>
                    <View style={styles.issueCategory}>
                      <Ionicons
                        name="alert-circle-outline"
                        size={rs(17, 15)}
                        color={glass.textSecondary}
                      />
                      <Text style={styles.issueCategoryText}>{issue.category}</Text>
                    </View>
                    <View style={styles.issueStatusBlock}>
                      <View style={styles.issueStatusRow}>
                        <Text style={styles.issueStatusText}>{issue.status}</Text>
                        <View
                          style={[styles.statusDot, { borderColor: STATUS_TONES[issue.tone] }]}
                        />
                      </View>
                      <Text style={styles.issueDate}>{issue.date}</Text>
                    </View>
                  </View>
                  <Text style={styles.issueTitle}>{issue.title}</Text>
                  <View style={styles.cardArrow}>
                    <ArrowBubble />
                  </View>
                </GlassView>
              </PressableScale>
            </Animated.View>
          ))}
        </View>

        {/* Documents */}
        <Animated.View entering={FadeInUp.duration(400).delay(660)} style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Документи към сградата</Text>
          <PressableScale haptic={false} onPress={() => router.push('/building/documents')}>
            <Text style={styles.sectionLink}>Виж всички</Text>
          </PressableScale>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(400).delay(720)}>
          <PressableScale
            haptic={false}
            onPress={() => router.push('/building/documents')}
            accessibilityRole="button"
            accessibilityLabel="Документи"
          >
            <GlassView rounded={radius.lg} contentStyle={styles.docsCard}>
              <View style={styles.docsTop}>
                <View style={styles.issueCategory}>
                  <Ionicons name="folder-outline" size={rs(17, 15)} color={glass.textSecondary} />
                  <Text style={styles.issueCategoryText}>Документи</Text>
                </View>
                <View style={styles.docsCount}>
                  <Text style={styles.docsCountValue}>{MOCK.documentsCount}</Text>
                  <Text style={styles.docsCountCaption}>документа</Text>
                </View>
              </View>
              <View style={styles.docsBottom}>
                <Text style={styles.docsText}>
                  Протоколи, договори и други{'\n'}важни документи
                </Text>
                <ArrowBubble />
              </View>
            </GlassView>
          </PressableScale>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    paddingHorizontal: metrics.screenPadding,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleBlock: {
    marginTop: rs(34, 26),
    gap: rs(5, 4),
  },
  title: {
    fontSize: rs(30, 26),
    fontWeight: '800',
    letterSpacing: -0.4,
    color: glass.textPrimary,
  },
  address: {
    fontSize: rs(15, 14),
    color: glass.textSecondary,
  },
  gaugeWrap: {
    alignItems: 'center',
    marginTop: rs(22, 16),
    marginBottom: rs(24, 18),
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: rs(12, 9),
    marginBottom: rs(12, 9),
  },
  cell: {
    flexBasis: '47%',
    flexGrow: 1,
  },
  cashCard: {
    padding: rs(16, 13),
    gap: rs(8, 6),
    minHeight: rs(158, 140),
  },
  cashTitle: {
    fontSize: rs(14, 13),
    fontWeight: '600',
    color: glass.textSecondary,
    paddingRight: rs(8, 6),
  },
  cashValue: {
    fontSize: rs(26, 22),
    fontWeight: '800',
    letterSpacing: -0.4,
    color: glass.textPrimary,
  },
  cashCaption: {
    fontSize: rs(13, 12),
    color: glass.textMuted,
    paddingRight: rs(34, 30),
  },
  cardArrow: {
    position: 'absolute',
    right: rs(12, 10),
    bottom: rs(12, 10),
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
  feeTitle: {
    fontSize: rs(18, 16),
    fontWeight: '700',
    color: glass.textPrimary,
  },
  feeBody: {
    fontSize: rs(14, 13),
    lineHeight: rs(21, 19),
    color: glass.textSecondary,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: rs(18, 14),
    marginBottom: rs(14, 11),
  },
  sectionTitle: {
    fontSize: rs(22, 19),
    fontWeight: '700',
    letterSpacing: -0.3,
    color: glass.textPrimary,
    flexShrink: 1,
  },
  sectionLink: {
    fontSize: rs(14, 13),
    fontWeight: '500',
    color: glass.textSecondary,
  },
  issueCard: {
    padding: rs(16, 13),
    gap: rs(14, 11),
    minHeight: rs(196, 174),
  },
  issueTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: rs(8, 6),
  },
  issueCategory: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(5, 4),
  },
  issueCategoryText: {
    fontSize: rs(13, 12),
    fontWeight: '600',
    color: glass.textSecondary,
  },
  issueStatusBlock: {
    alignItems: 'flex-end',
    gap: rs(3, 2),
  },
  issueStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(5, 4),
  },
  issueStatusText: {
    fontSize: rs(13, 12),
    color: glass.textSecondary,
  },
  statusDot: {
    width: rs(11, 10),
    height: rs(11, 10),
    borderRadius: 999,
    borderWidth: 2,
  },
  issueDate: {
    fontSize: rs(12, 11),
    color: glass.textMuted,
  },
  issueTitle: {
    fontSize: rs(17, 15),
    fontWeight: '600',
    lineHeight: rs(24, 21),
    color: glass.textPrimary,
    paddingBottom: rs(34, 30),
  },
  docsCard: {
    padding: rs(18, 15),
    gap: rs(16, 13),
  },
  docsTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  docsCount: {
    alignItems: 'flex-end',
    gap: rs(1, 1),
  },
  docsCountValue: {
    fontSize: rs(24, 20),
    fontWeight: '800',
    color: glass.textPrimary,
  },
  docsCountCaption: {
    fontSize: rs(13, 12),
    color: glass.textSecondary,
  },
  docsBottom: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: rs(12, 10),
  },
  docsText: {
    flex: 1,
    fontSize: rs(14, 13),
    lineHeight: rs(21, 19),
    color: glass.textSecondary,
  },
});
