import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  LogBox,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import auth, { type FirebaseAuthTypes } from '@react-native-firebase/auth';
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

LogBox.ignoreLogs([
  'This method is deprecated (as well as all React Native Firebase namespaced API)',
  'Method called was `onAuthStateChanged`',
]);

// 하단 탭바 등이 기기 홈 인디케이터 영역을 피할 수 있게 safe area 값을 제공한다
function App() {
  return (
    <SafeAreaProvider>
      <AppRoutes />
    </SafeAreaProvider>
  );
}

function AppRoutes() {
  const [route, setRoute] = useState<Route>('start');
  const [firebaseUser, setFirebaseUser] =
    useState<FirebaseAuthTypes.User | null>(null);
  const [profile, setProfile] = useState<UserProfileBundle | null>(null);
  const entered = useRef(false);
  const authReady = useRef(false);
  const lastUid = useRef<string | null>(null);
  const routeRequest = useRef(0);
  const resolvingUid = useRef<string | null>(null);

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
      authReady.current = true;
      lastUid.current = user?.uid ?? null;
      setFirebaseUser(user);
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

  if (route === 'loading') {
    return <LoadingScreen />;
  }
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

  if (route === 'main') {
    return (
      <DialectProvider dialect={profile?.user.dialect}>
        <MainAppScreen
          user={profile?.user ?? null}
          character={profile?.character ?? null}
        />
      </DialectProvider>
    );
  }

  return <AuthStartScreen onStart={goToStartOrMain} />;
}

function LoadingScreen() {
  return (
    <SafeAreaView style={styles.loadingScreen}>
      <StatusBar barStyle="dark-content" backgroundColor="#F6FEFF" />
      <View style={styles.loadingCard}>
        <ActivityIndicator color="#58CFA6" size="large" />
        <Text style={styles.loadingText}>달료 준비 중...</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  retry: { padding: 20 },
  loadingScreen: {
    flex: 1,
    backgroundColor: '#F6FEFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  loadingCard: {
    minWidth: 190,
    minHeight: 150,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#A7D7C4',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  loadingText: {
    color: '#151515',
    fontSize: 17,
    fontWeight: '900',
    marginTop: 18,
  },
});

export default App;
