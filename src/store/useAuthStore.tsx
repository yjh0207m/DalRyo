import {useMemo, useState} from 'react';
import type {AuthResult, PhoneAuthState, PhoneConfirmation} from '../types/auth.types';
import {requestPhoneVerification, verifyPhoneCode} from '../services/auth.service';

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
      setErrorMessage(error instanceof Error ? error.message : '인증번호 요청에 실패했어요.');
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
