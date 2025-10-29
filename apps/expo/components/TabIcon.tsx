import React from 'react';
import { BarChart3, Bell, ClipboardList, FileText, Home, Users } from 'lucide-react-native';

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
};

export default function TabIcon({ name, color, focused, size = 24 }: TabIconProps) {
  const Icon = iconMap[name] || FileText;
  return <Icon color={color} size={size} strokeWidth={focused ? 2.5 : 2} />;
}
