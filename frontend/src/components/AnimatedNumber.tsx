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
  // If string contains non-numeric characters like %, $, etc.
  if (typeof value === 'string') {
    // Extract numerical part
    const cleanNum = parseFloat(value.replace(/[^0-9.-]+/g, ''));
    if (!isNaN(cleanNum)) {
      const hasPercent = value.includes('%');
      const hasPlus = value.startsWith('+');
      const animated = useCountUp(cleanNum, duration, decimals);
      
      const formatted = animated.toLocaleString();
      const finalPrefix = prefix || (hasPlus ? '+' : '');
      const finalSuffix = suffix || (hasPercent ? '%' : '');
      
      return (
        <span className={className}>
          {finalPrefix}{formatted}{finalSuffix}
        </span>
      );
    }
    return <span className={className}>{value}</span>;
  }

  const animated = useCountUp(value, duration, decimals);
  return (
    <span className={className}>
      {prefix}{animated.toLocaleString()}{suffix}
    </span>
  );
};
