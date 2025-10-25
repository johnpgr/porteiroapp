import React from 'react';
import { SafeAreaView as RNSafeAreaView, SafeAreaViewProps } from 'react-native-safe-area-context';

/**
 * Custom SafeAreaView that excludes bottom inset by default.
 * This allows content to extend to the bottom of the screen.
 */
export function SafeAreaView({ edges = ['top', 'left', 'right'], ...props }: SafeAreaViewProps) {
  return <RNSafeAreaView edges={edges} {...props} />;
}
