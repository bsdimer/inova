import React from 'react';
import { ComingSoon } from '../src/components/ComingSoon';
import { SubScreen } from '../src/components/SubScreen';

// TODO(M3): cash-box — payments, reports and balances from the billing API.
export default function Cash() {
  return (
    <SubScreen title="Каса">
      <ComingSoon icon="wallet-outline" />
    </SubScreen>
  );
}
