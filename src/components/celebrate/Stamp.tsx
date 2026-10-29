import React, {useEffect, useRef} from 'react';
import {Animated, Easing, StyleSheet, type StyleProp, type ViewStyle} from 'react-native';
import {colors, fonts} from '../../theme';

// 위에서 '쾅' 찍히는 도장. show가 true가 되면 한 번 찍힌다.
export function Stamp({label, show, color = colors.heart, style}: {label: string; show: boolean; color?: string; style?: StyleProp<ViewStyle>}) {
  const press = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!show) {
      press.setValue(0);
      return;
    }
    Animated.sequence([
      Animated.timing(press, {toValue: 0.85, duration: 200, easing: Easing.in(Easing.quad), useNativeDriver: true}),
      Animated.spring(press, {toValue: 1, friction: 4, tension: 160, useNativeDriver: true}),
    ]).start();
  }, [press, show]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.stamp,
        {borderColor: color},
        style,
        {
          opacity: press.interpolate({inputRange: [0, 0.4, 1], outputRange: [0, 1, 1]}),
          transform: [{rotate: '-14deg'}, {scale: press.interpolate({inputRange: [0, 0.85, 1], outputRange: [2.4, 0.92, 1]})}],
        },
      ]}
    >
      <Animated.Text style={[styles.text, {color}]}>{label}</Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stamp: {
    position: 'absolute',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  text: {fontFamily: fonts.extrabold, fontSize: 18, letterSpacing: 1},
});
