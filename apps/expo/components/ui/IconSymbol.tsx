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
  'chevron.down': 'keyboard-arrow-down',
  'magnifyingglass': 'search',

  // Status / actions
  'checkmark.circle.fill': 'check-circle',
  'exclamationmark.circle.fill': 'error',
  'exclamationmark.triangle.fill': 'warning',
  'questionmark.circle.fill': 'help',
  'info.circle.fill': 'info',
  'bell.fill': 'notifications',
  'trash.fill': 'delete',
  'pencil': 'edit',
  'star.fill': 'star',
  'play.circle.fill': 'play-circle-filled',
  'stop.circle.fill': 'stop',
  'rectangle.portrait.and.arrow.right': 'login',

  // People
  'person': 'person',
  'person.fill': 'person',
  'person.2.fill': 'people',
  'person.badge.key.fill': 'work',
  'shield.fill': 'security',

  // Time / media
  'clock.fill': 'schedule',
  'hourglass': 'hourglass-empty',
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
  'envelope.fill': 'mail',
  'envelope': 'mail-outline',
  'building.2.fill': 'business',
  'shippingbox.fill': 'inventory',
  'tag.fill': 'local-offer',
  'paintpalette.fill': 'palette',

  // Phone
  'phone.fill': 'phone',
  'phone.down.fill': 'call-end',

  // Vehicles
  'car.fill': 'directions-car',
  'bicycle': 'motorcycle',
  'truck.box.fill': 'local-shipping',
  'car.2.fill': 'airport-shuttle',
  'bus': 'directions-bus',
  'lightbulb.fill': 'lightbulb',
  
  // Tools / maintenance
  'wrench.fill': 'build',
  
  // Communication
  'megaphone.fill': 'campaign',
  
  // Events / celebration
  'party.popper.fill': 'celebration',
  
  // Voting / polls
  'checkmark.square.fill': 'how-to-vote',
  
  // Additional icons
  'checkmark': 'check',
  'camera.fill': 'camera-alt',
  'chevron.up': 'keyboard-arrow-up',
  'lock.fill': 'lock',
  'xmark.circle.fill': 'cancel',
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
