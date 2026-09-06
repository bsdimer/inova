import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppBackground } from '../../../src/components/AppBackground';
import { GlassCircleButton } from '../../../src/components/GlassCircleButton';
import { GlassView } from '../../../src/components/GlassView';
import { GlowBar } from '../../../src/components/GlowBar';
import { PressableScale } from '../../../src/components/PressableScale';
import { BrandLockup } from '../../../src/components/SosedoLogo';
import { VoteRing } from '../../../src/components/VoteRing';
import { metrics, rs } from '../../../src/theme/responsive';
import { glass, palette, radius } from '../../../src/theme/tokens';

interface SurveyOption {
  id: string;
  label: string;
  pct: number;
}

interface SurveyDetail {
  votedPct: number;
  intro: string;
  whyTitle: string;
  whyBody: string;
  activeUntil: string;
  question: string;
  options: SurveyOption[];
  /** Option the current resident picked. */
  myVote: string;
}

// TODO(M7+): survey detail + votes from the surveys API; myVote from the session.
const MOCK_DETAILS: Record<string, SurveyDetail> = {
  a1: {
    votedPct: 46,
    intro: 'Вашето мнение е важно',
    whyTitle: 'Защо е нужно?',
    whyBody:
      'Покривът показва следи от течове и амортизация. Необходим е ремонт, за да се предотвратят бъдещи щети по общите части и апартаментите на последния етаж.',
    activeUntil: 'Активна до 31.08',
    question: 'Подкрепяте ли ремонт на покрива?',
    options: [
      { id: 'no', label: 'Не', pct: 54 },
      { id: 'partial', label: 'Да — частично фиксиране до 6 000 €', pct: 24 },
      { id: 'full', label: 'Да — цялостна подмяна до 18 000 €', pct: 14 },
    ],
    myVote: 'no',
  },
};

const FALLBACK = MOCK_DETAILS.a1;

