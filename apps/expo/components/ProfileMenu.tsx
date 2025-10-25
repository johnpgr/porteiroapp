import React, { ReactNode, useMemo } from 'react';
import { Modal, Pressable, View, TouchableOpacity, Text, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Placement = 'top-right' | 'top-left';

export interface ProfileMenuItem {
  label: string;
  onPress: () => void;
  iconName?: keyof typeof Ionicons.glyphMap;
  icon?: ReactNode;
  iconColor?: string;
  destructive?: boolean;
}

export interface ProfileMenuProps {
  visible: boolean;
  onClose: () => void;
  items: ProfileMenuItem[];
  placement?: Placement;
}

const ProfileMenu: React.FC<ProfileMenuProps> = ({
  visible, onClose, items, placement = 'top-right',
}) => {
  const overlayStyle = useMemo(
    () => [styles.overlay, placement === 'top-left' ? styles.overlayLeft : styles.overlayRight], [placement]
  );

  const wrapperStyle = placement === 'top-left' ? styles.wrapperLeft : styles.wrapperRight;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={overlayStyle}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View pointerEvents="box-none" style={wrapperStyle}>
          <View style={styles.menuContainer}>
            {items.map((item, index) => (
              <React.Fragment key={`${item.label}-${index}`}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.menuItem}
                  onPress={() => {
                    onClose();
                    item.onPress();
                  }}
                >
                  {(item.icon || item.iconName) && (
                    <View style={styles.iconContainer}>
                      {item.icon ? (
                        item.icon
                      ) : (
                        <Ionicons
                          name={item.iconName!}
                          size={20}
                          color={item.iconColor ?? (item.destructive ? '#f44336' : '#333')}
                        />
                      )}
                    </View>
                  )}
                  <Text style={[styles.menuLabel, item.destructive && styles.destructiveLabel]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
                {index < items.length - 1 ? <View style={styles.divider} /> : null}
              </React.Fragment>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default ProfileMenu;

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-start', }, overlayRight: {
    alignItems: 'flex-end', paddingTop: 80, paddingRight: 20, }, overlayLeft: {
    alignItems: 'flex-start', paddingTop: 80, paddingLeft: 20, }, wrapperRight: {
    width: '100%', alignItems: 'flex-end', }, wrapperLeft: {
    width: '100%', alignItems: 'flex-start', }, menuContainer: {
    backgroundColor: '#fff', borderRadius: 12, minWidth: 200, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5, }, menuItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 18, }, iconContainer: {
    width: 28, height: 28, justifyContent: 'center', alignItems: 'center', marginRight: 12, }, menuLabel: {
    fontSize: 16, color: '#333', }, destructiveLabel: {
    color: '#f44336', }, divider: {
    height: 1, backgroundColor: '#e0e0e0', marginHorizontal: 16, },
});
