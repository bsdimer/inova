import React from 'react';
import { ComingSoon } from '../src/components/ComingSoon';
import { SubScreen } from '../src/components/SubScreen';

// TODO(M7): notices API + push notifications.
export default function Messages() {
  return (
    <SubScreen title="Известия">
      <ComingSoon icon="notifications-outline" />
    </SubScreen>
  );
}
