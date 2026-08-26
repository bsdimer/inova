import React from 'react';
import { ComingSoon } from '../src/components/ComingSoon';
import { SubScreen } from '../src/components/SubScreen';

// TODO(M3): payment instructions per building (bank transfer, EasyPay, card).
export default function HowToPay() {
  return (
    <SubScreen title="Как да платя?">
      <ComingSoon icon="card-outline" />
    </SubScreen>
  );
}
