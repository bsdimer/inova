import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppBackground } from '../../src/components/AppBackground';
import { GlassCircleButton } from '../../src/components/GlassCircleButton';
import { GlassView } from '../../src/components/GlassView';
import { GradientButton } from '../../src/components/GradientButton';
import { BrandLockup } from '../../src/components/SosedoLogo';
import { formatEuro, getExpenseById, type ExpenseDetail } from '../../src/data/cashExpenses';
import { metrics, rs } from '../../src/theme/responsive';
import { darkTheme, glass, radius } from '../../src/theme/tokens';

function DetailRow({
  label,
  value,
  statusDot,
  last,
}: {
  label: string;
  value: string;
  statusDot?: boolean;
  last?: boolean;
}) {
  return (
    <View style={[styles.detailRow, !last && styles.detailRowBorder]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <View style={styles.detailValueWrap}>
        {statusDot ? <View style={styles.statusDot} /> : null}
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

function ExpenseHero({ expense }: { expense: ExpenseDetail }) {
  const iconSize = rs(104, 92);

  return (
    <Animated.View entering={FadeInDown.duration(420).delay(80)} style={styles.hero}>
      <View style={[styles.heroIconGlow, { width: iconSize + 18, height: iconSize + 18 }]}>
        <GlassView
          rounded={999}
          intensity={70}
          overlayColor="rgba(255,255,255,0.16)"
          borderColor="rgba(255,255,255,0.55)"
          style={[styles.heroIconGlass, { width: iconSize, height: iconSize }]}
          contentStyle={[styles.heroIconContent, { width: iconSize, height: iconSize }]}
        >
          <Ionicons name={expense.icon} size={rs(44, 38)} color={glass.textPrimary} />
        </GlassView>
      </View>
      <Text style={styles.heroName}>{expense.name}</Text>
      <Text style={styles.heroAmount}>{formatEuro(expense.amount)}</Text>
    </Animated.View>
  );
}

export default function CashExpenseDetail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const expense = useMemo(() => (id ? getExpenseById(id) : undefined), [id]);

  if (!expense) {
    return (
      <View style={styles.container}>
        <AppBackground variant="blur" />
        <View style={[styles.missing, { paddingTop: insets.top + rs(24, 18) }]}>
          <GlassCircleButton
            icon="arrow-back"
            onPress={() => router.back()}
            accessibilityLabel="Назад"
          />
          <Text style={styles.missingText}>Разходът не е намерен</Text>
        </View>
      </View>
    );
  }

  const statusLabel = expense.status === 'paid' ? 'Платено' : 'Очаква плащане';

  return (
    <View style={styles.container}>
      <AppBackground variant="blur" />
      <View style={styles.darkScrim} pointerEvents="none" />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: insets.top + rs(18, 14),
            paddingBottom: insets.bottom + rs(28, 22),
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
            <BrandLockup />
          </View>
          <GlassCircleButton
            icon="ellipsis-horizontal"
            size={rs(50, 46)}
            onPress={() => router.push('/menu')}
            accessibilityLabel="Отвори менюто"
          />
        </Animated.View>

        <ExpenseHero expense={expense} />

        <Animated.View entering={FadeInUp.duration(420).delay(140)}>
          <GlassView
            rounded={radius.lg}
            intensity={55}
            overlayColor="rgba(255,255,255,0.1)"
            borderColor="rgba(255,255,255,0.35)"
            contentStyle={styles.detailsCard}
          >
            <DetailRow label="Период" value={expense.period} />
            <DetailRow label="Доставчик" value={expense.supplier} />
            <DetailRow label="Номер на фактура" value={expense.invoiceNumber} />
            <DetailRow label="Статус" value={statusLabel} statusDot={expense.status === 'paid'} />
            <DetailRow label="Начин на плащане" value={expense.paymentMethod} />
            <DetailRow label="Дата на плащане" value={expense.paymentDate} last />
          </GlassView>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(420).delay(200)} style={styles.descWrap}>
          <GlassView
            rounded={radius.lg}
            intensity={55}
            overlayColor="rgba(255,255,255,0.1)"
            borderColor="rgba(255,255,255,0.35)"
            contentStyle={styles.descCard}
          >
            <Text style={styles.descTitle}>Описание</Text>
            <Text style={styles.descBody}>{expense.description}</Text>
          </GlassView>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(420).delay(260)} style={styles.cta}>
          <GradientButton label="Виж фактура" variant="dark" onPress={() => undefined} />
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
    flexGrow: 1,
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
  hero: {
    alignItems: 'center',
    marginTop: rs(28, 22),
    marginBottom: rs(28, 22),
    gap: rs(10, 8),
  },
  heroIconGlow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: rs(6, 4),
    // Soft outer bloom so the disc feels lit, not flat.
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  heroIconGlass: {
    overflow: 'hidden',
  },
  heroIconContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroName: {
    fontSize: rs(22, 19),
    fontWeight: '600',
    color: glass.textPrimary,
  },
  heroAmount: {
    fontSize: rs(40, 34),
    fontWeight: '800',
    letterSpacing: -0.5,
    color: glass.textPrimary,
  },
  detailsCard: {
    paddingHorizontal: rs(18, 15),
    paddingVertical: rs(6, 4),
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: rs(12, 10),
    paddingVertical: rs(14, 12),
  },
  detailRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.18)',
  },
  detailLabel: {
    flexShrink: 0,
    fontSize: rs(14, 13),
    color: glass.textSecondary,
  },
  detailValueWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: rs(8, 6),
  },
  detailValue: {
    fontSize: rs(14, 13),
    fontWeight: '600',
    color: glass.textPrimary,
    textAlign: 'right',
    flexShrink: 1,
  },
  statusDot: {
    width: rs(8, 7),
    height: rs(8, 7),
    borderRadius: 999,
    backgroundColor: darkTheme.success,
  },
  descWrap: {
    marginTop: rs(14, 12),
  },
  descCard: {
    padding: rs(18, 15),
    gap: rs(10, 8),
  },
  descTitle: {
    fontSize: rs(17, 15),
    fontWeight: '700',
    color: glass.textPrimary,
  },
  descBody: {
    fontSize: rs(14, 13),
    lineHeight: rs(22, 20),
    color: glass.textSecondary,
  },
  cta: {
    marginTop: 'auto',
    paddingTop: rs(28, 22),
  },
  missing: {
    paddingHorizontal: metrics.screenPadding,
    gap: rs(24, 18),
  },
  missingText: {
    fontSize: rs(17, 15),
    color: glass.textSecondary,
  },
});
