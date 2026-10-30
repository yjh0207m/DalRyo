import React, {useEffect, useRef, useState} from 'react';
import {
  Animated,
  BackHandler,
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {colors, fonts} from '../../theme';
import {completeOnboarding} from '../../services/user.service';
import {pickStarterCharacter} from '../../services/character.service';
import type {CharacterType} from '../../types/character.types';
import type {Gender, OnboardingProfileInput} from '../../types/user.types';
import {REGIONS as regions, bodyInputError, type Region} from '../../utils/onboarding';
import {detectOnboardingRegion} from '../../services/onboardingLocation.service';

const images = {
  egg: require('../../assets/images/egg.png'),
};

type Props = {
  onBack: () => void;
  onDone: () => void;
};

type Step = 1 | 2 | 3 | 4;

const MINT = colors.primary;
const TEXT = colors.text;
const MUTED = '#808080';


export function OnboardingScreen({onBack, onDone}: Props) {
  const [step, setStep] = useState<Step>(1);
  const [displayName, setDisplayName] = useState('');
  const [petName, setPetName] = useState('');
  const [gender, setGender] = useState<Gender>(null);
  const [website, setWebsite] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');
  const mounted = useRef(true);
  const locationRequest = useRef(0);
  const saving = useRef(false);
  const scroll = useRef<ScrollView>(null);
  const scrollOffset = useRef(0);
  const {height: windowHeight} = useWindowDimensions();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const keyboardInset = Platform.OS === 'android'
    ? Math.max(0, keyboardHeight - Math.max(0, Dimensions.get('screen').height - windowHeight)) : 0;
  const focusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eggAnimation = useRef<Animated.CompositeAnimation | null>(null);
  const [characterType, setCharacterType] = useState<CharacterType>(() => pickStarterCharacter());
  const [eggReceived, setEggReceived] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const eggDrop = useRef(new Animated.Value(0)).current;
  const eggWobble = useRef(new Animated.Value(0)).current;
  const eggTranslateY = eggDrop.interpolate({inputRange: [0, 1], outputRange: [-260, 0]});
  const eggScale = eggDrop.interpolate({inputRange: [0, 0.7, 1], outputRange: [0.6, 1.08, 1]});
  const rotate = eggWobble.interpolate({inputRange: [-1, 0, 1], outputRange: ['-4deg', '0deg', '4deg']});

  useEffect(() => {
    mounted.current = true;
    return () => {mounted.current = false;eggAnimation.current?.stop();};
  }, []);
  useEffect(() => {scroll.current?.scrollTo({y: 0, animated: false});}, [step]);
  const revealFocusedInput = () => {
    if (focusTimer.current) clearTimeout(focusTimer.current);
    focusTimer.current = setTimeout(() => {
      const input = TextInput.State.currentlyFocusedInput();
      if (input && mounted.current) {
        scroll.current?.getNativeScrollRef()?.measureInWindow((_x, top) => {
          input.measureInWindow((_ix, inputTop) => {
            if (mounted.current) scroll.current?.scrollTo({y: Math.max(0, scrollOffset.current + inputTop - top - 48), animated: true});
          });
        });
      }
    }, 100);
  };
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', event => {
      setKeyboardHeight(event.endCoordinates.height);
      revealFocusedInput();
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => {show.remove();hide.remove();if (focusTimer.current) clearTimeout(focusTimer.current);};
  }, []);

  const goNext = () => {
    Keyboard.dismiss();
    const error = step === 2 ? bodyInputError(heightCm, weightKg) : null;
    setErrorMessage(error);
    if (!error) setStep(current => Math.min(current + 1, 4) as Step);
  };
  const goBack = () => {
    if (saving.current) return;
    Keyboard.dismiss();
    locationRequest.current++;
    setLocating(false);
    setErrorMessage(null);
    eggAnimation.current?.stop();
    if (step === 1) {
      onBack();
      return;
    }
    setStep(current => Math.max(current - 1, 1) as Step);
  };
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {goBack(); return true;});
    return () => listener.remove();
  });

  const selectRegion = (region: Region) => {
    locationRequest.current++;
    setLocating(false);
    setSelectedRegion(region);
    setLocationMessage(`${region.label} 지역을 선택했어요.`);
  };
  const useCurrentLocation = async () => {
    if (locating) return;
    Keyboard.dismiss();
    const request = ++locationRequest.current;
    setLocating(true);
    setLocationMessage('현재 위치로 지역을 찾고 있어요…');
    try {
      const region = await detectOnboardingRegion();
      if (!mounted.current || request !== locationRequest.current) return;
      setSelectedRegion(region);
      setLocationMessage(`현재 위치 기준 ${region.label} 지역을 선택했어요.`);
    } catch (error) {
      if (mounted.current && request === locationRequest.current) {
        setLocationMessage(error instanceof Error ? error.message : '지역을 직접 선택해 주세요.');
      }
    } finally {
      if (mounted.current && request === locationRequest.current) setLocating(false);
    }
  };

  // 알이 위에서 떨어져 통통 튄 뒤 살짝 흔들림. 부화는 첫 달리기 완료 화면에서
  const runEggGiftAnimation = () => {
    setEggReceived(false);
    eggDrop.setValue(0);
    eggWobble.setValue(0);
    eggAnimation.current?.stop();
    eggAnimation.current = Animated.sequence([
      Animated.spring(eggDrop, {toValue: 1, friction: 5, tension: 60, useNativeDriver: true}),
      Animated.loop(
        Animated.sequence([
          Animated.timing(eggWobble, {toValue: 1, duration: 140, useNativeDriver: true}),
          Animated.timing(eggWobble, {toValue: -1, duration: 140, useNativeDriver: true}),
          Animated.timing(eggWobble, {toValue: 0, duration: 140, useNativeDriver: true}),
        ]),
        {iterations: 2},
      ),
    ]);
    eggAnimation.current.start(({finished}) => {if (finished && mounted.current) setEggReceived(true);});
  };

  const openEggGiftStep = () => {
    if (!selectedRegion || locating) return;
    Keyboard.dismiss();
    setErrorMessage(null);
    setCharacterType(pickStarterCharacter());
    setStep(4);
    requestAnimationFrame(runEggGiftAnimation);
  };

  const saveOnboarding = async () => {
    if (saving.current || !eggReceived || !selectedRegion) return;
    saving.current = true;
    const profile: OnboardingProfileInput = {
      displayName,
      petName,
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
      if (mounted.current) setErrorMessage(error instanceof Error ? error.message : '온보딩 저장에 실패했어요.');
    } finally {
      saving.current = false;
      if (mounted.current) setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={styles.softGlowTop} />
      <View style={styles.softGlowBottom} />
      <View style={styles.header}>
        <TouchableOpacity accessibilityLabel="이전 단계" disabled={isSaving} activeOpacity={0.75} onPress={goBack} style={styles.backButton}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.progressWrap}>
          <Text style={styles.progressTitle}>STEP {step} / 4 · {getStepName(step)}</Text>
          <ProgressBar step={step} />
        </View>
      </View>
      <KeyboardAvoidingView style={styles.keyboardView} enabled={Platform.OS === 'ios'} behavior="padding">
      <View style={[styles.keyboardView, {paddingBottom: keyboardInset}]}>
      <ScrollView ref={scroll} onScroll={event => {scrollOffset.current = event.nativeEvent.contentOffset.y;}} scrollEventThrottle={16} onLayout={() => {if (Keyboard.isVisible()) revealFocusedInput();}} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} contentContainerStyle={[styles.stepScroll, {paddingBottom: 34 + keyboardHeight}]}>
      {step === 1 && (
        <View>
          <Text style={styles.stepTitle}>기본 정보를{'\n'}입력해 주세요!</Text>
          <EggImage size={110} />
          <LabeledInput label="이름" value={displayName} onChangeText={setDisplayName} onFocus={revealFocusedInput} placeholder="이름을 입력해 주세요" maxLength={20} />
          <LabeledInput label="달료 펫 이름(닉네임)" value={petName} onChangeText={setPetName} onFocus={revealFocusedInput} placeholder="달료 펫의 이름을 입력해 주세요" maxLength={20} />
          <Text style={styles.inputLabel}>성별</Text>
          <View style={styles.segmentRow}>
            <TouchableOpacity activeOpacity={0.8} onPress={() => setGender('female')} style={[styles.segment, gender === 'female' && styles.segmentActive]}>
              <Text style={[styles.segmentText, gender === 'female' && styles.segmentActiveText]}>여성</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.8} onPress={() => setGender('male')} style={[styles.segment, gender === 'male' && styles.segmentActive]}>
              <Text style={[styles.segmentText, gender === 'male' && styles.segmentActiveText]}>남성</Text>
            </TouchableOpacity>
          </View>
          <LabeledInput label="외부 링크 (선택)" value={website} onChangeText={setWebsite} onFocus={revealFocusedInput} placeholder="블로그, 인스타그램 등 링크를 입력해 주세요" maxLength={500} />
          <PrimaryButton label="다음" onPress={goNext} disabled={!displayName.trim() || !petName.trim()} />
        </View>
      )}
      {step === 2 && (
        <View style={styles.stepPanel}>
          <Text style={styles.stepTitle}>신체 정보를{'\n'}입력해 주세요!</Text>
          <EggImage size={168} />
          <LabeledInput label="키" value={heightCm} onChangeText={setHeightCm} onFocus={revealFocusedInput} placeholder="키를 입력해 주세요" suffix="cm" keyboardType="numeric" />
          <LabeledInput label="몸무게" value={weightKg} onChangeText={setWeightKg} onFocus={revealFocusedInput} placeholder="몸무게를 입력해 주세요" suffix="kg" keyboardType="numeric" />
          <View style={styles.stepSpacer} />
          {!!errorMessage && <Text accessibilityRole="alert" style={styles.errorText}>{errorMessage}</Text>}
          <PrimaryButton label="다음" onPress={goNext} />
          <TouchableOpacity activeOpacity={0.75} onPress={() => {setHeightCm('');setWeightKg('');setErrorMessage(null);Keyboard.dismiss();setStep(3);}} style={styles.skipButton}>
            <Text style={styles.skipButtonText}>건너뛰기</Text>
          </TouchableOpacity>
        </View>
      )}
      {step === 3 && (
        <View style={styles.stepPanel}>
          <Text style={styles.stepTitle}>어디에서{'\n'}달리시나요?</Text>
          <EggImage size={156} />
          <TouchableOpacity accessibilityRole="button" disabled={locating} onPress={useCurrentLocation} activeOpacity={0.86} style={[styles.locationButton, locating && styles.wideButtonDisabled]}>
            <Text style={styles.locationButtonText}>{locating ? '현재 위치 확인 중…' : '● 현재 위치로 설정'}</Text>
          </TouchableOpacity>
          <Text accessibilityLiveRegion="polite" style={styles.locationHint}>{locationMessage || '주로 달릴 지역을 선택해 주세요. 위치 권한 없이도 직접 선택할 수 있어요.'}</Text>
          <Text style={styles.attribution}>위치 기반 지역 조회: © OpenStreetMap 기여자</Text>
          <View style={styles.regionGrid}>
            {regions.map(region => (
              <TouchableOpacity
                activeOpacity={0.8}
                key={region.label}
                accessibilityRole="button"
                accessibilityState={{selected: selectedRegion?.label === region.label}}
                onPress={() => selectRegion(region)}
                style={[styles.regionChip, selectedRegion?.label === region.label && styles.regionChipActive]}>
                <Text style={[styles.regionText, selectedRegion?.label === region.label && styles.regionTextActive]}>{region.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.stepSpacer} />
          <PrimaryButton label="다음" onPress={openEggGiftStep} disabled={!selectedRegion || locating} />
        </View>
      )}
      {step === 4 && (
        <View style={styles.stepPanel}>
          <Text style={styles.stepTitle}>{eggReceived ? `${petName.trim()}의 알을\n받았어요!` : '달료 알이 도착했어요!'}</Text>
          <Text style={styles.hatchSubtitle}>
            {eggReceived ? '첫 달리기를 마치면 알이 부화해요.' : '어떤 친구가 들어 있을까요?'}
          </Text>
          <View style={styles.hatchStage}>
            <Animated.View style={{transform: [{translateY: eggTranslateY}, {scale: eggScale}, {rotate}]}}>
              <EggImage size={210} />
            </Animated.View>
          </View>
          {!!errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}
          <PrimaryButton label={isSaving ? '저장중...' : eggReceived ? '달리기 시작하기' : '두근두근...'} onPress={saveOnboarding} disabled={!eggReceived || isSaving} />
        </View>
      )}
      </ScrollView>
      </View>
      </KeyboardAvoidingView>
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
  maxLength,
  onFocus,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  suffix?: string;
  keyboardType?: 'default' | 'numeric';
  maxLength?: number;
  onFocus: () => void;
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} onFocus={onFocus} maxLength={maxLength} keyboardType={keyboardType} placeholder={placeholder} placeholderTextColor="#B6B6B6" style={styles.input} />
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
    <TouchableOpacity accessibilityRole="button" accessibilityState={{disabled: !!disabled}} activeOpacity={0.86} disabled={disabled} onPress={onPress} style={[styles.wideButton, disabled && styles.wideButtonDisabled]}>
      <Text style={styles.wideButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

function getStepName(step: Step) {
  if (step === 1) return '기본 정보';
  if (step === 2) return '신체 정보';
  if (step === 3) return '내 지역';
  return '알 받기';
}

function parseOptionalNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.background},
  softGlowTop: {position: 'absolute', left: -80, top: -80, width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(174,232,225,0.35)'},
  softGlowBottom: {position: 'absolute', right: -100, bottom: -110, width: 280, height: 280, borderRadius: 140, backgroundColor: 'rgba(191,237,214,0.45)'},
  header: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, paddingTop: 12, minHeight: 62},
  backButton: {width: 36, height: 44, justifyContent: 'center'},
  backText: {color: TEXT, fontSize: 42, lineHeight: 42},
  progressWrap: {flex: 1},
  progressTitle: {color: '#777777', fontSize: 13, fontFamily: fonts.bold, marginBottom: 8},
  progressRow: {flexDirection: 'row', gap: 6},
  progressSegment: {flex: 1, height: 5, borderRadius: 3, backgroundColor: '#D8D8D8'},
  progressSegmentActive: {backgroundColor: MINT},
  keyboardView: {flex: 1},
  stepScroll: {flexGrow: 1, paddingHorizontal: 26, paddingTop: 28, paddingBottom: 34},
  stepPanel: {flexGrow: 1},
  locationHint: {color: MUTED, fontSize: 14, lineHeight: 21, marginBottom: 8},
  attribution: {color: MUTED, fontSize: 11, marginBottom: 16},
  stepContent: {flex: 1, paddingHorizontal: 32, paddingTop: 46, paddingBottom: 34},
  stepTitle: {color: TEXT, fontSize: 28, fontFamily: fonts.extrabold, lineHeight: 38, marginBottom: 24},
  profileCircle: {alignSelf: 'center', width: 156, height: 156, borderRadius: 78, borderWidth: 1, borderColor: '#9BE2C6', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginBottom: 24},
  profileCharacter: {width: 146, height: 146},
  cameraBadge: {position: 'absolute', right: -5, bottom: 8, width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: '#8CDBBF', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center'},
  cameraText: {color: MINT, fontSize: 18, fontFamily: fonts.extrabold},
  inputGroup: {marginBottom: 16},
  inputLabel: {color: '#222222', fontSize: 15, fontFamily: fonts.extrabold, marginBottom: 8},
  inputWrap: {height: 50, borderWidth: 1, borderColor: '#DCDCDC', borderRadius: 9, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16},
  input: {flex: 1, color: TEXT, fontSize: 16, fontFamily: fonts.medium, paddingVertical: 0},
  inputSuffix: {color: '#666666', fontSize: 14, fontFamily: fonts.extrabold},
  segmentRow: {flexDirection: 'row', gap: 12, marginBottom: 18},
  segment: {flex: 1, height: 46, borderWidth: 1, borderColor: '#D8D8D8', borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF'},
  segmentActive: {borderColor: MINT, backgroundColor: colors.primarySoft},
  segmentText: {color: '#4B4B4B', fontSize: 15, fontFamily: fonts.bold},
  segmentActiveText: {color: colors.primaryInk, fontSize: 15, fontFamily: fonts.extrabold},
  eggImage: {alignSelf: 'center', marginBottom: 26},
  stepSpacer: {flex: 1},
  skipButton: {height: 58, borderRadius: 10, backgroundColor: 'rgba(88,207,166,0.12)', alignItems: 'center', justifyContent: 'center', marginTop: 14},
  skipButtonText: {color: colors.primaryInk, fontSize: 18, fontFamily: fonts.extrabold},
  locationButton: {height: 56, borderWidth: 1, borderColor: MINT, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.68)', marginBottom: 20},
  locationButtonText: {color: colors.primaryInk, fontSize: 17, fontFamily: fonts.extrabold},
  regionGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
  regionChip: {width: '18%', minWidth: 58, height: 52, borderWidth: 1, borderColor: '#DFDFDF', borderRadius: 10, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center'},
  regionChipActive: {backgroundColor: MINT, borderColor: MINT},
  regionText: {color: '#333333', fontSize: 15, fontFamily: fonts.bold},
  regionTextActive: {color: '#FFFFFF', fontFamily: fonts.extrabold},
  hatchContent: {flex: 1, paddingHorizontal: 32, paddingTop: 50, paddingBottom: 34},
  hatchSubtitle: {color: MUTED, fontSize: 16, fontFamily: fonts.semibold, marginTop: -12, marginBottom: 36},
  hatchStage: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  errorText: {color: '#C95B5B', fontSize: 14, fontFamily: fonts.bold, lineHeight: 20, textAlign: 'center', marginBottom: 12},
  wideButton: {height: 58, borderRadius: 18, backgroundColor: MINT, alignItems: 'center', justifyContent: 'center', shadowColor: MINT, shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: {width: 0, height: 8}, elevation: 0},
  wideButtonDisabled: {opacity: 0.45},
  wideButtonText: {color: '#FFFFFF', fontSize: 16, fontFamily: fonts.semibold},
});
