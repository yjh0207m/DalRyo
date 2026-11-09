import React, { useEffect, useState } from 'react';
import {
  Image,
  StyleSheet,
  type ImageStyle,
  type StyleProp,
} from 'react-native';
import { colors } from '../../theme';

// 사진 원본 비율대로 높이를 잡아 잘리지 않고 전체가 보이게 하는 이미지.
// 너무 길거나 넓은 사진은 비율을 제한하고 contain으로 그려 여백이 생기더라도 잘리지 않게 한다
const MIN_RATIO = 0.5;
const MAX_RATIO = 2;
// 오운완 카드(4:5)가 가장 흔해 크기를 알기 전에는 이 비율로 자리를 잡는다
const DEFAULT_RATIO = 4 / 5;
// 목록을 스크롤하며 다시 그려도 높이가 흔들리지 않도록 알아낸 비율을 기억한다
const ratios = new Map<string, number>();

export function FullPhoto({
  uri,
  style,
}: {
  uri: string;
  style?: StyleProp<ImageStyle>;
}) {
  const [ratio, setRatio] = useState(() => ratios.get(uri) ?? DEFAULT_RATIO);
  useEffect(() => {
    const known = ratios.get(uri);
    if (known) {
      setRatio(known);
      return undefined;
    }
    let active = true;
    try {
      Image.getSize(
        uri,
        (width, height) => {
          if (!active || !width || !height) return;
          const next = Math.min(MAX_RATIO, Math.max(MIN_RATIO, width / height));
          ratios.set(uri, next);
          setRatio(next);
        },
        () => undefined,
      );
    } catch {
      // 크기를 못 읽으면 기본 비율로 보여 준다
    }
    return () => {
      active = false;
    };
  }, [uri]);
  return (
    <Image
      source={{ uri }}
      resizeMode="contain"
      style={[styles.photo, { aspectRatio: ratio }, style]}
    />
  );
}

const styles = StyleSheet.create({
  photo: { width: '100%', backgroundColor: colors.surfaceMuted },
});
