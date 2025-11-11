// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  // Navigation / common
  'house.fill': 'home',
  'chevron.right': 'chevron-right',
  'chevron.left': 'chevron-left',
  'magnifyingglass': 'search',

  // Status / actions
  'checkmark.circle.fill': 'check-circle',
  'exclamationmark.circle.fill': 'error',
  'bell.fill': 'notifications',
  'trash.fill': 'delete',
  'play.circle.fill': 'play-circle-filled',
  'stop.circle.fill': 'stop',
  'rectangle.portrait.and.arrow.right': 'login',

  // People
  'person': 'person',
  'person.fill': 'person',
  'person.2.fill': 'people',

  // Time / media
  'clock.fill': 'schedule',
  'mic': 'mic',
  'mic.slash.fill': 'mic-off',
  'speaker.wave.3.fill': 'volume-up',
  'speaker.slash.fill': 'volume-off',

  // Files / data
  'doc.text': 'description',
  'list.bullet': 'list',
  'list.bullet.rectangle': 'assignment',
  'chart.bar.fill': 'insert-chart',
  'checkmark.seal.fill': 'verified',

  // Phone
  'phone.fill': 'phone',
  'phone.down.fill': 'call-end',
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
