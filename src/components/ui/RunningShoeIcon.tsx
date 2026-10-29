import React from 'react';
import Svg, { Path } from 'react-native-svg';

// 달료의 러닝화 응원. 같은 윤곽을 채워 선택 상태를 표시한다.
export function RunningShoeIcon({
  size = 26,
  color = '#16211E',
  active = false,
}: {
  size?: number;
  color?: string;
  active?: boolean;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <Path
        d="M4 8.5 8 7l3.5 5 5 2.3 6.5 1.5c1.7.4 2.5 1.5 2.5 3.2v2H3v-7l1-5.5Z"
        fill={active ? color : 'none'}
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Path
        d="M3 21h22.5M4.5 10.5 8 12M11 14l2-2M14.5 15.5l1.5-2"
        stroke={active ? 'white' : color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M3 24h22.5"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}
