import React, {useEffect, useRef} from 'react';
import {Animated, StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native';
import {colors, radius, shadow, spacing} from '../../theme';
import {AppText} from '../ui';

// 캐릭터 머리 위 말풍선. 문구가 바뀔 때마다 아래에서 살짝 튀어 오르며 나타난다.
export function SpeechBubble({text, style}: {text: string; style?: StyleProp<ViewStyle>}) {
  const appear = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    appear.setValue(0);
    Animated.spring(appear, {toValue: 1, friction: 6, tension: 140, useNativeDriver: true}).start();
  }, [appear, text]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.bubble,
        style,
        {
          opacity: appear.interpolate({inputRange: [0, 0.4, 1], outputRange: [0, 1, 1]}),
          transform: [
            {translateY: appear.interpolate({inputRange: [0, 1], outputRange: [8, 0]})},
            {scale: appear.interpolate({inputRange: [0, 1], outputRange: [0.85, 1]})},
          ],
        },
      ]}
    >
      <AppText variant="caption" color={colors.text} numberOfLines={2} align="center">
        {text}
      </AppText>
      <View style={styles.tail} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: 200,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    transformOrigin: 'bottom',
    ...shadow.card,
  },
  tail: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: -6,
    width: 12,
    height: 12,
    backgroundColor: colors.surface,
    transform: [{rotate: '45deg'}],
  },
});
