import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { metrics, rs } from '../theme/responsive';
import { glass } from '../theme/tokens';
import { AppBackground } from './AppBackground';
import { GlassCircleButton } from './GlassCircleButton';

interface Props {
  title: string;
  children: React.ReactNode;
}

/** Stack screen scaffold: blurred photo backdrop, glass back button, title, content. */
export function SubScreen({ title, children }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <AppBackground variant="blur" />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + rs(16, 8), paddingBottom: insets.bottom + rs(32, 24) },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.backRow}>
          <GlassCircleButton
            icon="arrow-back"
            onPress={() => router.back()}
            accessibilityLabel="Назад"
          />
        </View>

        <Animated.Text entering={FadeInDown.duration(400).delay(60)} style={styles.title}>
          {title}
        </Animated.Text>

        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: metrics.screenPadding,
    gap: rs(20, 15),
  },
  backRow: {
    alignSelf: 'flex-start',
  },
  title: {
    fontSize: metrics.titleSize,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: glass.textPrimary,
  },
});
