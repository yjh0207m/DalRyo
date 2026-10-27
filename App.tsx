import React, {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, LogBox, Pressable, StatusBar, StyleSheet, Text, View} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import auth, {type FirebaseAuthTypes} from '@react-native-firebase/auth';
import {AuthStartScreen} from './src/screens/auth/SplashScreen';
import {PhoneLoginScreen} from './src/screens/auth/LoginScreen';
import {OnboardingScreen} from './src/screens/auth/OnboardingScreen';
import {MainAppScreen} from './src/screens/main/MainAppScreen';
import {DialectProvider} from './src/locales/DialectProvider';
import {fetchCurrentUserDocument} from './src/services/user.service';
import {fetchMyProfile, subscribeMyProfile, type UserProfileBundle} from './src/services/profile.service';

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
  const [route, setRoute] = useState<Route>('loading');
  const [firebaseUser, setFirebaseUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [profile, setProfile] = useState<UserProfileBundle | null>(null);

  const resolveRouteForUser = useCallback(async (user: FirebaseAuthTypes.User | null) => {
    setFirebaseUser(user);

    if (!user) {
      setProfile(null);
      setRoute('start');
      return;
    }

    const existingUser = await fetchCurrentUserDocument();
    if (auth().currentUser?.uid !== user.uid) return;

    if (existingUser) {
      const bundle = await fetchMyProfile();
      if (auth().currentUser?.uid !== user.uid) return;
      if (!bundle) throw new Error('프로필을 불러오지 못했어요.');
      setProfile(bundle);
      setRoute('main');
      return;
    }

    setProfile(null);
    setRoute('onboarding');
  }, []);

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(user => {
      resolveRouteForUser(user).catch(() => {
        setProfile(null);
        if (auth().currentUser?.uid === user?.uid) setRoute(user ? 'error' : 'start');
      });
    });

    return unsubscribe;
  }, [resolveRouteForUser]);

  useEffect(() => {
    if (route !== 'main' || !firebaseUser) {
      return undefined;
    }

    return subscribeMyProfile(setProfile);
  }, [firebaseUser, route]);

  const goToStartOrMain = async () => {
    if (!firebaseUser) {
      setRoute('phone');
      return;
    }

    setRoute('loading');
    await resolveRouteForUser(firebaseUser).catch(() => setRoute('error'));
  };

  if (route === 'loading') {
    return <LoadingScreen />;
  }
  if (route === 'error') {
    return <SafeAreaView style={styles.loadingScreen}>
      <Text style={styles.loadingText}>계정 정보를 불러오지 못했어요.</Text>
      <Text>네트워크를 확인하고 다시 시도해 주세요.</Text>
      <Pressable accessibilityRole="button" onPress={() => {
        setRoute('loading');
        resolveRouteForUser(auth().currentUser).catch(() => setRoute('error'));
      }} style={styles.retry}><Text>다시 시도</Text></Pressable>
    </SafeAreaView>;
  }

  if (route === 'phone') {
    return (
      <PhoneLoginScreen
        onBack={() => setRoute('start')}
        onVerified={() => {
          setRoute('loading');
          resolveRouteForUser(auth().currentUser).catch(() => setRoute('error'));
        }}
      />
    );
  }

  if (route === 'onboarding') {
    return (
      <OnboardingScreen
        onBack={() => setRoute(firebaseUser ? 'start' : 'phone')}
        onDone={() => {
          fetchMyProfile()
            .then(nextProfile => {
              setProfile(nextProfile);
              setRoute('main');
            })
            .catch(() => setRoute('error'));
        }}
      />
    );
  }

  if (route === 'main') {
    return <DialectProvider dialect={profile?.user.dialect}><MainAppScreen user={profile?.user ?? null} character={profile?.character ?? null} /></DialectProvider>;
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
  retry: {padding:20},
  loadingScreen: {flex: 1, backgroundColor: '#F6FEFF', alignItems: 'center', justifyContent: 'center', padding: 28},
  loadingCard: {minWidth: 190, minHeight: 150, borderRadius: 24, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#A7D7C4', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: {width: 0, height: 8}, elevation: 6},
  loadingText: {color: '#151515', fontSize: 17, fontWeight: '900', marginTop: 18},
});

export default App;
