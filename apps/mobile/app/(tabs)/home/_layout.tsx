import { Stack } from 'expo-router';
import React from 'react';

/** Home tab stack. Pushed screens that hide the tab bar live on the root stack. */
export default function HomeLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: 'transparent' },
      }}
    />
  );
}
