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
import { BrandLockup } from '../../../src/components/InovaLogo';
import { VoteRing } from '../../../src/components/VoteRing';
import { metrics, rs } from '../../../src/theme/responsive';
import { glass, palette, radius } from '../../../src/theme/tokens';

type IconName = keyof typeof Ionicons.glyphMap;

interface RatingRow {
  id: string;
  label: string;
  icon: IconName;
}

interface VotePage {
  question: string;
  hint: string;
  rows: RatingRow[];
}

// TODO(M7+): voting flow pages + submission via the surveys API.
const MOCK_VOTE = {
  votedPct: 46,
  intro: 'Вашето мнение е важно за нас!\nПомогнете ни да бъдем още по-добри.',
  activeUntil: 'Активна до 31.08',
  pages: [
    {
      question: 'Как оценявате състоянието на входа и общите помещения?',
      hint: 'Оценете по скала от 1 до 5, където 1 е най-ниска оценка, а 5 е отлично.',
      rows: [
        { id: 'entrance', label: 'Вход', icon: 'home-outline' },
        { id: 'stairs', label: 'Стълбище', icon: 'trending-up-outline' },
        { id: 'elevator', label: 'Асансьор', icon: 'swap-vertical-outline' },
      ],
    },
    {
      question: 'Как бихте оценили поддръжката на общите части във вашата сграда?',
      hint: 'Оценете по скала от 1 до 5, където 1 е най-ниска оценка, а 5 е отлично.',
      rows: [
        { id: 'cleaning', label: 'Чистота', icon: 'brush-outline' },
        { id: 'maintenance', label: 'Поддръжка', icon: 'construct-outline' },
        { id: 'greenery', label: 'Озеленяване', icon: 'leaf-outline' },
        { id: 'communication', label: 'Комуникация', icon: 'person-outline' },
      ],
    },
    {
      question: 'Как оценявате работата на домоуправителя?',
      hint: 'Оценете по скала от 1 до 5, където 1 е най-ниска оценка, а 5 е отлично.',
      rows: [
        { id: 'responsiveness', label: 'Отзивчивост', icon: 'chatbubble-ellipses-outline' },
        { id: 'transparency', label: 'Прозрачност', icon: 'eye-outline' },
        { id: 'speed', label: 'Бързина', icon: 'flash-outline' },
      ],
    },
  ] satisfies VotePage[],
};

const SCALE = [1, 2, 3, 4, 5];

