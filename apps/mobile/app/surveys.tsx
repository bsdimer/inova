import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppBackground } from '../src/components/AppBackground';
import { ArrowBubble } from '../src/components/ArrowBubble';
import { GlassCircleButton } from '../src/components/GlassCircleButton';
import { GlassView } from '../src/components/GlassView';
import { PressableScale } from '../src/components/PressableScale';
import { BrandLockup } from '../src/components/InovaLogo';
import { VoteRing } from '../src/components/VoteRing';
import { metrics, rs } from '../src/theme/responsive';
import { glass, radius } from '../src/theme/tokens';

type IconName = keyof typeof Ionicons.glyphMap;

interface ActiveSurvey {
  id: string;
  question: string;
  activeUntil: string;
  votedPct: number;
  hasVoted: boolean;
}

interface FinishedSurvey {
  id: string;
  title: string;
  endedOn: string;
  votedPct: number;
  icon: IconName;
}

// TODO(M7+): surveys API with server-side vote tallies and per-resident vote state.
const MOCK = {
  blurb: 'Участвайте в активните анкети и помогнете да вземаме по-добри решения.',
  active: [
    {
      id: 'a1',
      question: 'Как бихте оценили поддръжката на общите части?',
      activeUntil: 'Активна до 18 май 2026',
      votedPct: 68,
      hasVoted: true,
    },
    {
      id: 'a2',
      question: 'Искате ли допълнително видеонаблюдение в гаража?',
      activeUntil: 'Активна до 2 юни 2026',
      votedPct: 41,
      hasVoted: false,
    },
  ] satisfies ActiveSurvey[],
  finished: [
    {
      id: 'f1',
      title: 'Да сложим ли камери във входа',
      endedOn: 'Приключила на 10 апр 2026',
      votedPct: 76,
      icon: 'shield-checkmark-outline' as IconName,
    },
    {
      id: 'f2',
      title: 'Поливна система в градината',
      endedOn: 'Приключила на 22 мар 2026',
      votedPct: 54,
      icon: 'leaf-outline' as IconName,
    },
  ] satisfies FinishedSurvey[],
};

function ActiveCard({ survey, onPress }: { survey: ActiveSurvey; onPress: () => void }) {
  const ringSize = rs(92, 84);

  return (
    <PressableScale
      haptic={false}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={survey.question}
    >
      <GlassView
        rounded={radius.lg}
        intensity={55}
        overlayColor="rgba(255,255,255,0.1)"
        borderColor="rgba(255,255,255,0.35)"
        contentStyle={styles.activeCard}
      >
        <View style={styles.activeTop}>
          <VoteRing pct={survey.votedPct} size={ringSize} filterId={`vote-glow-${survey.id}`} />
          <View style={styles.activeBody}>
            <Text style={styles.activeQuestion}>{survey.question}</Text>
            <View style={styles.deadlineRow}>
              <Ionicons name="calendar-outline" size={rs(14, 13)} color={glass.textSecondary} />
              <Text style={styles.deadlineText}>{survey.activeUntil}</Text>
            </View>
          </View>
        </View>

        <View style={styles.activeBottom}>
          <View style={styles.statusChip}>
            <Ionicons
              name={survey.hasVoted ? 'checkmark-circle-outline' : 'ellipse-outline'}
              size={rs(16, 14)}
              color={glass.textPrimary}
            />
            <Text style={styles.statusText}>
              {survey.hasVoted ? 'Вече сте гласували' : 'Все още не сте гласували'}
            </Text>
          </View>
          <ArrowBubble size={rs(34, 30)} />
        </View>
      </GlassView>
    </PressableScale>
  );
}

