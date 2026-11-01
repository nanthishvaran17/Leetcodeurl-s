// frontend/src/components/AnimatedNumber.tsx
import React from 'react';
import { useCountUp } from '../utils/useCountUp';

interface AnimatedNumberProps {
  value: number | string;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  duration = 550,
  decimals = 0,
  prefix = '',
  suffix = '',
  className = ''
}) => {
  let targetNum = 0;
  let isNumeric = true;
  let inferredPrefix = '';
  let inferredSuffix = '';

  if (typeof value === 'number') {
    targetNum = isNaN(value) ? 0 : value;
  } else if (typeof value === 'string') {
    const cleanNum = parseFloat(value.replace(/[^0-9.-]+/g, ''));
    if (isNaN(cleanNum)) {
      isNumeric = false;
    } else {
      targetNum = cleanNum;
      if (value.startsWith('+')) inferredPrefix = '+';
      if (value.includes('%')) inferredSuffix = '%';
    }
  } else {
    isNumeric = false;
  }

  // Hook called unconditionally at the top on every render
  const animated = useCountUp(targetNum, duration, decimals);

  if (!isNumeric) {
    return <span className={className}>{String(value ?? '')}</span>;
  }

  const finalPrefix = prefix || inferredPrefix;
  const finalSuffix = suffix || inferredSuffix;

  return (
    <span className={className}>
      {finalPrefix}{animated.toLocaleString()}{finalSuffix}
    </span>
  );
};