function RatingScale({
  row,
  value,
  onRate,
}: {
  row: RatingRow;
  value: number | undefined;
  onRate: (score: number) => void;
}) {
  return (
    <View style={styles.ratingRow}>
      <View style={styles.ratingHead}>
        <View style={styles.ratingIcon}>
          <Ionicons name={row.icon} size={rs(20, 18)} color={glass.textPrimary} />
        </View>
        <Text style={styles.ratingLabel}>{row.label}</Text>
      </View>
      <View style={styles.scaleRow}>
        {SCALE.map((score) => {
          const selected = value === score;
          return (
            <PressableScale
              key={score}
              haptic={false}
              onPress={() => onRate(score)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${row.label}: оценка ${score}`}
              style={[styles.scaleDot, ...(selected ? [styles.scaleDotSelected] : [])]}
            >
              <Text style={[styles.scaleText, ...(selected ? [styles.scaleTextSelected] : [])]}>
                {score}
              </Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

export default function SurveyVote() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  useLocalSearchParams<{ id: string }>();
  const [page, setPage] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  // TODO(M7+): answers submit to the surveys API on the last page.
  const [ratings, setRatings] = useState<Record<string, number>>({});

  const pages = MOCK_VOTE.pages;
  const current = pages[page];
  const isLast = page === pages.length - 1;

  const goBack = () => {
    if (page > 0) {
      setPage(page - 1);
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/surveys');
    }
  };

  const goNext = () => {
    if (isLast) {
      // MOCK submit: the API call lands here in M7.
      setSubmitted(true);
    } else {
      setPage(page + 1);
    }
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
        <Animated.View entering={FadeInDown.duration(360)} style={styles.headerRow}>
          <GlassCircleButton
            icon="arrow-back"
            size={rs(50, 46)}
            onPress={goBack}
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

        <Animated.View entering={FadeInDown.duration(420).delay(60)} style={styles.heroRow}>
          <View style={styles.heroTexts}>
            <Text style={styles.title}>Анкета</Text>
            <Text style={styles.subtitle}>{MOCK_VOTE.intro}</Text>
          </View>
          <VoteRing
            pct={MOCK_VOTE.votedPct}
            size={rs(120, 108)}
            filterId="survey-vote-glow"
            pctFontSize={rs(30, 26)}
          />
        </Animated.View>

        {submitted ? (
          <Animated.View entering={FadeInUp.duration(420)}>
            <GlassView
              rounded={radius.lg}
              intensity={55}
              overlayColor="rgba(255,255,255,0.1)"
              borderColor="rgba(255,255,255,0.35)"
              contentStyle={styles.thanksCard}
            >
              <View style={styles.thanksIcon}>
                <Ionicons name="checkmark" size={rs(34, 30)} color={glass.textPrimary} />
              </View>
              <Text style={styles.thanksTitle}>Благодарим за участието!</Text>
              <Text style={styles.thanksBody}>
                Вашият глас беше записан. Заедно вземаме по-добри решения за сградата.
              </Text>
              <PressableScale
                haptic={false}
                onPress={() => router.replace('/surveys')}
                accessibilityRole="button"
                accessibilityLabel="Към анкетите"
                style={[styles.cta, styles.thanksCta]}
              >
                <Text style={styles.ctaLabel}>Към анкетите</Text>
                <Ionicons name="arrow-forward" size={rs(18, 16)} color={palette.white} />
              </PressableScale>
            </GlassView>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInUp.duration(420).delay(120)}>
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
                    <Ionicons
                      name="bar-chart-outline"
                      size={rs(18, 16)}
                      color={glass.textPrimary}
                    />
                  </View>
                  <Text style={styles.voteMetaLabel}>Анкета</Text>
                </View>
                <View style={styles.deadlinePill}>
                  <Ionicons name="time-outline" size={rs(14, 13)} color={palette.orange} />
                  <Text style={styles.deadlineText}>{MOCK_VOTE.activeUntil}</Text>
                </View>
              </View>

              <Text style={styles.pageLabel}>
                Страница {page + 1} от {pages.length}
              </Text>
              <View style={styles.segments}>
                {pages.map((_, i) => (
                  <View key={i} style={styles.segment}>
                    <GlowBar
                      pct={i <= page ? 100 : 0}
                      filterId={`vote-segment-${i}`}
                      height={rs(8, 7)}
                    />
                  </View>
                ))}
              </View>

              <Text style={styles.question}>{current.question}</Text>
              <Text style={styles.hint}>{current.hint}</Text>

              <View style={styles.ratings}>
                {current.rows.map((row) => (
                  <RatingScale
                    key={row.id}
                    row={row}
                    value={ratings[row.id]}
                    onRate={(score) => setRatings((prev) => ({ ...prev, [row.id]: score }))}
                  />
                ))}
              </View>

              <View style={styles.footerRow}>
                <PressableScale
                  haptic={false}
                  onPress={goBack}
                  accessibilityRole="button"
                  accessibilityLabel="Назад"
                  style={styles.backButton}
                >
                  <Ionicons name="arrow-back" size={rs(16, 15)} color={glass.textPrimary} />
                  <Text style={styles.backLabel}>Назад</Text>
                </PressableScale>
                <PressableScale
                  haptic={false}
                  onPress={goNext}
                  accessibilityRole="button"
                  accessibilityLabel={isLast ? 'Гласувай' : 'Продължи'}
                  style={styles.cta}
                >
                  <Text style={styles.ctaLabel}>{isLast ? 'Гласувай' : 'Продължи'}</Text>
                  <Ionicons name="arrow-forward" size={rs(18, 16)} color={palette.white} />
                </PressableScale>
              </View>
            </GlassView>
          </Animated.View>
        )}
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
    fontSize: rs(15, 14),
    lineHeight: rs(22, 20),
    color: glass.textSecondary,
  },
  voteCard: {
    padding: rs(18, 15),
    gap: rs(14, 12),
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
  pageLabel: {
    fontSize: rs(13, 12),
    fontWeight: '500',
    color: glass.textSecondary,
  },
  segments: {
    flexDirection: 'row',
    gap: rs(8, 6),
  },
  segment: {
    flex: 1,
  },
  question: {
    fontSize: rs(19, 17),
    fontWeight: '700',
    lineHeight: rs(26, 24),
    color: glass.textPrimary,
    marginTop: rs(4, 3),
  },
  hint: {
    fontSize: rs(13, 12),
    lineHeight: rs(19, 17),
    color: glass.textSecondary,
  },
  ratings: {
    gap: rs(10, 8),
  },
  ratingRow: {
    gap: rs(10, 8),
    paddingVertical: rs(12, 10),
    paddingHorizontal: rs(14, 12),
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  ratingHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(10, 8),
  },
  ratingIcon: {
    width: rs(34, 30),
    height: rs(34, 30),
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingLabel: {
    fontSize: rs(15, 14),
    fontWeight: '600',
    color: glass.textPrimary,
  },
  scaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: rs(4, 2),
  },
  scaleDot: {
    width: rs(40, 36),
    height: rs(40, 36),
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scaleDotSelected: {
    borderWidth: rs(1.5, 1.5),
    borderColor: palette.white,
    backgroundColor: 'rgba(255,255,255,0.18)',
    ...Platform.select({
      ios: {
        shadowColor: '#FFFFFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 8,
      },
      android: {
        elevation: 5,
      },
      default: {},
    }),
  },
  scaleText: {
    fontSize: rs(15, 14),
    fontWeight: '600',
    color: glass.textSecondary,
  },
  scaleTextSelected: {
    color: glass.textPrimary,
    fontWeight: '700',
  },
  thanksCard: {
    padding: rs(24, 20),
    alignItems: 'center',
    gap: rs(14, 12),
  },
  thanksIcon: {
    width: rs(72, 64),
    height: rs(72, 64),
    borderRadius: 999,
    borderWidth: rs(1.5, 1.5),
    borderColor: 'rgba(255,255,255,0.7)',
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#FFFFFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.7,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
      default: {},
    }),
  },
  thanksCta: {
    flex: 0,
    alignSelf: 'stretch',
    marginTop: rs(6, 4),
  },
  thanksTitle: {
    fontSize: rs(21, 19),
    fontWeight: '700',
    letterSpacing: -0.3,
    color: glass.textPrimary,
    textAlign: 'center',
  },
  thanksBody: {
    fontSize: rs(14, 13),
    lineHeight: rs(21, 19),
    color: glass.textSecondary,
    textAlign: 'center',
    maxWidth: rs(300, 270),
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: rs(10, 8),
    marginTop: rs(4, 2),
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(8, 6),
    minHeight: metrics.buttonHeight,
    paddingHorizontal: rs(22, 18),
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  backLabel: {
    fontSize: rs(15, 14),
    fontWeight: '600',
    color: glass.textPrimary,
  },
  cta: {
    flex: 1,
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
});
