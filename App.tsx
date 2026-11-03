import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  LogBox,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import auth, { type FirebaseAuthTypes } from '@react-native-firebase/auth';
import { BackgroundTaskToast } from './src/components/ui/BackgroundTaskToast';
import { EdgeBackSwipe } from './src/navigation/backGesture';
import { animateTo } from './src/navigation/motion';
import { AuthStartScreen } from './src/screens/auth/SplashScreen';
import { PhoneLoginScreen } from './src/screens/auth/LoginScreen';
import { OnboardingScreen } from './src/screens/auth/OnboardingScreen';
import { MainAppScreen } from './src/screens/main/MainAppScreen';
import { DialectProvider } from './src/locales/DialectProvider';
import { fetchCurrentUserDocument } from './src/services/user.service';
import {
  fetchMyProfile,
  subscribeMyProfile,
  type UserProfileBundle,
} from './src/services/profile.service';

type Route = 'loading' | 'error' | 'start' | 'phone' | 'onboarding' | 'main';

// 홈이 다 그려지기를 기다리는 가장 긴 시간(ms). 인터넷이 느려도 로딩 화면에 갇히지 않게 한다
export const HOME_READY_MAX_MS = 10000;
// 로딩 화면이 걷히는 시간(ms)
const SPLASH_FADE_MS = 220;

LogBox.ignoreLogs([
  'This method is deprecated (as well as all React Native Firebase namespaced API)',
  'Method called was `onAuthStateChanged`',
]);

// 하단 탭바 등이 기기 홈 인디케이터 영역을 피할 수 있게 safe area 값을 제공한다
function App() {
  return (
    <SafeAreaProvider>
      <AppRoutes />
      {/* 게시 같은 백그라운드 요청의 진행 상태. 어느 화면에서든 위쪽에 작게 뜬다 */}
      <BackgroundTaskToast />
      {/* iOS 왼쪽 가장자리 스와이프로 뒤로 가기 */}
      <EdgeBackSwipe />
    </SafeAreaProvider>
  );
}

