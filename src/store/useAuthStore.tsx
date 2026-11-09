import {useMemo, useState} from 'react';
import {Platform} from 'react-native';
import type {AuthResult, PhoneAuthState, PhoneConfirmation} from '../types/auth.types';
import {requestPhoneVerification, verifyPhoneCode} from '../services/auth.service';

function requestErrorMessage(error: unknown) {
  if (Platform.OS === 'ios' && error instanceof Error && 'code' in error) {
    switch (error.code) {
      case 'auth/web-context-cancelled':
      case 'auth/web-context-canceled':
        return '웹 인증 화면이 닫혔어요. 인증요청을 눌러 다시 시도해 주세요.';
      case 'auth/network-request-failed':
      case 'auth/web-network-request-failed':
        return '인증 서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.';
      case 'auth/app-verification-user-interaction-failure':
      case 'auth/captcha-check-failed':
      case 'auth/web-internal-error':
      case 'auth/web-sign-in-user-interaction-failure':
        return `웹 인증을 완료하지 못했어요. 화면을 닫고 다시 요청해 주세요. (${error.code})`;
    }
  }
  return error instanceof Error ? error.message : '인증번호 요청에 실패했어요.';
}

export function usePhoneAuth() {
  const [state, setState] = useState<PhoneAuthState>('idle');
  const [confirmation, setConfirmation] = useState<PhoneConfirmation | null>(null);
  const [authResult, setAuthResult] = useState<AuthResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canRequestCode = state !== 'requesting' && state !== 'verifying';
  const canVerifyCode = useMemo(() => !!confirmation && state !== 'verifying', [confirmation, state]);

  const requestCode = async (phoneNumber: string) => {
    setState('requesting');
    setErrorMessage(null);

    try {
      const nextConfirmation = await requestPhoneVerification(phoneNumber);
      setConfirmation(nextConfirmation);
      setState('codeSent');
    } catch (error) {
      setState('error');
      setErrorMessage(requestErrorMessage(error));
    }
  };

  const verifyCode = async (code: string) => {
    if (!confirmation) {
      setState('error');
      setErrorMessage('먼저 인증번호를 요청해 주세요.');
      return null;
    }

    setState('verifying');
    setErrorMessage(null);

    try {
      const result = await verifyPhoneCode(confirmation, code);
      setAuthResult(result);
      setState('verified');
      return result;
    } catch (error) {
      setState('error');
      setErrorMessage(error instanceof Error ? error.message : '인증번호 확인에 실패했어요.');
      return null;
    }
  };

  return {
    authResult,
    canRequestCode,
    canVerifyCode,
    errorMessage,
    requestCode,
    state,
    verifyCode,
  };
}
