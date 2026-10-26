import React, {useEffect, useRef, useState} from 'react';
import {Animated, Image, StatusBar, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {CharacterView} from '../../components/character/CharacterView';
import {colors, radius, shadow, spacing, typography} from '../../theme';
import type {CharacterStage, CharacterType} from '../../types/character.types';
import {formatDuration, formatPace} from '../../utils/pace';

const images = {
  egg: require('../../assets/images/egg.png'),
  brokenEgg: require('../../assets/images/broken_egg.png'),
};

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
  // 카메라 필터(F-CAM-01) 구현 전에는 넘기지 않으면 버튼이 숨겨진다
  onTakePhoto?: () => void;
  onViewRecord: () => void;
  onClose: () => void;
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
  onClose,
}: Props) {
  const shouldHatch = stageBeforeRun === 'egg' && distanceKm > 0;
  const grewUp = !shouldHatch && stageAfterRun !== stageBeforeRun;
  const [hatched, setHatched] = useState(!shouldHatch);
  const eggShake = useRef(new Animated.Value(0)).current;
  const characterScale = useRef(new Animated.Value(shouldHatch ? 0 : 1)).current;
  const rotate = eggShake.interpolate({inputRange: [-1, 0, 1], outputRange: ['-8deg', '0deg', '8deg']});

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

  const {title, subtitle} = getHeadline({shouldHatch, hatched, grewUp, petName});

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={styles.header}>
        <TouchableOpacity activeOpacity={0.75} disabled={!hatched} onPress={onClose} style={styles.closeButton} accessibilityLabel="닫기">
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>
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
            <Animated.View style={{transform: [{scale: characterScale}]}}>
              <CharacterView type={characterType} stage={stageAfterRun} motion="idle" size={230} />
            </Animated.View>
          </>
        )}
      </View>

      <View style={styles.statsCard}>
        <Stat label="총 거리" value={`${distanceKm.toFixed(2)}km`} />
        <Stat label="평균 페이스" value={avgPaceSec > 0 ? formatPace(avgPaceSec) : `-'--"`} />
        <Stat label="소요 시간" value={formatDuration(durationSec)} />
        <Stat label="칼로리" value={`${calories}kcal`} />
      </View>

      {onTakePhoto && (
        <TouchableOpacity activeOpacity={0.86} disabled={!hatched} onPress={onTakePhoto} style={[styles.primaryButton, !hatched && styles.buttonDisabled]}>
          <Text style={styles.primaryButtonText}>달료랑 사진 찍기</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        activeOpacity={0.8}
        disabled={!hatched}
        onPress={onViewRecord}
        style={onTakePhoto ? styles.secondaryButton : [styles.primaryButton, !hatched && styles.buttonDisabled]}>
        <Text style={onTakePhoto ? styles.secondaryButtonText : styles.primaryButtonText}>운동 기록 보기</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function getHeadline({shouldHatch, hatched, grewUp, petName}: {shouldHatch: boolean; hatched: boolean; grewUp: boolean; petName: string}) {
  if (shouldHatch && !hatched) {
    return {title: '알이 흔들려요!', subtitle: '첫 달리기 덕분에 알이 깨어나고 있어요.'};
  }
  if (shouldHatch) {
    return {title: `${petName} 탄생!`, subtitle: '첫 달리기를 축하해요. 이제 함께 자라요!'};
  }
  if (grewUp) {
    return {title: `${petName} 성장!`, subtitle: '꾸준히 달린 덕분에 한 단계 자랐어요.'};
  }
  return {title: '잘 달렸어요!', subtitle: `${petName}도 한 뼘 더 자랐어요.`};
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
  screen: {flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.xxl - 4, paddingBottom: 30},
  header: {height: 52, alignItems: 'flex-end', justifyContent: 'center'},
  closeButton: {width: 44, height: 44, alignItems: 'center', justifyContent: 'center'},
  closeText: {color: colors.text, fontSize: 22, fontWeight: '700'},
  title: {...typography.title, color: colors.text, textAlign: 'center'},
  subtitle: {...typography.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm},
  stage: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  egg: {width: 200, height: 232},
  brokenEgg: {position: 'absolute', width: 200, height: 144, bottom: 40},
  statsCard: {flexDirection: 'row', flexWrap: 'wrap', borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.sm, marginBottom: spacing.lg + 4},
  stat: {width: '50%', alignItems: 'center', paddingVertical: spacing.md},
  statValue: {color: colors.text, fontSize: 22, fontWeight: '900'},
  statLabel: {...typography.caption, color: colors.textMuted, marginTop: spacing.xs},
  primaryButton: {height: 60, borderRadius: radius.lg, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', ...shadow.button},
  primaryButtonText: {color: colors.textOnPrimary, fontSize: 19, fontWeight: '900'},
  buttonDisabled: {opacity: 0.45},
  secondaryButton: {height: 54, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm},
  secondaryButtonText: {color: colors.primaryStrong, fontSize: 16, fontWeight: '900'},
});