function OptionRow({
  option,
  selected,
  onSelect,
}: {
  option: SurveyOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <PressableScale
      haptic={false}
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${option.label}, ${option.pct}%`}
      style={[styles.optionRow, ...(selected ? [styles.optionRowSelected] : [])]}
    >
      <View style={styles.optionTop}>
        <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
          {selected ? <View style={styles.radioDot} /> : null}
        </View>
        <Text
          style={styles.optionLabel}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {option.label}
        </Text>
        <Text style={styles.optionPct}>{option.pct}%</Text>
      </View>
      <View style={styles.optionBar}>
        <GlowBar pct={option.pct} filterId={`option-glow-${option.id}`} />
      </View>
    </PressableScale>
  );
}

export default function SurveyDetail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const detail = MOCK_DETAILS[id ?? ''] ?? FALLBACK;
  const ringSize = rs(120, 108);
  // TODO(M7+): selection persists via the surveys API; local-only for now.
  const [myVote, setMyVote] = useState(detail.myVote);

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
            // Deep links land here without history — fall back to the list.
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/surveys'))}
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

        {/* Title on the left, glowing vote ring on the right — like the mockup. */}
        <Animated.View entering={FadeInDown.duration(420).delay(60)} style={styles.heroRow}>
          <View style={styles.heroTexts}>
            <Text style={styles.title}>Анкета</Text>
            <Text style={styles.subtitle}>{detail.intro}</Text>
          </View>
          <VoteRing
            pct={detail.votedPct}
            size={ringSize}
            filterId="survey-detail-glow"
            pctFontSize={rs(30, 26)}
          />
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(420).delay(120)}>
          <GlassView
            rounded={radius.lg}
            intensity={55}
            overlayColor="rgba(255,255,255,0.1)"
            borderColor="rgba(255,255,255,0.35)"
            contentStyle={styles.whyCard}
          >
            <Text style={styles.whyTitle}>{detail.whyTitle}</Text>
            <Text style={styles.whyBody}>{detail.whyBody}</Text>
          </GlassView>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(420).delay(200)} style={styles.section}>
          <GlassView
            rounded={radius.lg}
            intensity={55}
            overlayColor="rgba(255,255,255,0.1)"
            borderColor="rgba(255,255,255,0.35)"
            contentStyle={styles.voteCard}
          >
            <View style={styles.voteMeta}>
              <View style={styles.voteMetaLeft}>
                <View style={styles.voteMetaIcon}>
                  <Ionicons name="bar-chart-outline" size={rs(18, 16)} color={glass.textPrimary} />
                </View>
                <Text style={styles.voteMetaLabel}>Анкета</Text>
              </View>
              <View style={styles.deadlinePill}>
                <Ionicons name="calendar-outline" size={rs(14, 13)} color={palette.orange} />
                <Text style={styles.deadlineText}>{detail.activeUntil}</Text>
              </View>
            </View>

            <Text style={styles.question}>{detail.question}</Text>

            <View style={styles.options}>
              {detail.options.map((option) => (
                <OptionRow
                  key={option.id}
                  option={option}
                  selected={option.id === myVote}
                  onSelect={() => setMyVote(option.id)}
                />
              ))}
            </View>

            <PressableScale
              haptic={false}
              onPress={() => undefined}
              accessibilityRole="button"
              accessibilityLabel="Промени гласа си"
              style={styles.cta}
            >
              <Text style={styles.ctaLabel}>Промени гласа си</Text>
              <Ionicons name="arrow-forward" size={rs(18, 16)} color={palette.white} />
            </PressableScale>

            <View style={styles.anonRow}>
              <Ionicons
                name="information-circle-outline"
                size={rs(15, 14)}
                color={glass.textSecondary}
              />
              <Text style={styles.anonText}>Резултатите са анонимни</Text>
            </View>
          </GlassView>
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
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: rs(12, 10),
    marginTop: rs(12, 9),
    marginBottom: rs(14, 11),
  },
  heroTexts: {
    flex: 1,
    gap: rs(10, 8),
  },
  title: {
    fontSize: rs(34, 30),
    fontWeight: '700',
    letterSpacing: -0.4,
    color: glass.textPrimary,
  },
  subtitle: {
    fontSize: rs(16, 14),
    color: glass.textSecondary,
  },
  whyCard: {
    padding: rs(18, 15),
    gap: rs(10, 8),
  },
  whyTitle: {
    fontSize: rs(18, 16),
    fontWeight: '700',
    color: glass.textPrimary,
  },
  whyBody: {
    fontSize: rs(15, 14),
    lineHeight: rs(23, 21),
    color: glass.textSecondary,
  },
  section: {
    marginTop: rs(14, 12),
  },
  voteCard: {
    padding: rs(18, 15),
    gap: rs(16, 13),
  },
  voteMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: rs(10, 8),
  },
  voteMetaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(10, 8),
  },
  voteMetaIcon: {
    width: rs(38, 34),
    height: rs(38, 34),
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voteMetaLabel: {
    fontSize: rs(15, 14),
    fontWeight: '600',
    color: glass.textPrimary,
  },
  deadlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(6, 5),
    paddingVertical: rs(8, 7),
    paddingHorizontal: rs(12, 10),
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  deadlineText: {
    fontSize: rs(13, 12),
    fontWeight: '600',
    color: glass.textPrimary,
  },
  question: {
    fontSize: rs(19, 17),
    fontWeight: '700',
    lineHeight: rs(26, 24),
    color: glass.textPrimary,
  },
  options: {
    gap: rs(10, 8),
  },
  optionRow: {
    gap: rs(8, 6),
    paddingVertical: rs(12, 10),
    paddingHorizontal: rs(14, 12),
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  optionRowSelected: {
    borderColor: 'rgba(255,255,255,0.5)',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  optionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(10, 8),
  },
  radioOuter: {
    width: rs(24, 22),
    height: rs(24, 22),
    borderRadius: 999,
    borderWidth: rs(1.5, 1.5),
    borderColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: palette.white,
  },
  radioDot: {
    width: rs(12, 11),
    height: rs(12, 11),
    borderRadius: 999,
    backgroundColor: palette.white,
    ...Platform.select({
      ios: {
        shadowColor: '#FFFFFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
      default: {},
    }),
  },
  optionLabel: {
    flex: 1,
    fontSize: rs(15, 14),
    fontWeight: '500',
    color: glass.textPrimary,
  },
  optionPct: {
    fontSize: rs(15, 14),
    fontWeight: '700',
    color: glass.textPrimary,
  },
  optionBar: {
    marginLeft: rs(34, 30),
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: rs(10, 8),
    minHeight: metrics.buttonHeight,
    borderRadius: 999,
    backgroundColor: 'rgba(20,18,17,0.92)',
    paddingHorizontal: rs(20, 16),
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
      default: {},
    }),
  },
  ctaLabel: {
    fontSize: rs(16, 15),
    fontWeight: '700',
    color: palette.white,
  },
  anonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: rs(6, 5),
  },
  anonText: {
    fontSize: rs(13, 12),
    color: glass.textSecondary,
  },
});
