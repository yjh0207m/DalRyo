import React, {useState} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {usePhoneAuth} from '../../store/useAuthStore';
import type {AuthResult} from '../../types/auth.types';


type Props = {
  onBack: () => void;
  onVerified: (result: AuthResult) => void;
};

const MINT = '#58CFA6';
const GREEN = '#78B85F';
const TEXT = '#151515';

export function PhoneLoginScreen({onBack, onVerified}: Props) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');
  const {canRequestCode, canVerifyCode, errorMessage, requestCode, state, verifyCode} = usePhoneAuth();
  const isCodeSent = state === 'codeSent' || state === 'error' || state === 'verifying';

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
      <StatusBar barStyle="dark-content" backgroundColor="#F6FEFF" />
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
            placeholderTextColor="#B6B6B6"
            style={styles.input}
          />

          <Text style={styles.inputLabel}>인증번호</Text>
          <View style={styles.otpRow}>
            <TextInput
              value={code}
              onChangeText={setCode}
              editable={isCodeSent}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="인증번호 6자리를 입력해주세요"
              placeholderTextColor="#B6B6B6"
              style={[styles.input, styles.otpInput]}
            />
            <TouchableOpacity activeOpacity={0.82} disabled={!canRequestCode} onPress={handleRequestCode} style={[styles.requestButton, !canRequestCode && styles.disabledButton]}>
              <Text style={styles.requestButtonText}>{state === 'requesting' ? '요청중' : '인증요청'}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.timerText}>
            {state === 'codeSent' ? '인증번호를 입력해 주세요.' : '인증번호가 오지 않았나요?'}  <Text style={styles.timerStrong}>00:59</Text>
          </Text>
          {!!errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

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

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#F6FEFF'},
  keyboardView: {flex: 1},
  content: {paddingHorizontal: 38, paddingTop: 24, paddingBottom: 340},
  backButton: {width: 42, height: 50, justifyContent: 'center', marginLeft: -12, marginBottom: 50},
  backText: {color: TEXT, fontSize: 42, lineHeight: 42},
  title: {color: GREEN, fontSize: 40, fontWeight: '900'},
  subtitle: {color: '#727272', fontSize: 19, fontWeight: '500', marginTop: 16, marginBottom: 72},
  inputLabel: {color: '#222222', fontSize: 16, fontWeight: '900', marginBottom: 10},
  input: {height: 58, borderWidth: 1, borderColor: '#DCDCDC', borderRadius: 12, backgroundColor: '#FFFFFF', color: TEXT, fontSize: 18, fontWeight: '600', paddingHorizontal: 18, marginBottom: 34},
  otpRow: {flexDirection: 'row', gap: 12},
  otpInput: {flex: 1, marginBottom: 0},
  requestButton: {width: 108, height: 58, borderWidth: 1, borderColor: '#BFE7D5', borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF'},
  disabledButton: {opacity: 0.55},
  requestButtonText: {color: GREEN, fontSize: 16, fontWeight: '900'},
  timerText: {color: '#888888', fontSize: 15, marginTop: 18},
  timerStrong: {color: GREEN, fontWeight: '900'},
  errorText: {color: '#C95B5B', fontSize: 14, fontWeight: '800', lineHeight: 20, marginTop: 12},
  nextButton: {height: 62, borderRadius: 14, backgroundColor: MINT, alignItems: 'center', justifyContent: 'center', marginTop: 70, shadowColor: MINT, shadowOpacity: 0.24, shadowRadius: 16, shadowOffset: {width: 0, height: 8}, elevation: 6},
  nextButtonDisabled: {opacity: 0.45},
  nextButtonText: {color: '#FFFFFF', fontSize: 22, fontWeight: '900'},
});
