import React, {useMemo, useRef, useState} from 'react';
import {
  Animated,
  Image,
  ImageBackground,
  ImageSourcePropType,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {signInWithGoogle, signInWithKakao} from '../../services/auth.service';
import type {AuthProviderId} from '../../types/auth.types';

const images = {
  bgDay: require('../../assets/images/bg-day.png'),
  bgDusk: require('../../assets/images/bg-dusk.png'),
  avatar: require('../../assets/images/dalryo-avatar.png'),
  google: require('../../assets/images/google.png'),
  kakao: require('../../assets/images/kakao.png'),
  penguinRun: require('../../assets/images/penguin.png'),
  rabbitRun: require('../../assets/images/rabbit.png'),
};

type LoginButton = {
  provider: AuthProviderId;
  label: string;
  icon?: ImageSourcePropType;
  fallback?: string;
  onPress: () => void;
};

type Props = {
  isLoggedIn: boolean;
  onStart: () => void;
  onPhoneLogin: () => void;
  onSocialLoginReady: () => void;
};

const MINT = '#58CFA6';
const SUNSET_START_HOUR = 18;
const SUNRISE_HOUR = 6;

export function AuthStartScreen({isLoggedIn, onStart, onPhoneLogin, onSocialLoginReady}: Props) {
  const {height} = useWindowDimensions();
  const [isLoginSheetVisible, setLoginSheetVisible] = useState(false);
  const [socialMessage, setSocialMessage] = useState<string | null>(null);
  const sheetProgress = useRef(new Animated.Value(0)).current;
  const isDusk = useMemo(() => shouldUseDuskBackground(new Date()), []);
  const accent = isDusk ? '#78E0C5' : MINT;

  const openLoginSheet = () => {
    setSocialMessage(null);
    setLoginSheetVisible(true);
    Animated.spring(sheetProgress, {
      toValue: 1,
      useNativeDriver: true,
      damping: 18,
      stiffness: 170,
      mass: 0.9,
    }).start();
  };

  const closeLoginSheet = (afterClose?: () => void) => {
    Animated.timing(sheetProgress, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(({finished}) => {
      if (finished) {
        setLoginSheetVisible(false);
        afterClose?.();
      }
    });
  };

  const handleSocialLogin = async (provider: Exclude<AuthProviderId, 'phone'>) => {
    try {
      if (provider === 'google') {
        await signInWithGoogle();
      } else {
        await signInWithKakao();
      }
      closeLoginSheet(onSocialLoginReady);
    } catch (error) {
      setSocialMessage(error instanceof Error ? error.message : '아직 사용할 수 없는 로그인 방식이에요.');
    }
  };

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
      <StartCharacters height={height} />
      <View style={styles.bottomContent}>
        <Text style={styles.message}>{isDusk ? '하루의 끝, 러닝으로 마무리해요' : '좋은 아침이에요!'}</Text>
        <Text style={styles.messageStrong}>{isDusk ? '오늘도 수고했어요!' : '오늘도 함께 달려볼까요?'}</Text>
        <TouchableOpacity activeOpacity={0.86} onPress={onStart} style={styles.startButton}>
          <Text style={styles.startButtonText}>시작하기</Text>
        </TouchableOpacity>
        {!isLoggedIn && (
          <TouchableOpacity activeOpacity={0.75} onPress={openLoginSheet} style={styles.loginLink}>
            <Text style={[styles.loginLinkText, {color: accent}]}>로그인</Text>
          </TouchableOpacity>
        )}
      </View>
      {isLoginSheetVisible && (
        <LoginSheet
          accent={accent}
          progress={sheetProgress}
          socialMessage={socialMessage}
          onClose={() => closeLoginSheet()}
          onGoogle={() => handleSocialLogin('google')}
          onKakao={() => handleSocialLogin('kakao')}
          onPhone={() => closeLoginSheet(onPhoneLogin)}
        />
      )}
    </ImageBackground>
  );
}

function StartCharacters({height}: {height: number}) {
  const characterBottom = Math.max(135, Math.min(220, height * 0.24));
  const characterSize = Math.max(150, Math.min(208, height * 0.26));

  return (
    <View pointerEvents="none" style={[styles.characters, {bottom: characterBottom}]}>
      <Image source={images.penguinRun} resizeMode="contain" style={[styles.penguin, {width: characterSize, height: characterSize * 1.14}]} />
      <Image source={images.rabbitRun} resizeMode="contain" style={[styles.rabbit, {width: characterSize, height: characterSize * 1.14}]} />
    </View>
  );
}

function LoginSheet({
  accent,
  progress,
  socialMessage,
  onClose,
  onGoogle,
  onKakao,
  onPhone,
}: {
  accent: string;
  progress: Animated.Value;
  socialMessage: string | null;
  onClose: () => void;
  onGoogle: () => void;
  onKakao: () => void;
  onPhone: () => void;
}) {
  const buttons: LoginButton[] = [
    {provider: 'google', label: 'Google로 시작하기', icon: images.google, onPress: onGoogle},
    {provider: 'kakao', label: 'KakaoTalk으로 시작하기', icon: images.kakao, onPress: onKakao},
    {provider: 'phone', label: '전화번호로 시작하기', fallback: '☎', onPress: onPhone},
  ];
  const overlayOpacity = progress.interpolate({inputRange: [0, 1], outputRange: [0, 0.34]});
  const sheetTranslateY = progress.interpolate({inputRange: [0, 1], outputRange: [430, 0]});

  return (
    <View style={styles.absoluteFill}>
      <Pressable onPress={onClose} style={styles.absoluteFill}>
        <Animated.View style={[styles.overlay, {opacity: overlayOpacity}]} />
      </Pressable>
      <Animated.View style={[styles.sheet, {transform: [{translateY: sheetTranslateY}]}]}>
        <View style={styles.handle} />
        <Image source={images.avatar} resizeMode="cover" style={styles.avatar} />
        <Text style={[styles.sheetTitle, {color: accent}]}>달료~ 함께 달리는 즐거움!</Text>
        {!!socialMessage && <Text style={styles.sheetMessage}>{socialMessage}</Text>}
        <View style={styles.buttonStack}>
          {buttons.map(button => (
            <TouchableOpacity activeOpacity={0.82} key={button.provider} onPress={button.onPress} style={styles.loginButton}>
              <View style={styles.iconSlot}>
                {button.icon ? (
                  <Image source={button.icon} resizeMode="contain" style={styles.iconImage} />
                ) : (
                  <Text style={styles.phoneIcon}>{button.fallback}</Text>
                )}
              </View>
              <Text style={styles.loginText}>{button.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

function shouldUseDuskBackground(now: Date) {
  const hour = now.getHours();
  return hour >= SUNSET_START_HOUR || hour < SUNRISE_HOUR;
}

const styles = StyleSheet.create({
  absoluteFill: {position: 'absolute', top: 0, right: 0, bottom: 0, left: 0},
  screen: {flex: 1, backgroundColor: '#8ED6FF'},
  scrim: {position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.05)'},
  duskScrim: {backgroundColor: 'rgba(0,0,0,0.16)'},
  safeArea: {flex: 1},
  brand: {alignItems: 'center', paddingTop: 108},
  logo: {fontSize: 58, fontWeight: '900', textShadowColor: 'rgba(255,255,255,0.92)', textShadowOffset: {width: 0, height: 2}, textShadowRadius: 2},
  tagline: {fontSize: 20, fontWeight: '900', marginTop: 8, textShadowColor: 'rgba(255,255,255,0.45)', textShadowOffset: {width: 0, height: 1}, textShadowRadius: 1},
  characters: {position: 'absolute', left: 18, right: 14, height: 250, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center'},
  penguin: {marginRight: -28, transform: [{rotate: '-2deg'}]},
  rabbit: {marginLeft: -24, transform: [{rotate: '2deg'}]},
  bottomContent: {position: 'absolute', left: 36, right: 36, bottom: 42, alignItems: 'center'},
  message: {color: '#FFFFFF', fontSize: 21, fontWeight: '900', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.28)', textShadowOffset: {width: 0, height: 2}, textShadowRadius: 8},
  messageStrong: {color: '#FFFFFF', fontSize: 24, fontWeight: '900', textAlign: 'center', marginTop: 8, marginBottom: 32, textShadowColor: 'rgba(0,0,0,0.34)', textShadowOffset: {width: 0, height: 2}, textShadowRadius: 8},
  startButton: {alignItems: 'center', alignSelf: 'stretch', backgroundColor: MINT, borderRadius: 26, justifyContent: 'center', minHeight: 62, shadowColor: '#000000', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: {width: 0, height: 8}, elevation: 8},
  startButtonText: {color: '#FFFFFF', fontSize: 27, fontWeight: '900'},
  loginLink: {marginTop: 38, paddingHorizontal: 24, paddingVertical: 8},
  loginLinkText: {fontSize: 21, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.22)', textShadowOffset: {width: 0, height: 1}, textShadowRadius: 4},
  overlay: {flex: 1, backgroundColor: '#000000'},
  sheet: {position: 'absolute', left: 18, right: 18, bottom: 0, minHeight: 342, backgroundColor: '#FFFFFF', borderTopLeftRadius: 34, borderTopRightRadius: 34, alignItems: 'center', paddingHorizontal: 26, paddingTop: 18, paddingBottom: 34, shadowColor: '#000000', shadowOpacity: 0.22, shadowRadius: 20, shadowOffset: {width: 0, height: -8}, elevation: 16},
  handle: {width: 56, height: 7, borderRadius: 4, backgroundColor: '#D8D8D8', marginBottom: 20},
  avatar: {width: 72, height: 72, borderRadius: 18, marginBottom: 16},
  sheetTitle: {fontSize: 18, fontWeight: '900', marginBottom: 12},
  sheetMessage: {color: '#8A8A8A', fontSize: 13, fontWeight: '700', lineHeight: 18, textAlign: 'center', marginBottom: 12},
  buttonStack: {alignSelf: 'stretch'},
  loginButton: {height: 50, borderRadius: 10, borderWidth: 1, borderColor: '#E1E5E4', flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', marginBottom: 11},
  iconSlot: {width: 76, alignItems: 'center', justifyContent: 'center'},
  iconImage: {width: 28, height: 28},
  phoneIcon: {color: '#58B89E', fontSize: 27, fontWeight: '900'},
  loginText: {flex: 1, color: '#62AA98', fontSize: 17, fontWeight: '800'},
});
