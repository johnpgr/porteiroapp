import React from 'react';
import { BarChart3, Bell, ClipboardList, FileText, Home, Users, LogIn, BadgeCheck, Search, List, ScrollText, Phone } from 'lucide-react-native';

export interface TabIconProps {
  name: string;
  color: string;
  focused?: boolean;
  size?: number;
}

const iconMap: Record<string, any> = {
  home: Home,
  users: Users,
  clipboard: ClipboardList,
  bell: Bell,
  dashboard: BarChart3,
  logs: FileText,
  file: FileText,
  'log-in': LogIn,
  'badge-check': BadgeCheck,
  search: Search,
  list: List,
  'scroll-text': ScrollText,
  phone: Phone,
};

export default function TabIcon({ name, color, focused, size = 24 }: TabIconProps) {
  const Icon = iconMap[name] || FileText;
  return <Icon color={color} size={size} strokeWidth={focused ? 2.5 : 2} />;
}
