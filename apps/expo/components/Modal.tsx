import React from 'react';
import { Modal as RNModal, ModalProps, StyleProp, ViewStyle } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';
import { SafeAreaView } from './SafeAreaView';

type SafeEdges = Edge[];

type Props = ModalProps & {
  children: React.ReactNode;
  /**
   * Customize which safe area edges are applied inside the modal.
   * Defaults to only the top inset so the modal header clears the status bar.
   */
  safeAreaEdges?: SafeEdges;
  /**
   * Additional style to apply to the SafeAreaView wrapper.
   */
  safeAreaStyle?: StyleProp<ViewStyle>;
};

export function Modal({
  children,
  safeAreaEdges = ['top'],
  safeAreaStyle,
  ...modalProps
}: Props) {
  return (
    <RNModal {...modalProps}>
      <SafeAreaView edges={safeAreaEdges} style={[{ flex: 1 }, safeAreaStyle]}>
        {children}
      </SafeAreaView>
    </RNModal>
  );
}

export default Modal;
