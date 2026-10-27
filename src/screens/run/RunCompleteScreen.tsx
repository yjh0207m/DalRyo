import React, {useEffect, useRef, useState} from 'react';
import {Animated, Image, StatusBar, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Camera, CalendarDays, X} from 'lucide-react-native';
import {CharacterView} from '../../components/character/CharacterView';
import {MeadowScene} from '../../components/scene/MeadowScene';
import {AppText, Button, Card, IconButton} from '../../components/ui';
import {colors, spacing} from '../../theme';
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
  // 돌 변신 상태에서 달렸으면 해동 문구
  wasFrozen?: boolean;
  // 카메라 필터(F-CAM-01) 구현 전에는 넘기지 않으면 버튼이 숨겨진다
  onTakePhoto?: () => void;
  onViewRecord: () => void;
  onClose: () => void;
};

const CHARACTER_SIZE = 200;
const MEADOW_HEIGHT = 170;

export function RunCompleteScreen({
  distanceKm,
  durationSec,
  avgPaceSec,
  calories,
  characterType,
  petName,
  stageBeforeRun,
  stageAfterRun,
  wasFrozen = false,
  onTakePhoto,
  onViewRecord,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const shouldHatch = stageBeforeRun === 'egg' && distanceKm > 0;
  const grewUp = !shouldHatch && stageAfterRun !== stageBeforeRun;
  const [hatched, setHatched] = useState(!shouldHatch);
  const eggShake = useRef(new Animated.Value(0)).current;
  const characterScale = useRef(new Animated.Value(shouldHatch ? 0 : 1)).current;
  const rotate = eggShake.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-8deg', '0deg', '8deg'],
  });

  useEffect(() => {
    if (!shouldHatch) {
      return;
    }

    Animated.sequence([
      Animated.delay(400),
      Animated.loop(
        Animated.sequence([
          Animated.timing(eggShake, {
            toValue: 1,
            duration: 80,
            useNativeDriver: true,
          }),
          Animated.timing(eggShake, {
            toValue: -1,
            duration: 80,
            useNativeDriver: true,
          }),
          Animated.timing(eggShake, {
            toValue: 0,
            duration: 80,
            useNativeDriver: true,
          }),
        ]),
        {iterations: 5},
      ),
    ]).start(() => {
      setHatched(true);
      Animated.spring(characterScale, {
        toValue: 1,
        friction: 5,
        tension: 70,
        useNativeDriver: true,
      }).start();
    });
  }, [shouldHatch, eggShake, characterScale]);

  const {title, subtitle} = getHeadline({
    shouldHatch,
    hatched,
    grewUp,
    wasFrozen,
    petName,
  });

  // 하단(기록 카드 + 버튼 + 안전 영역) 높이만큼 풀밭 색을 이어 칠해 초원이 화면 아래까지 이어지게 한다.
  // 초원 그림 자체를 늘리면 언덕이 가팔라져 캐릭터가 떠 보이므로 그림 높이는 고정한다
  const [bottomBlockHeight, setBottomBlockHeight] = useState(300);
  const bottomInset = bottomBlockHeight + insets.bottom + spacing.xl;

  return (
    <View
      style={[
        styles.screen,
        {
          paddingTop: insets.top + spacing.sm,
          paddingBottom: insets.bottom + spacing.xl,
        },
      ]}
    >
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={styles.header}>
        <IconButton icon={X} variant="plain" accessibilityLabel="닫기" onPress={onClose} />
      </View>

      <View style={styles.titleBlock}>
        <AppText variant="title" align="center">
          {title}
        </AppText>
        <AppText variant="body" color={colors.textMuted} align="center">
          {subtitle}
        </AppText>
      </View>

      {/* 달리기 화면과 같은 초원에서 부화·완주 리액션. 초원은 화면 아래 끝까지 깔고, 기록 카드가 풀밭 위에 놓인다 */}
      <View style={styles.stage} />
      <View pointerEvents="box-none" style={styles.meadowLayer}>
        <MeadowScene height={MEADOW_HEIGHT} groundRatio={0.42}>
          {shouldHatch && !hatched && (
            <Animated.View style={{transform: [{rotate}]}}>
              <Image source={images.egg} resizeMode="contain" style={styles.egg} />
            </Animated.View>
          )}
          {hatched && (
            <View style={styles.hatchedWrap}>
              <Animated.View style={{transform: [{scale: characterScale}]}}>
                <CharacterView
                  type={characterType}
                  stage={stageAfterRun}
                  motion="idle"
                  size={CHARACTER_SIZE}
                  grounded={!shouldHatch}
                  style={!shouldHatch && styles.groundedCharacter}
                />
              </Animated.View>
              {/* 깨진 껍데기를 캐릭터 아랫부분에 겹쳐, 껍데기에서 막 나온 모습으로 보이게 한다 */}
              {shouldHatch && <Image source={images.brokenEgg} resizeMode="contain" style={styles.brokenEgg} />}
            </View>
          )}
        </MeadowScene>
        <View style={[styles.grassFill, {height: bottomInset}]} />
      </View>

      <View onLayout={event => setBottomBlockHeight(event.nativeEvent.layout.height)}>
        <Card padded={false} style={styles.stats}>
          <View style={styles.statsRow}>
            <Stat label="거리" value={distanceKm.toFixed(2)} unit="km" />
            <View style={styles.vDivider} />
            <Stat label="평균 페이스" value={avgPaceSec > 0 ? formatPace(avgPaceSec) : `-'--"`} unit="/km" />
          </View>
          <View style={styles.hDivider} />
          <View style={styles.statsRow}>
            <Stat label="시간" value={formatDuration(durationSec)} unit="분:초" />
            <View style={styles.vDivider} />
            <Stat label="칼로리" value={String(calories)} unit="kcal" />
          </View>
        </Card>

        <View style={styles.actions}>
          {onTakePhoto && <Button label="달료랑 사진 찍기" icon={Camera} variant="secondary" disabled={!hatched} onPress={onTakePhoto} />}
          <Button label="기록 보기" icon={CalendarDays} disabled={!hatched} onPress={onViewRecord} />
        </View>
      </View>
    </View>
  );
}

