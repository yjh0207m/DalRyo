import React, {useEffect, useState} from 'react';
import {ImageBackground, StatusBar, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {getIsDusk, getIsDuskSync} from '../../utils/skyBackground';

const images = {
  bgDay: require('../../assets/images/bg-day.png'),
  bgDusk: require('../../assets/images/bg-dusk.png'),
};

type Props = {
  onStart: () => void;
};

const MINT = '#58CFA6';

export function AuthStartScreen({onStart}: Props) {
  const [isDusk, setIsDusk] = useState(() => getIsDuskSync());

  useEffect(() => {
    getIsDusk().then(setIsDusk);
  }, []);

  const accent = isDusk ? '#78E0C5' : MINT;

  return (
    <ImageBackground source={isDusk ? images.bgDusk : images.bgDay} resizeMode="cover" style={styles.screen}>
      <StatusBar translucent backgroundColor="transparent" barStyle={isDusk ? 'light-content' : 'dark-content'} />
      <View pointerEvents="none" style={[styles.scrim, isDusk && styles.duskScrim]} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.brand}>
          <Text style={[styles.logo, {color: accent}]}>달료</Text>
          <Text style={[styles.tagline, {color: accent}]}>함께 달리는 즐거움!</Text>
        </View>
      </SafeAreaView>
      <View style={styles.bottomContent}>
        <Text style={styles.message}>{isDusk ? '하루의 끝, 러닝으로 마무리해요' : '좋은 아침이에요!'}</Text>
        <Text style={styles.messageStrong}>{isDusk ? '오늘도 수고했어요!' : '오늘도 함께 달려볼까요?'}</Text>
        <TouchableOpacity activeOpacity={0.86} onPress={onStart} style={styles.startButton}>
          <Text style={styles.startButtonText}>시작하기</Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
}


const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#8ED6FF'},
  scrim: {position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.05)'},
  duskScrim: {backgroundColor: 'rgba(0,0,0,0.16)'},
  safeArea: {flex: 1},
  brand: {alignItems: 'center', paddingTop: 108},
  logo: {fontSize: 58, fontWeight: '900', textShadowColor: 'rgba(255,255,255,0.92)', textShadowOffset: {width: 0, height: 2}, textShadowRadius: 2},
  tagline: {fontSize: 20, fontWeight: '900', marginTop: 8, textShadowColor: 'rgba(255,255,255,0.45)', textShadowOffset: {width: 0, height: 1}, textShadowRadius: 1},
  bottomContent: {position: 'absolute', left: 36, right: 36, bottom: 100, alignItems: 'center'},
  message: {color: '#FFFFFF', fontSize: 21, fontWeight: '900', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.28)', textShadowOffset: {width: 0, height: 2}, textShadowRadius: 8},
  messageStrong: {color: '#FFFFFF', fontSize: 24, fontWeight: '900', textAlign: 'center', marginTop: 8, marginBottom: 32, textShadowColor: 'rgba(0,0,0,0.34)', textShadowOffset: {width: 0, height: 2}, textShadowRadius: 8},
  startButton: {alignItems: 'center', alignSelf: 'stretch', backgroundColor: MINT, borderRadius: 26, justifyContent: 'center', minHeight: 62, shadowColor: '#000000', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: {width: 0, height: 8}, elevation: 8},
  startButtonText: {color: '#FFFFFF', fontSize: 27, fontWeight: '900'},
});
