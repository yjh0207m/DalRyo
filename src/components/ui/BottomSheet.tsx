import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { motion } from '../../navigation/motion';
import { colors, spacing, themedStyles } from '../../theme';
import { AppText } from './AppText';
import { IconButton } from './IconButton';

type Close = (next?: () => void) => void;
type Props = {
  title: string;
  onClose: () => void;
  // 내용. 함수로 주면 닫는 함수를 받아, 고른 뒤 시트가 내려간 다음에 할 일을 넘길 수 있다
  children: React.ReactNode | ((close: Close) => React.ReactNode);
  // 내용 아래에 고정되는 영역(완료 버튼 등)
  renderFooter?: (close: Close) => React.ReactNode;
  testID?: string;
};

// 댓글 창처럼 아래에서 올라오는 시트. 바깥을 누르거나, 손잡이를 끌어내리거나, 닫기 버튼으로 내린다.
// 부모가 보여 줄 때만 그리고, 다 내려간 뒤 onClose로 알린다
export function BottomSheet({
  title,
  onClose,
  children,
  renderFooter,
  testID,
}: Props) {
  const insets = useSafeAreaInsets();
  const screenHeight = Dimensions.get('screen').height;
  const translateY = useRef(new Animated.Value(screenHeight)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const alive = useRef(true);
  const closing = useRef(false);
  useEffect(() => {
    alive.current = true;
    // 애니메이션을 끈 환경(테스트)에서는 바로 올라온 상태로 둔다
    if (!motion.enabled) {
      translateY.setValue(0);
      opacity.setValue(1);
      return () => {
        alive.current = false;
      };
    }
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        damping: 25,
        stiffness: 230,
        mass: 1,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
    return () => {
      alive.current = false;
    };
  }, [translateY, opacity]);
  const close = useCallback<Close>(
    next => {
      if (closing.current) return;
      closing.current = true;
      if (!motion.enabled) {
        onClose();
        next?.();
        return;
      }
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: screenHeight,
          duration: 190,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 170,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished && alive.current) {
          onClose();
          next?.();
        }
      });
    },
    [translateY, opacity, screenHeight, onClose],
  );
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_event, g) =>
          g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_event, g) =>
          translateY.setValue(Math.max(0, g.dy)),
        onPanResponderRelease: (_event, g) => {
          if (g.dy > 75 || g.vy > 1.1) close();
          else
            Animated.spring(translateY, {
              toValue: 0,
              damping: 25,
              stiffness: 230,
              useNativeDriver: true,
            }).start();
        },
        onPanResponderTerminate: () =>
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start(),
      }),
    [translateY, close],
  );
  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => close()}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.shade, { opacity }]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityRole="button"
            accessibilityLabel={`${title} 닫기`}
            onPress={() => close()}
          />
        </Animated.View>
        <Animated.View
          testID={testID}
          accessibilityViewIsModal
          onAccessibilityEscape={() => close()}
          style={[
            styles.sheet,
            {
              maxHeight: screenHeight * 0.86 - insets.top,
              paddingBottom: Math.max(insets.bottom, spacing.md),
              transform: [{ translateY }],
            },
          ]}
        >
          <View
            {...pan.panHandlers}
            style={styles.dragHandle}
            accessibilityLabel={`아래로 내려 ${title} 닫기`}
          >
            <View style={styles.handle} />
          </View>
          <View style={styles.heading}>
            <AppText variant="heading" style={styles.grow}>
              {title}
            </AppText>
            <IconButton
              icon={X}
              variant="plain"
              accessibilityLabel={`${title} 닫기`}
              onPress={() => close()}
            />
          </View>
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {typeof children === 'function' ? children(close) : children}
          </ScrollView>
          {renderFooter && (
            <View style={styles.footer}>{renderFooter(close)}</View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = themedStyles(() => ({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  shade: { backgroundColor: colors.scrim },
  sheet: {
    backgroundColor: colors.surfaceRaised,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  grow: { flex: 1 },
  dragHandle: { height: 28, alignItems: 'center', justifyContent: 'center' },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 22,
    paddingRight: spacing.md,
    paddingBottom: spacing.md,
  },
  body: { flexGrow: 0 },
  content: { paddingHorizontal: 22, paddingBottom: spacing.lg },
  footer: { paddingHorizontal: 22, paddingTop: spacing.sm },
}));
