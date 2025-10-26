import React, { useEffect, useImperativeHandle, forwardRef } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Modal } from '~/components/Modal';
import {
  GestureDetector,
  Gesture,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface BottomSheetModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  snapPoints?: number; // Percentage of screen height (0-100)
}

export interface BottomSheetModalRef {
  close: () => void;
}

const BottomSheetModal = forwardRef<BottomSheetModalRef, BottomSheetModalProps>(
  ({ visible, onClose, children, snapPoints = 40 }, ref) => {
    const insets = useSafeAreaInsets();
    const translateY = useSharedValue(SCREEN_HEIGHT);
    const backdropOpacity = useSharedValue(0);
    const context = useSharedValue({ y: 0 });

    const sheetHeight = (SCREEN_HEIGHT * snapPoints) / 100;
    const CLOSE_THRESHOLD = 150; // Distance to drag before closing
    const VELOCITY_THRESHOLD = 500; // Velocity threshold for quick swipe

    const closeSheet = () => {
      backdropOpacity.value = withTiming(0, {
        duration: 250,
        easing: Easing.in(Easing.ease),
      });
      translateY.value = withTiming(
        SCREEN_HEIGHT,
        {
          duration: 250,
          easing: Easing.in(Easing.cubic),
        },
        () => {
          runOnJS(onClose)();
        }
      );
    };

    // Expose close method to parent
    useImperativeHandle(ref, () => ({
      close: closeSheet,
    }));

    useEffect(() => {
      if (visible) {
        // Animate in - smooth slide up
        backdropOpacity.value = withTiming(0.5, {
          duration: 300,
          easing: Easing.out(Easing.ease),
        });
        translateY.value = withTiming(0, {
          duration: 300,
          easing: Easing.out(Easing.cubic),
        });
      } else {
        // Animate out - smooth slide down
        backdropOpacity.value = withTiming(0, {
          duration: 250,
          easing: Easing.in(Easing.ease),
        });
        translateY.value = withTiming(SCREEN_HEIGHT, {
          duration: 250,
          easing: Easing.in(Easing.cubic),
        });
      }
    }, [visible]);

    // Pan gesture for the handle bar (high priority)
    const handlePanGesture = Gesture.Pan()
      .activeOffsetY([-10, 10]) // Activate when dragging vertically by 10px in either direction
      .failOffsetX([-10, 10]) // Fail if dragging horizontally
      .onStart(() => {
        context.value = { y: translateY.value };
      })
      .onUpdate((event) => {
        // Allow dragging in both directions but only translate down
        if (event.translationY > 0) {
          translateY.value = context.value.y + event.translationY;
          // Reduce backdrop opacity as user drags
          const progress = Math.min(event.translationY / sheetHeight, 1);
          backdropOpacity.value = 0.5 * (1 - progress);
        }
      })
      .onEnd((event) => {
        const shouldClose =
          event.translationY > CLOSE_THRESHOLD || event.velocityY > VELOCITY_THRESHOLD;

        if (shouldClose) {
          // Close the sheet
          runOnJS(closeSheet)();
        } else {
          // Snap back to original position
          translateY.value = withTiming(0, {
            duration: 200,
            easing: Easing.out(Easing.cubic),
          });
          backdropOpacity.value = withTiming(0.5, {
            duration: 200,
            easing: Easing.out(Easing.ease),
          });
        }
      });

    // Pan gesture for the entire sheet (lower priority)
    const sheetPanGesture = Gesture.Pan()
      .onStart(() => {
        context.value = { y: translateY.value };
      })
      .onUpdate((event) => {
        // Only allow dragging down
        if (event.translationY > 0) {
          translateY.value = context.value.y + event.translationY;
          // Reduce backdrop opacity as user drags
          const progress = Math.min(event.translationY / sheetHeight, 1);
          backdropOpacity.value = 0.5 * (1 - progress);
        }
      })
      .onEnd((event) => {
        const shouldClose =
          event.translationY > CLOSE_THRESHOLD || event.velocityY > VELOCITY_THRESHOLD;

        if (shouldClose) {
          // Close the sheet
          runOnJS(closeSheet)();
        } else {
          // Snap back to original position
          translateY.value = withTiming(0, {
            duration: 200,
            easing: Easing.out(Easing.cubic),
          });
          backdropOpacity.value = withTiming(0.5, {
            duration: 200,
            easing: Easing.out(Easing.ease),
          });
        }
      })
      .enabled(false); // Disable sheet pan for now to avoid conflicts with ScrollView

    const animatedSheetStyle = useAnimatedStyle(() => ({
      transform: [{ translateY: translateY.value }],
    }));

    const animatedBackdropStyle = useAnimatedStyle(() => ({
      opacity: backdropOpacity.value,
    }));

    if (!visible) return null;

    return (
      <Modal
        visible={visible}
        transparent
        animationType="none"
        statusBarTranslucent
        safeAreaEdges={[]}
        onRequestClose={closeSheet}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <View style={styles.container}>
            {/* Custom Backdrop */}
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={closeSheet}>
              <Animated.View style={[styles.backdrop, animatedBackdropStyle]} />
            </TouchableOpacity>

            {/* Bottom Sheet */}
            <Animated.View
              style={[
                styles.sheet,
                {
                  height: sheetHeight,
                  maxHeight: SCREEN_HEIGHT * 0.9,
                  paddingBottom: Math.max(insets.bottom, 16),
                },
                animatedSheetStyle,
              ]}>
              {/* Drag Handle - Separate GestureDetector for better control */}
              <GestureDetector gesture={handlePanGesture}>
                <View style={styles.handleContainer}>
                  <View style={styles.handle} />
                </View>
              </GestureDetector>

              {/* Content */}
              <View style={styles.content}>{children}</View>
            </Animated.View>
          </View>
        </GestureHandlerRootView>
      </Modal>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  handle: {
    width: 40,
    height: 5,
    backgroundColor: '#D1D5DB',
    borderRadius: 3,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
});

export default BottomSheetModal;
