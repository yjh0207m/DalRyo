import React from 'react';
import { View, type TextProps, type TextStyle } from 'react-native';
import { AppText } from './AppText';

// Pretendard의 세로 수치(글자 크기 대비). 글꼴 파일의 hhea·OS/2 값(unitsPerEm 2048)에서 읽었다
const ASCENT = 1950 / 2048; // 바닥선 위
const DESCENT = 494 / 2048; // 바닥선 아래
const CAP_HEIGHT = 1448 / 2048; // 숫자·대문자 높이

// 숫자를 세로로만 stretch배(기본 1.07) 살짝 늘린 '키 큰 숫자'. 폭은 그대로라 숫자가 조금 더 길쭉해 보인다.
// 바닥선을 기준으로 늘려서 옆에 바닥선 맞춤으로 붙인 단위(km 등)는 같은 줄에 그대로 놓이고,
// 위로 솟는 만큼은 위쪽에 자리를 비워 둬서 위의 글자와 겹치지 않는다
export function TallNumber({
  fontSize,
  lineHeight,
  stretch = 1.07,
  color,
  style,
  children,
  ...rest
}: TextProps & {
  fontSize: number;
  lineHeight: number;
  stretch?: number;
  color?: string;
  style?: TextStyle;
}) {
  // 글자 줄 안에서 바닥선의 위치. 줄 높이가 글꼴 높이와 다르면 남는(모자란) 만큼을 위아래로 똑같이 나눈다
  const baseline =
    (lineHeight - (ASCENT + DESCENT) * fontSize) / 2 + ASCENT * fontSize;
  const rise = (stretch - 1) * CAP_HEIGHT * fontSize;
  return (
    <View style={{ paddingTop: rise }}>
      <AppText
        {...rest}
        color={color}
        style={[
          style,
          {
            fontSize,
            lineHeight,
            transform: [{ scaleY: stretch }],
            transformOrigin: ['0%', baseline, 0],
          },
        ]}
      >
        {children}
      </AppText>
    </View>
  );
}
