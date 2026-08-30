import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, SlideInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { logout } from '../src/api/client';
import { GlassView } from '../src/components/GlassView';
import { GradientButton } from '../src/components/GradientButton';
import { PressableScale } from '../src/components/PressableScale';
import { useTheme, type ThemeMode } from '../src/theme/ThemeContext';
import { metrics, rs, screen } from '../src/theme/responsive';
import { glass, palette } from '../src/theme/tokens';

type IconName = keyof typeof Ionicons.glyphMap;

const NAV_ROWS: { icon: IconName; label: string; route: Href }[] = [
  { icon: 'home', label: 'Начало', route: '/home' },
  { icon: 'business', label: 'Сгради', route: '/building' },
  { icon: 'alert-circle', label: 'Сигнали', route: '/issues' },
  { icon: 'chatbox-ellipses', label: 'Известия', route: '/messages' },
  { icon: 'checkbox', label: 'Анкети', route: '/surveys' },
];

const THEME_LABELS: Record<ThemeMode, string> = {
  system: 'Системна',
  light: 'Светла',
  dark: 'Тъмна',
};
const THEME_ORDER: ThemeMode[] = ['system', 'light', 'dark'];

const SHEET_WIDTH = Math.min(screen.width * 0.78, 340);

export default function Menu() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { mode, setMode } = useTheme();
  // TODO(M5): wire to packages/i18n once bg/en extraction lands.
  const [language, setLanguage] = useState<'bg' | 'en'>('bg');

  const cycleTheme = () => {
    setMode(THEME_ORDER[(THEME_ORDER.indexOf(mode) + 1) % THEME_ORDER.length]);
  };

  const row = (icon: IconName, label: string, onPress: () => void, trailing?: React.ReactNode) => (
    <PressableScale
      key={label}
      haptic={false}
      onPress={onPress}
      style={styles.row}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={rs(22, 20)} color={palette.goldBlack} />
      <Text style={styles.rowLabel}>{label}</Text>
      {trailing}
    </PressableScale>
  );

  return (
    <View style={styles.container}>
      {/* Dimmed slice of the underlying screen — tap to close. */}
      <Animated.View entering={FadeIn.duration(200)} style={StyleSheet.absoluteFill}>
        <Pressable
          style={styles.backdrop}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Затвори менюто"
        />
      </Animated.View>

      {/* Timed ease-out slide: a spring here overshoots the resting position
          and briefly detaches the sheet from the screen edge. */}
      <Animated.View
        entering={SlideInRight.duration(320).easing(Easing.out(Easing.cubic))}
        style={styles.sheetWrap}
      >
        <GlassView
          rounded={0}
          intensity={70}
          overlayColor={glass.sheetFill}
          borderColor={glass.sheetStroke}
          style={styles.sheet}
          contentStyle={styles.sheetContent}
        >
          <ScrollView
            contentContainerStyle={[
              styles.scroll,
              { paddingTop: insets.top + rs(40, 30), paddingBottom: insets.bottom + rs(20, 14) },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.rows}>
              {NAV_ROWS.map((item) => row(item.icon, item.label, () => router.replace(item.route)))}
            </View>

            <View style={styles.divider} />

            <View style={styles.rows}>
              {row(
                'earth',
                'Избор на език',
                () => setLanguage((prev) => (prev === 'bg' ? 'en' : 'bg')),
                <View style={styles.trailing}>
                  <Text style={styles.trailingValue}>{language === 'bg' ? 'БГ' : 'EN'}</Text>
                  <Ionicons name="chevron-forward" size={rs(17, 15)} color={palette.landmark} />
                </View>,
              )}
              {row('card', 'Как да платя?', () => router.replace('/how-to-pay'))}
              {row('headset', 'Контакти', () => router.replace('/contacts'))}
              {row(
                'color-palette',
                'Тема',
                cycleTheme,
                <View style={styles.trailing}>
                  <Text style={styles.trailingValue}>{THEME_LABELS[mode]}</Text>
                  <Ionicons name="chevron-forward" size={rs(17, 15)} color={palette.landmark} />
                </View>,
              )}
            </View>

            <View style={styles.spacer} />

            <GradientButton
              label="Излез от профила"
              variant="dark"
              icon="log-out-outline"
              onPress={() => {
                void logout().finally(() => router.replace('/'));
              }}
            />
          </ScrollView>
        </GlassView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(29,29,31,0.3)',
  },
  sheetWrap: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: SHEET_WIDTH,
  },
  sheet: {
    flex: 1,
    borderTopLeftRadius: rs(38, 32),
    borderBottomLeftRadius: rs(38, 32),
  },
  sheetContent: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: rs(28, 22),
  },
  rows: {
    gap: rs(6, 4),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(16, 13),
    paddingVertical: rs(14, 11),
  },
  rowLabel: {
    flex: 1,
    fontSize: rs(17, 15),
    fontWeight: '600',
    color: palette.goldBlack,
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(4, 3),
  },
  trailingValue: {
    fontSize: metrics.captionSize,
    fontWeight: '600',
    color: palette.landmark,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(29,29,31,0.25)',
    marginVertical: rs(18, 14),
  },
  spacer: {
    flexGrow: 1,
    minHeight: rs(24, 18),
  },
});