function getHeadline({
  shouldHatch,
  hatched,
  grewUp,
  wasFrozen,
  petName,
}: {
  shouldHatch: boolean;
  hatched: boolean;
  grewUp: boolean;
  wasFrozen: boolean;
  petName: string;
}) {
  if (shouldHatch && !hatched) {
    return {
      title: '알이 흔들려요',
      subtitle: '첫 달리기 덕분에 알이 깨어나고 있어요',
    };
  }
  if (shouldHatch) {
    return {
      title: `${petName} 탄생!`,
      subtitle: '첫 달리기를 축하해요. 이제 함께 자라요',
    };
  }
  if (wasFrozen) {
    return {
      title: `${petName} 해동 완료`,
      subtitle: '다시 움직일 수 있게 됐어요. 자주 달려 주세요',
    };
  }
  if (grewUp) {
    return {
      title: `${petName} 성장!`,
      subtitle: '꾸준히 달린 덕분에 한 단계 자랐어요',
    };
  }
  return {title: '잘 달렸어요', subtitle: `${petName}도 한 뼘 더 자랐어요`};
}

function Stat({label, value, unit}: {label: string; value: string; unit: string}) {
  return (
    <View style={styles.stat}>
      <AppText variant="label" color={colors.textMuted}>
        {label}
      </AppText>
      <AppText variant="number">{value}</AppText>
      <AppText variant="caption" color={colors.textSubtle}>
        {unit}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
  },
  header: {
    height: 48,
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginRight: -spacing.sm,
  },
  titleBlock: {gap: spacing.xs},
  stage: {flex: 1},
  meadowLayer: {position: 'absolute', left: 0, right: 0, bottom: 0},
  grassFill: {backgroundColor: colors.grassDeep},
  egg: {width: 150, height: 174, marginBottom: -12},
  hatchedWrap: {alignItems: 'center'},
  groundedCharacter: {marginBottom: -CHARACTER_SIZE * 0.17},
  brokenEgg: {width: 170, height: 122, marginTop: -100, marginBottom: -10},
  stats: {marginBottom: spacing.lg},
  statsRow: {flexDirection: 'row', alignItems: 'center'},
  stat: {flex: 1, alignItems: 'center', paddingVertical: spacing.lg, gap: 2},
  vDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: spacing.lg,
    backgroundColor: colors.border,
  },
  hDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: spacing.xl,
    backgroundColor: colors.border,
  },
  actions: {gap: spacing.sm},
});
