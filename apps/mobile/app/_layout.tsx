import { requireOptionalNativeModule } from 'expo';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider } from '../src/theme/ThemeContext';

// Hide the dev-menu floating gear button — it overlays app UI (e.g. the profile
// avatar on home). Works in dev-client builds; in Expo Go the module is not exposed
// to app code, so there it is disabled via the EXDevMenuShowFloatingActionButton
// user default (see docs). Dev menu stays reachable via shake / Cmd+D.
if (__DEV__) {
  void requireOptionalNativeModule<{
    setPreferencesAsync: (settings: { showFloatingActionButton: boolean }) => Promise<void>;
  }>('DevMenuPreferences')?.setPreferencesAsync({ showFloatingActionButton: false });
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        {/* White status bar content: every screen sits on the photo backdrop. */}
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'fade_from_bottom',
            animationDuration: 260,
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="(tabs)" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen
            name="menu"
            options={{
              presentation: 'transparentModal',
              animation: 'fade',
              animationDuration: 200,
            }}
          />
          <Stack.Screen name="messages" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="surveys" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="survey/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="how-to-pay" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="contacts" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="cash" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="kasa" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="deposit" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="history" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="documents" options={{ animation: 'slide_from_right' }} />
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
