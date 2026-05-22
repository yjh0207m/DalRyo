import React, {useRef, useState} from 'react';
import {
  Animated,
  Image,
  ImageSourcePropType,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {completeOnboarding} from '../../services/user.service';
import {pickStarterCharacter} from '../../services/character.service';
import type {CharacterType} from '../../types/character.types';
import type {Dialect, Gender, OnboardingProfileInput} from '../../types/user.types';

const images = {
  egg: require('../../assets/images/egg.png'),
  brokenEgg: require('../../assets/images/broken_egg.png'),
  penguinS: require('../../assets/images/penguin_S.png'),
  rabbitS: require('../../assets/images/rabbit_S.png'),
  duckS: require('../../assets/images/duck_S.png'),
};

type Props = {
  onBack: () => void;
  onDone: () => void;
};

type Step = 1 | 2 | 3 | 4;

const MINT = '#58CFA6';
const GREEN = '#78B85F';
const TEXT = '#151515';
const MUTED = '#808080';

const characterImages: Record<CharacterType, ImageSourcePropType> = {
  penguin: images.penguinS,
  rabbit: images.rabbitS,
  duck: images.duckS,
};

const regions: Array<{label: string; dialect: Dialect}> = [
  {label: '서울', dialect: 'seoul'},
  {label: '경기', dialect: 'gyeonggi'},
  {label: '인천', dialect: 'seoul'},
  {label: '강원', dialect: 'gangwon'},
  {label: '충북', dialect: 'chung'},
  {label: '충남', dialect: 'chung'},
  {label: '대전', dialect: 'chung'},
  {label: '세종', dialect: 'chung'},
  {label: '경북', dialect: 'gyeong'},
  {label: '경남', dialect: 'gyeong'},
  {label: '대구', dialect: 'gyeong'},
  {label: '울산', dialect: 'gyeong'},
  {label: '부산', dialect: 'gyeong'},
  {label: '전북', dialect: 'jeon'},
  {label: '전남', dialect: 'jeon'},
  {label: '광주', dialect: 'jeon'},
  {label: '제주', dialect: 'jeju'},
];

export function OnboardingScreen({onBack, onDone}: Props) {
  const [step, setStep] = useState<Step>(1);
  const [displayName, setDisplayName] = useState('');
  const [petName, setPetName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState<Gender>(null);
  const [website, setWebsite] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [selectedRegion, setSelectedRegion] = useState(regions[0]);
  const [characterType, setCharacterType] = useState<CharacterType>(() => pickStarterCharacter());
  const [hatched, setHatched] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const eggShake = useRef(new Animated.Value(0)).current;
  const characterScale = useRef(new Animated.Value(0)).current;
  const rotate = eggShake.interpolate({inputRange: [-1, 0, 1], outputRange: ['-8deg', '0deg', '8deg']});

  const goNext = () => setStep(current => Math.min(current + 1, 4) as Step);
  const goBack = () => {
    if (step === 1) {
      onBack();
      return;
    }
    setStep(current => Math.max(current - 1, 1) as Step);
  };

  const runHatchAnimation = () => {
    setHatched(false);
    characterScale.setValue(0);
    eggShake.setValue(0);
    Animated.sequence([
      Animated.loop(
        Animated.sequence([
          Animated.timing(eggShake, {toValue: 1, duration: 80, useNativeDriver: true}),
          Animated.timing(eggShake, {toValue: -1, duration: 80, useNativeDriver: true}),
          Animated.timing(eggShake, {toValue: 0, duration: 80, useNativeDriver: true}),
        ]),
        {iterations: 5},
      ),
      Animated.timing(characterScale, {toValue: 1, duration: 360, useNativeDriver: true}),
    ]).start(() => setHatched(true));
  };

  const openHatchStep = () => {
    setCharacterType(pickStarterCharacter());
    setStep(4);
    requestAnimationFrame(runHatchAnimation);
  };

  const saveOnboarding = async () => {
    const profile: OnboardingProfileInput = {
      displayName,
      petName,
      birthDate,
      gender,
      website,
      heightCm: parseOptionalNumber(heightCm),
      weightKg: parseOptionalNumber(weightKg),
      region: selectedRegion.label,
      dialect: selectedRegion.dialect,
    };

    setSaving(true);
    setErrorMessage(null);

    try {
      await completeOnboarding(profile, characterType);
      onDone();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '온보딩 저장에 실패했어요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#F6FEFF" />
      <View style={styles.softGlowTop} />
      <View style={styles.softGlowBottom} />
      <View style={styles.header}>
        <TouchableOpacity activeOpacity={0.75} onPress={goBack} style={styles.backButton}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.progressWrap}>
          <Text style={styles.progressTitle}>STEP {step} / 4 · {getStepName(step)}</Text>
          <ProgressBar step={step} />
        </View>
      </View>
      {step === 1 && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.stepScroll}>
          <Text style={styles.stepTitle}>기본 정보를{'\n'}입력해 주세요!</Text>
          <View style={styles.profileCircle}>
            <Image source={characterImages.rabbit} resizeMode="contain" style={styles.profileCharacter} />
            <View style={styles.cameraBadge}>
              <Text style={styles.cameraText}>▣</Text>
            </View>
          </View>
          <LabeledInput label="이름" value={displayName} onChangeText={setDisplayName} placeholder="이름을 입력해 주세요" />
          <LabeledInput label="달료 펫 이름(닉네임)" value={petName} onChangeText={setPetName} placeholder="달료 펫의 이름을 입력해 주세요" />
          <LabeledInput label="생년월일" value={birthDate} onChangeText={setBirthDate} placeholder="생년월일을 선택해 주세요" />
          <Text style={styles.inputLabel}>성별</Text>
          <View style={styles.segmentRow}>
            <TouchableOpacity activeOpacity={0.8} onPress={() => setGender('female')} style={[styles.segment, gender === 'female' && styles.segmentActive]}>
              <Text style={[styles.segmentText, gender === 'female' && styles.segmentActiveText]}>여성</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.8} onPress={() => setGender('male')} style={[styles.segment, gender === 'male' && styles.segmentActive]}>
              <Text style={[styles.segmentText, gender === 'male' && styles.segmentActiveText]}>남성</Text>
            </TouchableOpacity>
          </View>
          <LabeledInput label="외부 링크 (선택)" value={website} onChangeText={setWebsite} placeholder="블로그, 인스타그램 등 링크를 입력해 주세요" />
          <PrimaryButton label="다음" onPress={goNext} disabled={!displayName.trim() || !petName.trim()} />
        </ScrollView>
      )}
      {step === 2 && (
        <View style={styles.stepContent}>
          <Text style={styles.stepTitle}>신체 정보를{'\n'}입력해 주세요!</Text>
          <EggImage size={168} />
          <LabeledInput label="키" value={heightCm} onChangeText={setHeightCm} placeholder="키를 입력해 주세요" suffix="cm" keyboardType="numeric" />
          <LabeledInput label="몸무게" value={weightKg} onChangeText={setWeightKg} placeholder="몸무게를 입력해 주세요" suffix="kg" keyboardType="numeric" />
          <View style={styles.stepSpacer} />
          <PrimaryButton label="다음" onPress={goNext} />
          <TouchableOpacity activeOpacity={0.75} onPress={goNext} style={styles.skipButton}>
            <Text style={styles.skipButtonText}>건너뛰기</Text>
          </TouchableOpacity>
        </View>
      )}
      {step === 3 && (
        <View style={styles.stepContent}>
          <Text style={styles.stepTitle}>어디에서{'\n'}달리시나요?</Text>
          <EggImage size={156} />
          <TouchableOpacity activeOpacity={0.86} style={styles.locationButton}>
            <Text style={styles.locationButtonText}>● 현재 위치로 설정</Text>
          </TouchableOpacity>
          <View style={styles.regionGrid}>
            {regions.map(region => (
              <TouchableOpacity
                activeOpacity={0.8}
                key={region.label}
                onPress={() => setSelectedRegion(region)}
                style={[styles.regionChip, selectedRegion.label === region.label && styles.regionChipActive]}>
                <Text style={[styles.regionText, selectedRegion.label === region.label && styles.regionTextActive]}>{region.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.stepSpacer} />
          <PrimaryButton label="다음" onPress={openHatchStep} />
        </View>
      )}
      {step === 4 && (
        <View style={styles.hatchContent}>
          <Text style={styles.stepTitle}>{hatched ? '달료 펫이 태어났어요!' : '알이 흔들려요!'}</Text>
          <Text style={styles.hatchSubtitle}>{hatched ? '함께 달리며 건강한 습관을 만들어봐요.' : '잠시 후 새로운 달료가 태어나요.'}</Text>
          <View style={styles.hatchStage}>
            {!hatched && (
              <Animated.View style={{transform: [{rotate}]}}>
                <EggImage size={210} />
              </Animated.View>
            )}
            {hatched && <Image source={images.brokenEgg} resizeMode="contain" style={styles.brokenEgg} />}
            <Animated.Image
              source={characterImages[characterType]}
              resizeMode="contain"
              style={[styles.bornCharacter, {opacity: characterScale, transform: [{scale: characterScale}]}]}
            />
          </View>
          {!!errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}
          <PrimaryButton label={isSaving ? '저장중...' : hatched ? '달리기 시작하기' : '두근두근...'} onPress={saveOnboarding} disabled={!hatched || isSaving} />
        </View>
      )}
    </SafeAreaView>
  );
}

function ProgressBar({step}: {step: Step}) {
  return (
    <View style={styles.progressRow}>
      {[1, 2, 3, 4].map(index => (
        <View key={index} style={[styles.progressSegment, index <= step && styles.progressSegmentActive]} />
      ))}
    </View>
  );
}

function LabeledInput({
  label,
  value,
  onChangeText,
  placeholder,
  suffix,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  suffix?: string;
  keyboardType?: 'default' | 'numeric';
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput value={value} onChangeText={onChangeText} keyboardType={keyboardType} placeholder={placeholder} placeholderTextColor="#B6B6B6" style={styles.input} />
        {!!suffix && <Text style={styles.inputSuffix}>{suffix}</Text>}
      </View>
    </View>
  );
}

function EggImage({size}: {size: number}) {
  return <Image source={images.egg} resizeMode="contain" style={[styles.eggImage, {width: size, height: size * 1.16}]} />;
}

function PrimaryButton({label, onPress, disabled}: {label: string; onPress: () => void; disabled?: boolean}) {
  return (
    <TouchableOpacity activeOpacity={0.86} disabled={disabled} onPress={onPress} style={[styles.wideButton, disabled && styles.wideButtonDisabled]}>
      <Text style={styles.wideButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

function getStepName(step: Step) {
  if (step === 1) return '기본 정보';
  if (step === 2) return '신체 정보';
  if (step === 3) return '내 지역';
  return '달료 탄생';
}

function parseOptionalNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#F6FEFF'},
  softGlowTop: {position: 'absolute', left: -80, top: -80, width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(174,232,225,0.35)'},
  softGlowBottom: {position: 'absolute', right: -100, bottom: -110, width: 280, height: 280, borderRadius: 140, backgroundColor: 'rgba(191,237,214,0.45)'},
  header: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, paddingTop: 12, minHeight: 62},
  backButton: {width: 36, height: 44, justifyContent: 'center'},
  backText: {color: TEXT, fontSize: 42, lineHeight: 42},
  progressWrap: {flex: 1},
  progressTitle: {color: '#777777', fontSize: 13, fontWeight: '800', marginBottom: 8},
  progressRow: {flexDirection: 'row', gap: 6},
  progressSegment: {flex: 1, height: 5, borderRadius: 3, backgroundColor: '#D8D8D8'},
  progressSegmentActive: {backgroundColor: MINT},
  stepScroll: {paddingHorizontal: 32, paddingTop: 46, paddingBottom: 34},
  stepContent: {flex: 1, paddingHorizontal: 32, paddingTop: 46, paddingBottom: 34},
  stepTitle: {color: TEXT, fontSize: 28, fontWeight: '900', lineHeight: 38, marginBottom: 24},
  profileCircle: {alignSelf: 'center', width: 156, height: 156, borderRadius: 78, borderWidth: 1, borderColor: '#9BE2C6', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginBottom: 24},
  profileCharacter: {width: 146, height: 146},
  cameraBadge: {position: 'absolute', right: -5, bottom: 8, width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: '#8CDBBF', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center'},
  cameraText: {color: MINT, fontSize: 18, fontWeight: '900'},
  inputGroup: {marginBottom: 16},
  inputLabel: {color: '#222222', fontSize: 15, fontWeight: '900', marginBottom: 8},
  inputWrap: {height: 50, borderWidth: 1, borderColor: '#DCDCDC', borderRadius: 9, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16},
  input: {flex: 1, color: TEXT, fontSize: 16, fontWeight: '600', paddingVertical: 0},
  inputSuffix: {color: '#666666', fontSize: 14, fontWeight: '900'},
  segmentRow: {flexDirection: 'row', gap: 12, marginBottom: 18},
  segment: {flex: 1, height: 46, borderWidth: 1, borderColor: '#D8D8D8', borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF'},
  segmentActive: {borderColor: MINT, backgroundColor: '#EFFFF7'},
  segmentText: {color: '#4B4B4B', fontSize: 15, fontWeight: '800'},
  segmentActiveText: {color: '#37AE86', fontSize: 15, fontWeight: '900'},
  eggImage: {alignSelf: 'center', marginBottom: 26},
  stepSpacer: {flex: 1},
  skipButton: {height: 58, borderRadius: 10, backgroundColor: 'rgba(88,207,166,0.12)', alignItems: 'center', justifyContent: 'center', marginTop: 14},
  skipButtonText: {color: '#7CC8AC', fontSize: 18, fontWeight: '900'},
  locationButton: {height: 56, borderWidth: 1, borderColor: MINT, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.68)', marginBottom: 20},
  locationButtonText: {color: '#37AE86', fontSize: 17, fontWeight: '900'},
  regionGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
  regionChip: {width: '18%', minWidth: 58, height: 52, borderWidth: 1, borderColor: '#DFDFDF', borderRadius: 10, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center'},
  regionChipActive: {backgroundColor: MINT, borderColor: MINT},
  regionText: {color: '#333333', fontSize: 15, fontWeight: '800'},
  regionTextActive: {color: '#FFFFFF', fontWeight: '900'},
  hatchContent: {flex: 1, paddingHorizontal: 32, paddingTop: 50, paddingBottom: 34},
  hatchSubtitle: {color: MUTED, fontSize: 16, fontWeight: '700', marginTop: -12, marginBottom: 36},
  hatchStage: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  bornCharacter: {position: 'absolute', width: 230, height: 260},
  brokenEgg: {position: 'absolute', width: 210, height: 150, bottom: 58},
  errorText: {color: '#C95B5B', fontSize: 14, fontWeight: '800', lineHeight: 20, textAlign: 'center', marginBottom: 12},
  wideButton: {height: 58, borderRadius: 10, backgroundColor: MINT, alignItems: 'center', justifyContent: 'center', shadowColor: MINT, shadowOpacity: 0.24, shadowRadius: 16, shadowOffset: {width: 0, height: 8}, elevation: 6},
  wideButtonDisabled: {opacity: 0.45},
  wideButtonText: {color: '#FFFFFF', fontSize: 20, fontWeight: '900'},
});
