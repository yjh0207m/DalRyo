import React, {useState} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {colors, fonts, statusBarStyle, themedStyles} from '../../theme';
import {usePhoneAuth} from '../../store/useAuthStore';
import type {AuthResult} from '../../types/auth.types';


type Props = {
  onBack: () => void;
  onVerified: (result: AuthResult) => void;
};

export function PhoneLoginScreen({onBack, onVerified}: Props) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');
  const {canRequestCode, canVerifyCode, errorMessage, requestCode, state, verifyCode} = usePhoneAuth();

  const handleRequestCode = () => {
    if (!phoneNumber.trim()) {
      return;
    }
    requestCode(phoneNumber);
  };

  const handleVerifyCode = async () => {
    const result = await verifyCode(code);

    if (result) {
      onVerified(result);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle={statusBarStyle()} backgroundColor={colors.background} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardView}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <TouchableOpacity activeOpacity={0.75} onPress={onBack} style={styles.backButton}>
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.title}>달료 시작하기</Text>
          <Text style={styles.subtitle}>같이 달릴 준비를 해볼까요?</Text>

          <Text style={styles.inputLabel}>휴대폰 번호</Text>
          <TextInput
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
            placeholder="010 - 1234 - 5678"
            placeholderTextColor={colors.textSubtle}
            style={styles.input}
          />

          <Text style={styles.inputLabel}>인증번호</Text>
          <View style={styles.otpRow}>
            <TextInput
              value={code}
              onChangeText={setCode}
              editable={canVerifyCode}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="인증번호 6자리를 입력해주세요"
              placeholderTextColor={colors.textSubtle}
              style={[styles.input, styles.otpInput]}
            />
            <TouchableOpacity activeOpacity={0.82} disabled={!canRequestCode} onPress={handleRequestCode} style={[styles.requestButton, !canRequestCode && styles.disabledButton]}>
              <Text style={styles.requestButtonText}>{state === 'requesting' ? '요청중' : '인증요청'}</Text>
            </TouchableOpacity>
          </View>

          {Platform.OS === 'ios' && state === 'requesting' ? (
            <Text style={styles.timerText}>웹 인증 화면이 열리면 인증을 마친 뒤 앱으로 돌아와 주세요.</Text>
          ) : canVerifyCode ? (
            <Text style={styles.timerText}>
              문자로 받은 인증번호를 입력해 주세요. 문자가 오지 않으면 다시 요청해 주세요.
            </Text>
          ) : state === 'idle' ? (
            <Text style={styles.timerText}>휴대폰 번호를 입력한 뒤 인증요청을 눌러 주세요.</Text>
          ) : null}
          {!!errorMessage && <Text accessibilityRole="alert" style={styles.errorText}>{errorMessage}</Text>}

          <TouchableOpacity
            activeOpacity={0.86}
            disabled={!canVerifyCode || code.length < 6}
            onPress={handleVerifyCode}
            style={[styles.nextButton, (!canVerifyCode || code.length < 6) && styles.nextButtonDisabled]}>
            <Text style={styles.nextButtonText}>{state === 'verifying' ? '확인중' : '다음'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = themedStyles(() => ({
  screen: {flex: 1, backgroundColor: colors.background},
  keyboardView: {flex: 1},
  content: {paddingHorizontal: 38, paddingTop: 24, paddingBottom: 340},
  backButton: {width: 42, height: 50, justifyContent: 'center', marginLeft: -12, marginBottom: 50},
  backText: {color: colors.text, fontSize: 42, lineHeight: 42},
  title: {color: colors.primaryStrong, fontSize: 40, fontFamily: fonts.extrabold},
  subtitle: {color: colors.textMuted, fontSize: 19, fontFamily: fonts.medium, marginTop: 16, marginBottom: 72},
  inputLabel: {color: colors.text, fontSize: 16, fontFamily: fonts.extrabold, marginBottom: 10},
  input: {height: 58, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface, color: colors.text, fontSize: 18, fontFamily: fonts.medium, paddingHorizontal: 18, marginBottom: 34},
  otpRow: {flexDirection: 'row', gap: 12},
  otpInput: {flex: 1, marginBottom: 0},
  requestButton: {width: 108, height: 58, borderWidth: 1, borderColor: colors.primaryBorder, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface},
  disabledButton: {opacity: 0.55},
  requestButtonText: {color: colors.primaryStrong, fontSize: 16, fontFamily: fonts.extrabold},
  timerText: {color: colors.textMuted, fontSize: 15, marginTop: 18},
  errorText: {color: colors.danger, fontSize: 14, fontFamily: fonts.bold, lineHeight: 20, marginTop: 12},
  nextButton: {height: 62, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 70, shadowColor: colors.primary, shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: {width: 0, height: 8}, elevation: 0},
  nextButtonDisabled: {opacity: 0.45},
  nextButtonText: {color: colors.textOnPrimary, fontSize: 22, fontFamily: fonts.extrabold},
}));
