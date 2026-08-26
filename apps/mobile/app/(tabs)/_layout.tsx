import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassView } from '../../src/components/GlassView';
import { PressableScale } from '../../src/components/PressableScale';
import { metrics, rs } from '../../src/theme/responsive';
import { glass, palette } from '../../src/theme/tokens';

type IconName = keyof typeof Ionicons.glyphMap;

const TAB_META: Record<string, { label: string; icon: IconName; iconActive: IconName }> = {
  home: { label: 'Начало', icon: 'home-outline', iconActive: 'home' },
  building: { label: 'Сграда', icon: 'business-outline', iconActive: 'business' },
  privileges: { label: 'Привилегии', icon: 'diamond-outline', iconActive: 'diamond' },
  issues: { label: 'Сигнали', icon: 'alert-circle-outline', iconActive: 'alert-circle' },
};

/** Floating liquid-glass tab bar; the active tab sits in a black pill. */
function GlassTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingBottom: Math.max(insets.bottom - rs(6, 4), rs(8, 6)) }]}
    >
      <GlassView
        rounded={999}
        intensity={55}
        overlayColor={glass.fill}
        style={styles.barShadow}
        contentStyle={styles.bar}
      >
        {state.routes.map((route, index) => {
          const meta = TAB_META[route.name];
          if (!meta) return null;
          const focused = state.index === index;
          return (
            <PressableScale
              key={route.key}
              haptic={false}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
              }}
              style={styles.tab}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={meta.label}
            >
              <View style={[styles.item, focused && styles.itemActive]}>
                <Ionicons
                  name={focused ? meta.iconActive : meta.icon}
                  size={rs(22, 20)}
                  color={glass.textPrimary}
                />
                <Text style={[styles.label, focused && styles.labelActive]} numberOfLines={1}>
                  {meta.label}
                </Text>
              </View>
            </PressableScale>
          );
        })}
      </GlassView>
    </View>
  );
}

export default function TabsLayout() {
  return (
    // Cast: expo-router bundles its own copy of @react-navigation/bottom-tabs whose
    // BottomTabBarProps is structurally identical but nominally different from ours.
    <Tabs
      tabBar={(props) => <GlassTabBar {...(props as unknown as BottomTabBarProps)} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="building" />
      <Tabs.Screen name="privileges" />
      <Tabs.Screen name="issues" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: metrics.screenPadding,
  },
  barShadow: {
    shadowColor: palette.goldBlack,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: rs(7, 6),
    paddingHorizontal: rs(8, 6),
  },
  tab: {
    flex: 1,
    alignItems: 'center',
  },
  item: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    gap: rs(3, 2),
    borderRadius: 999,
    paddingVertical: rs(10, 8),
    paddingHorizontal: rs(6, 4),
  },
  itemActive: {
    backgroundColor: palette.goldBlack,
  },
  label: {
    fontSize: rs(11, 10),
    fontWeight: '600',
    color: glass.textPrimary,
  },
  labelActive: {
    fontWeight: '700',
  },
});
