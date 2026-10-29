import React from 'react';
import {StyleSheet} from 'react-native';
import Svg, {Circle, Ellipse, G, Path} from 'react-native-svg';
import {findItem} from '../../../functions/src/itemCatalog';

// Relative canvas coordinates avoid fitting a generic garment to different
// bodies. This is inside CharacterView's moving/flipping body container.
export function OutfitDecoration({itemId, size}: {itemId?: string; size: number}) {
  const item = findItem(itemId);
  if (!item) return null;
  return <Svg testID={`decoration-${item.id}`} pointerEvents="none" width={size} height={size} viewBox="0 0 100 100" style={styles.layer}>
    {item.visual === 'glow' ? <>
      <Circle cx="50" cy="51" r="36" fill={item.color} opacity="0.08"/>
      <Circle cx="50" cy="51" r="30" fill={item.color} opacity="0.13"/>
      <Circle cx="50" cy="51" r="24" fill={item.color} opacity="0.16"/>
    </> : [[15, 42, 1], [85, 33, 0.8], [81, 68, 0.65]].map(([x, y, scale], index) =>
      <G key={index} transform={`translate(${x} ${y}) scale(${scale})`}>
        {item.visual === 'stars' ? <Path d="M0 -5 L1.7 -1.7 L5 0 L1.7 1.7 L0 5 L-1.7 1.7 L-5 0 L-1.7 -1.7 Z" fill={item.color}/> : <>
          <Ellipse cx="-1.5" cy="0" rx="2.5" ry="4" rotation="-35" fill={item.color}/>
          <Ellipse cx="1.5" cy="0" rx="2.5" ry="4" rotation="35" fill={item.color} opacity="0.7"/>
        </>}
      </G>)}
  </Svg>;
}
const styles = StyleSheet.create({layer: {position: 'absolute', top: 0, left: 0}});
