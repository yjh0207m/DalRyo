import React, {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, LogBox, StatusBar, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import auth, {type FirebaseAuthTypes} from '@react-native-firebase/auth';
import {AuthStartScreen} from './src/screens/auth/SplashScreen';
import {PhoneLoginScreen} from './src/screens/auth/LoginScreen';
import {OnboardingScreen} from './src/screens/auth/OnboardingScreen';
import {MainAppScreen} from './src/screens/main/MainAppScreen';
import {fetchCurrentUserDocument} from './src/services/user.service';
import {fetchMyProfile, subscribeMyProfile, type UserProfileBundle} from './src/services/profile.service';

type Route = 'loading' | 'start' | 'phone' | 'onboarding' | 'main';

LogBox.ignoreLogs([
  'This method is deprecated (as well as all React Native Firebase namespaced API)',
  'Method called was `onAuthStateChanged`',
]);

function App() {
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

    if (existingUser) {
      const bundle = await fetchMyProfile();
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
        setRoute(user ? 'onboarding' : 'start');
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

    await resolveRouteForUser(firebaseUser);
  };

  if (route === 'loading') {
    return <LoadingScreen />;
  }

  if (route === 'phone') {
    return (
      <PhoneLoginScreen
        onBack={() => setRoute('start')}
        onVerified={() => {
          setRoute('loading');
          resolveRouteForUser(auth().currentUser).catch(() => setRoute('onboarding'));
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
            .catch(() => setRoute('main'));
        }}
      />
    );
  }

  if (route === 'main') {
    return <MainAppScreen user={profile?.user ?? null} character={profile?.character ?? null} />;
  }

  return (
    <AuthStartScreen
      isLoggedIn={!!firebaseUser && !!profile?.user}
      onStart={goToStartOrMain}
      onPhoneLogin={() => setRoute('phone')}
      onSocialLoginReady={() => resolveRouteForUser(auth().currentUser)}
    />
  );
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
  loadingScreen: {flex: 1, backgroundColor: '#F6FEFF', alignItems: 'center', justifyContent: 'center', padding: 28},
  loadingCard: {minWidth: 190, minHeight: 150, borderRadius: 24, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#A7D7C4', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: {width: 0, height: 8}, elevation: 6},
  loadingText: {color: '#151515', fontSize: 17, fontWeight: '900', marginTop: 18},
});

export default App;
