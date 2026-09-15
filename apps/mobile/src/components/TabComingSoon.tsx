import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { metrics, rs } from '../theme/responsive';
import { glass } from '../theme/tokens';
import { AppBackground } from './AppBackground';
import { ComingSoon } from './ComingSoon';
import { GlassCircleButton } from './GlassCircleButton';
import { BrandLockup } from './InovaLogo';

interface Props {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
}

/** Tab screen that isn't designed yet: brand header + coming-soon card. */
export function TabComingSoon({ title, icon }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <AppBackground variant="hero" />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + rs(16, 10), paddingBottom: insets.bottom + rs(116, 102) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <BrandLockup />
          <GlassCircleButton
            icon="ellipsis-horizontal"
            onPress={() => router.push('/menu')}
            accessibilityLabel="Отвори менюто"
          />
        </View>

        <Animated.Text entering={FadeInDown.duration(400).delay(60)} style={styles.title}>
          {title}
        </Animated.Text>

        <ComingSoon icon={icon} />
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
  title: {
    marginTop: rs(34, 26),
    fontSize: rs(30, 26),
    fontWeight: '800',
    letterSpacing: -0.4,
    color: glass.textPrimary,
  },
});
