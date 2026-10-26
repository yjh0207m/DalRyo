import React, {useEffect, useRef, useState} from 'react';
import {Animated, Image, StatusBar, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {fetchCharacterImageUrl} from '../../services/character.service';
import type {CharacterStage, CharacterType} from '../../types/character.types';
import {formatDuration, formatPace} from '../../utils/pace';

const images = {
  egg: require('../../assets/images/egg.png'),
  brokenEgg: require('../../assets/images/broken_egg.png'),
};

const MINT = '#58CFA6';
const TEXT = '#151515';
const MUTED = '#808080';

type Props = {
  distanceKm: number;
  durationSec: number;
  avgPaceSec: number;
  calories: number;
  characterType: CharacterType;
  petName: string;
  // 이번 달리기 전 캐릭터 단계. 'egg'이고 거리가 0보다 크면 부화 연출
  stageBeforeRun: CharacterStage;
  // 이번 달리기 반영 후 단계 (getCharacterStage(total_km))
  stageAfterRun: CharacterStage;
  onTakePhoto: () => void;
  onViewRecord: () => void;
};

export function RunCompleteScreen({
  distanceKm,
  durationSec,
  avgPaceSec,
  calories,
  characterType,
  petName,
  stageBeforeRun,
  stageAfterRun,
  onTakePhoto,
  onViewRecord,
}: Props) {
  const shouldHatch = stageBeforeRun === 'egg' && distanceKm > 0;
  const [characterUrl, setCharacterUrl] = useState<string | null>(null);
  const [hatched, setHatched] = useState(!shouldHatch);
  const eggShake = useRef(new Animated.Value(0)).current;
  const characterScale = useRef(new Animated.Value(shouldHatch ? 0 : 1)).current;
  const rotate = eggShake.interpolate({inputRange: [-1, 0, 1], outputRange: ['-8deg', '0deg', '8deg']});

  useEffect(() => {
    let cancelled = false;
    fetchCharacterImageUrl(characterType, stageAfterRun)
      .then(url => {
        if (!cancelled) setCharacterUrl(url);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [characterType, stageAfterRun]);

  useEffect(() => {
    if (!shouldHatch) {
      return;
    }

    Animated.sequence([
      Animated.delay(400),
      Animated.loop(
        Animated.sequence([
          Animated.timing(eggShake, {toValue: 1, duration: 80, useNativeDriver: true}),
          Animated.timing(eggShake, {toValue: -1, duration: 80, useNativeDriver: true}),
          Animated.timing(eggShake, {toValue: 0, duration: 80, useNativeDriver: true}),
        ]),
        {iterations: 5},
      ),
    ]).start(() => {
      setHatched(true);
      Animated.spring(characterScale, {toValue: 1, friction: 5, tension: 70, useNativeDriver: true}).start();
    });
  }, [shouldHatch, eggShake, characterScale]);

  const title = shouldHatch
    ? hatched
      ? `${petName} 탄생!`
      : '알이 흔들려요!'
    : '잘 달렸어요!';
  const subtitle = shouldHatch
    ? hatched
      ? '첫 달리기를 축하해요. 이제 함께 자라요!'
      : '첫 달리기 덕분에 알이 깨어나고 있어요.'
    : `${petName}도 한 뼘 더 자랐어요.`;

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#F6FEFF" />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      <View style={styles.stage}>
        {shouldHatch && !hatched && (
          <Animated.View style={{transform: [{rotate}]}}>
            <Image source={images.egg} resizeMode="contain" style={styles.egg} />
          </Animated.View>
        )}
        {hatched && (
          <>
            {shouldHatch && <Image source={images.brokenEgg} resizeMode="contain" style={styles.brokenEgg} />}
            <Animated.View style={[styles.characterWrap, {transform: [{scale: characterScale}]}]}>
              {characterUrl && <Image source={{uri: characterUrl}} resizeMode="contain" style={styles.character} />}
            </Animated.View>
          </>
        )}
      </View>

      <View style={styles.statsCard}>
        <Stat label="총 거리" value={`${distanceKm.toFixed(2)}km`} />
        <Stat label="평균 페이스" value={formatPace(avgPaceSec)} />
        <Stat label="소요 시간" value={formatDuration(durationSec)} />
        <Stat label="칼로리" value={`${calories}kcal`} />
      </View>

      <TouchableOpacity activeOpacity={0.86} disabled={!hatched} onPress={onTakePhoto} style={[styles.primaryButton, !hatched && styles.buttonDisabled]}>
        <Text style={styles.primaryButtonText}>달료랑 사진 찍기</Text>
      </TouchableOpacity>
      <TouchableOpacity activeOpacity={0.8} disabled={!hatched} onPress={onViewRecord} style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>운동 기록 보기</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function Stat({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#F6FEFF', paddingHorizontal: 28, paddingTop: 40, paddingBottom: 30},
  title: {color: TEXT, fontSize: 28, fontWeight: '900', lineHeight: 38, textAlign: 'center'},
  subtitle: {color: MUTED, fontSize: 16, fontWeight: '700', textAlign: 'center', marginTop: 8},
  stage: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  egg: {width: 200, height: 232},
  brokenEgg: {position: 'absolute', width: 200, height: 144, bottom: 40},
  characterWrap: {alignItems: 'center', justifyContent: 'center'},
  character: {width: 230, height: 230},
  statsCard: {flexDirection: 'row', flexWrap: 'wrap', borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4ECE9', paddingVertical: 8, marginBottom: 20},
  stat: {width: '50%', alignItems: 'center', paddingVertical: 12},
  statValue: {color: TEXT, fontSize: 22, fontWeight: '900'},
  statLabel: {color: MUTED, fontSize: 13, fontWeight: '800', marginTop: 4},
  primaryButton: {height: 60, borderRadius: 20, backgroundColor: MINT, alignItems: 'center', justifyContent: 'center', shadowColor: MINT, shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: {width: 0, height: 8}, elevation: 6},
  primaryButtonText: {color: '#FFFFFF', fontSize: 19, fontWeight: '900'},
  buttonDisabled: {opacity: 0.45},
  secondaryButton: {height: 54, alignItems: 'center', justifyContent: 'center', marginTop: 8},
  secondaryButtonText: {color: '#37AE86', fontSize: 16, fontWeight: '900'},
});
