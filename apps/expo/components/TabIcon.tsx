import React from 'react';
import { IconSymbol } from '~/components/ui/IconSymbol';

export interface TabIconProps {
  name: string;
  color: string;
  focused?: boolean;
  size?: number;
}

const iconMap: Record<string, Parameters<typeof IconSymbol>[0]['name']> = {
  home: 'house.fill',
  users: 'person.2.fill',
  clipboard: 'list.bullet.rectangle',
  bell: 'bell.fill',
  dashboard: 'chart.bar.fill',
  logs: 'doc.text',
  file: 'doc.text',
  'log-in': 'rectangle.portrait.and.arrow.right',
  'badge-check': 'checkmark.seal.fill',
  search: 'magnifyingglass',
  list: 'list.bullet',
  'scroll-text': 'doc.text',
  phone: 'phone.fill',
};

export default function TabIcon({ name, color, focused, size = 24 }: TabIconProps) {
  const mapped = iconMap[name] || 'doc.text';
  return <IconSymbol name={mapped} color={color} size={size} weight={focused ? 'bold' : 'regular'} />;
}
