import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { IconSymbol } from '~/components/ui/IconSymbol';

interface FloatingCallButtonProps {
  onPress: () => void;
  color?: string;
  size?: number;
  iconColor?: string;
  style?: object;
}

/**
 * Floating Action Button for initiating intercom calls
 * Used by both morador (to call porteiro) and porteiro (to call apartment)
 */
export function FloatingCallButton({
  onPress,
  color = '#4CAF50',
  size = 60,
  iconColor = '#ffffff',
  style,
}: FloatingCallButtonProps) {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        style={[
          styles.button,
          {
            backgroundColor: color,
            width: size,
            height: size,
            borderRadius: size / 2,
          },
        ]}
        onPress={handlePress}
        activeOpacity={0.8}>
        <IconSymbol name="phone.fill" color={iconColor} size={size * 0.45} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    zIndex: 100,
  },
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
});

export default FloatingCallButton;
