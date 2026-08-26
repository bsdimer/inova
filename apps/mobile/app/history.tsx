import React from 'react';
import { ComingSoon } from '../src/components/ComingSoon';
import { SubScreen } from '../src/components/SubScreen';

// TODO(M3+): building event timeline (charges, payments, issues, notices).
export default function History() {
  return (
    <SubScreen title="История">
      <ComingSoon icon="time-outline" />
    </SubScreen>
  );
}