function AppRoutes() {
  // 저장된 로그인이 복원되기 전에 시작 화면이 잠깐 비치지 않도록 첫 인증 콜백이 올 때까지 로딩을 보여 준다
  const [route, setRoute] = useState<Route>('loading');
  const [firebaseUser, setFirebaseUser] =
    useState<FirebaseAuthTypes.User | null>(null);
  const [profile, setProfile] = useState<UserProfileBundle | null>(null);
  const entered = useRef(false);
  const authReady = useRef(false);
  const lastUid = useRef<string | null>(null);
  const routeRequest = useRef(0);
  const resolvingUid = useRef<string | null>(null);
  // 홈이 다 그려졌는지. 그때까지 로딩 화면을 홈 위에 덮어 둔다
  const [homeReady, setHomeReady] = useState(false);
  const [splashGone, setSplashGone] = useState(false);
  const splashOpacity = useRef(new Animated.Value(1)).current;
  const markHomeReady = useCallback(() => setHomeReady(true), []);

  useEffect(() => {
    if (route !== 'main') {
      setHomeReady(false);
      setSplashGone(false);
      splashOpacity.setValue(1);
      return undefined;
    }
    const timer = setTimeout(markHomeReady, HOME_READY_MAX_MS);
    return () => clearTimeout(timer);
  }, [route, markHomeReady, splashOpacity]);
  useEffect(() => {
    if (route !== 'main' || !homeReady) return;
    animateTo(splashOpacity, 0, {
      duration: SPLASH_FADE_MS,
      onEnd: () => setSplashGone(true),
    });
  }, [route, homeReady, splashOpacity]);

  const resolveRouteForUser = useCallback(
    async (user: FirebaseAuthTypes.User | null) => {
      if (!entered.current || (user && resolvingUid.current === user.uid))
        return;
      const request = ++routeRequest.current;
      resolvingUid.current = user?.uid ?? null;
      setFirebaseUser(user);

      if (!user) {
        setProfile(null);
        setRoute('phone');
        return;
      }

      const isCurrent = () =>
        entered.current &&
        routeRequest.current === request &&
        auth().currentUser?.uid === user.uid;
      try {
        const existingUser = await fetchCurrentUserDocument();
        if (!isCurrent()) return;

        if (existingUser) {
          const bundle = await fetchMyProfile();
          if (!isCurrent()) return;
          if (!bundle) throw new Error('프로필을 불러오지 못했어요.');
          setProfile(bundle);
          setRoute('main');
          return;
        }

        setProfile(null);
        setRoute('onboarding');
      } catch {
        if (isCurrent()) {
          setProfile(null);
          setRoute('error');
        }
      } finally {
        if (routeRequest.current === request) resolvingUid.current = null;
      }
    },
    [],
  );

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(user => {
      const previousUid = lastUid.current;
      const firstCallback = !authReady.current;
      authReady.current = true;
      lastUid.current = user?.uid ?? null;
      setFirebaseUser(user);
      // 앱을 켰을 때 저장된 로그인이 있으면 시작하기 화면을 건너뛰고 바로 들어간다
      if (firstCallback && user) entered.current = true;
      if (!entered.current || (!user && previousUid !== null)) {
        entered.current = false;
        routeRequest.current++;
        resolvingUid.current = null;
        setProfile(null);
        setRoute('start');
        return;
      }
      setRoute('loading');
      resolveRouteForUser(user);
    });

    return () => {
      unsubscribe();
      entered.current = false;
      authReady.current = false;
      lastUid.current = null;
      routeRequest.current += 1;
    };
  }, [resolveRouteForUser]);

  useEffect(() => {
    if (route !== 'main' || !firebaseUser) {
      return undefined;
    }

    return subscribeMyProfile(next => {
      if (entered.current && auth().currentUser?.uid === firebaseUser.uid)
        setProfile(next);
    });
  }, [firebaseUser, route]);

  const goToStartOrMain = async () => {
    if (entered.current) return;
    entered.current = true;
    setRoute('loading');
    // A quick tap can arrive before Firebase restores the saved session.
    // Wait for the initial auth callback instead of treating it as signed out.
    if (authReady.current) await resolveRouteForUser(auth().currentUser);
  };
  const returnToStart = () => {
    entered.current = false;
    routeRequest.current++;
    resolvingUid.current = null;
    setRoute('start');
  };

  if (route === 'error') {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <Text style={styles.loadingText}>계정 정보를 불러오지 못했어요.</Text>
        <Text>네트워크를 확인하고 다시 시도해 주세요.</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setRoute('loading');
            resolveRouteForUser(auth().currentUser);
          }}
          style={styles.retry}
        >
          <Text>다시 시도</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (route === 'phone') {
    return (
      <PhoneLoginScreen
        onBack={returnToStart}
        onVerified={() => {
          const user = auth().currentUser;
          if (user && authReady.current && lastUid.current === user.uid) return;
          setRoute('loading');
          resolveRouteForUser(user);
        }}
      />
    );
  }

  if (route === 'onboarding') {
    return (
      <OnboardingScreen
        onBack={returnToStart}
        onDone={() => {
          setRoute('loading');
          resolveRouteForUser(auth().currentUser);
        }}
      />
    );
  }

  // 시작·로딩·홈 대기 화면이 모두 트리의 같은 자리에 있는 같은 컴포넌트라서,
  // 서로 바뀌어도 배경 이미지가 다시 그려지지 않고 이어진다.
  // 홈은 그 아래에서 미리 그려 두고, 캐릭터까지 다 그려지면 로딩 화면을 걷는다
  const splashCovers = route !== 'main' || !splashGone;
  return (
    <View style={styles.root}>
      {route === 'main' && (
        <View
          style={styles.root}
          accessibilityElementsHidden={splashCovers}
          importantForAccessibility={
            splashCovers ? 'no-hide-descendants' : 'auto'
          }
        >
          <DialectProvider dialect={profile?.user.dialect}>
            <MainAppScreen
              user={profile?.user ?? null}
              character={profile?.character ?? null}
              onHomeReady={markHomeReady}
            />
          </DialectProvider>
        </View>
      )}
      {splashCovers && (
        <Animated.View
          pointerEvents={route === 'main' && homeReady ? 'none' : 'auto'}
          style={[StyleSheet.absoluteFill, { opacity: splashOpacity }]}
        >
          <AuthStartScreen
            loading={route !== 'start'}
            onStart={goToStartOrMain}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  retry: { padding: 20 },
  loadingScreen: {
    flex: 1,
    backgroundColor: '#F6FEFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  loadingText: {
    color: '#151515',
    fontSize: 17,
    fontWeight: '900',
    marginTop: 18,
  },
});

export default App;
