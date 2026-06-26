import React from 'react';
import { View, Text } from 'react-native';
import { cn } from './cn';

const variantClasses = {
  default: 'bg-primary',
  primary: 'bg-primary',
  secondary: 'bg-accent',
  accent: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  error: 'bg-danger',
  muted: 'bg-surface-muted',
  softSuccess: 'bg-primary-soft',
  softDanger: 'bg-danger/10',
  softWarning: 'bg-warning/10',
  softPrimary: 'bg-primary-soft',
  softAccent: 'bg-accent-soft',
  softSecondary: 'bg-accent-soft',
  softInfo: 'bg-info/10',
};

const textVariantClasses = {
  default: 'text-white',
  primary: 'text-white',
  secondary: 'text-white',
  accent: 'text-white',
  success: 'text-white',
  warning: 'text-white',
  danger: 'text-white',
  error: 'text-white',
  muted: 'text-text',
  softSuccess: 'text-primary-dark',
  softDanger: 'text-danger',
  softWarning: 'text-warning',
  softPrimary: 'text-primary-dark',
  softAccent: 'text-accent-dark',
  softSecondary: 'text-accent-dark',
  softInfo: 'text-info',
};

export function Badge({ variant = 'default', className, textClassName, leftIcon, children }) {
  return (
    <View className={cn('px-2.5 py-1 rounded-full self-start flex-row items-center', variantClasses[variant], className)}>
      {leftIcon ? <View className="mr-1">{leftIcon}</View> : null}
      <Text className={cn('text-[11px] font-bold tracking-wide', textVariantClasses[variant], textClassName)}>{children}</Text>
    </View>
  );
}