function FinishedRow({ survey }: { survey: FinishedSurvey }) {
  return (
    <PressableScale
      haptic={false}
      onPress={() => undefined}
      accessibilityRole="button"
      accessibilityLabel={survey.title}
    >
      <GlassView
        rounded={radius.md}
        intensity={50}
        overlayColor="rgba(255,255,255,0.1)"
        borderColor="rgba(255,255,255,0.32)"
        contentStyle={styles.finishedRow}
      >
        <View style={styles.finishedIcon}>
          <Ionicons name={survey.icon} size={rs(20, 18)} color={glass.textPrimary} />
        </View>
        <View style={styles.finishedTexts}>
          <Text style={styles.finishedTitle} numberOfLines={2}>
            {survey.title}
          </Text>
          <Text style={styles.finishedDate}>{survey.endedOn}</Text>
        </View>
        <View style={styles.finishedPctBlock}>
          <Text style={styles.finishedPct}>{survey.votedPct}%</Text>
          <Text style={styles.finishedPctLabel}>гласували</Text>
        </View>
        <ArrowBubble size={rs(32, 28)} />
      </GlassView>
    </PressableScale>
  );
}

export default function Surveys() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

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
            // No history when opened via deep link — fall back to home.
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/home'))}
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
          <Text style={styles.title}>Анкети</Text>
          <Text style={styles.blurb}>{MOCK.blurb}</Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(420).delay(120)} style={styles.section}>
          <Text style={styles.sectionTitle}>Активни анкети</Text>
          <View style={styles.sectionList}>
            {MOCK.active.map((survey) => (
              <ActiveCard
                key={survey.id}
                survey={survey}
                onPress={() =>
                  router.push(
                    survey.hasVoted ? `/survey/${survey.id}` : `/survey/${survey.id}/vote`,
                  )
                }
              />
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(420).delay(200)} style={styles.section}>
          <Text style={styles.sectionTitle}>Приключили анкети</Text>
          <View style={styles.sectionList}>
            {MOCK.finished.map((survey) => (
              <FinishedRow key={survey.id} survey={survey} />
            ))}
          </View>
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
    gap: rs(8, 6),
  },
  title: {
    fontSize: rs(34, 30),
    fontWeight: '700',
    letterSpacing: -0.4,
    color: glass.textPrimary,
  },
  blurb: {
    fontSize: rs(15, 14),
    lineHeight: rs(22, 20),
    color: glass.textSecondary,
    maxWidth: rs(340, 300),
  },
  section: {
    marginBottom: rs(22, 18),
    gap: rs(12, 10),
  },
  sectionTitle: {
    fontSize: rs(18, 16),
    fontWeight: '700',
    color: glass.textPrimary,
  },
  sectionList: {
    gap: rs(12, 10),
  },
  activeCard: {
    padding: rs(16, 14),
    gap: rs(16, 14),
  },
  activeTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: rs(14, 12),
  },
  activeBody: {
    flex: 1,
    gap: rs(10, 8),
    paddingTop: rs(4, 2),
  },
  activeQuestion: {
    fontSize: rs(17, 15),
    fontWeight: '700',
    lineHeight: rs(24, 22),
    color: glass.textPrimary,
  },
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(6, 5),
  },
  deadlineText: {
    fontSize: rs(13, 12),
    color: glass.textSecondary,
  },
  activeBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: rs(10, 8),
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(8, 6),
    paddingVertical: rs(10, 8),
    paddingHorizontal: rs(14, 12),
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    flexShrink: 1,
  },
  statusText: {
    fontSize: rs(13, 12),
    fontWeight: '600',
    color: glass.textPrimary,
    flexShrink: 1,
  },
  finishedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(12, 10),
    paddingVertical: rs(14, 12),
    paddingHorizontal: rs(14, 12),
  },
  finishedIcon: {
    width: rs(44, 40),
    height: rs(44, 40),
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishedTexts: {
    flex: 1,
    gap: rs(4, 3),
  },
  finishedTitle: {
    fontSize: rs(15, 14),
    fontWeight: '700',
    color: glass.textPrimary,
  },
  finishedDate: {
    fontSize: rs(12, 11),
    color: glass.textSecondary,
  },
  finishedPctBlock: {
    alignItems: 'flex-end',
    minWidth: rs(52, 48),
  },
  finishedPct: {
    fontSize: rs(17, 15),
    fontWeight: '800',
    color: glass.textPrimary,
  },
  finishedPctLabel: {
    fontSize: rs(10, 9),
    color: glass.textSecondary,
  },
});
