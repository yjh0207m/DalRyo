import React from 'react';
import { Platform } from 'react-native';
import Renderer, { act } from 'react-test-renderer';
import { requestPhoneVerification } from '../src/services/auth.service';
import { usePhoneAuth } from '../src/store/useAuthStore';

jest.mock('../src/services/auth.service', () => ({
  requestPhoneVerification: jest.fn(),
  verifyPhoneCode: jest.fn(),
}));

test('iOS web authentication can be retried after closing a blank page', async () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  const request = jest.mocked(requestPhoneVerification);
  request.mockRejectedValueOnce(
    Object.assign(new Error('Web context canceled'), {
      code: 'auth/web-context-cancelled',
    }),
  );
  request.mockResolvedValueOnce({ verificationId: 'fixture', confirm: jest.fn() });

  let state!: ReturnType<typeof usePhoneAuth>;
  function PhoneAuthProbe() {
    state = usePhoneAuth();
    return null;
  }

  let tree: Renderer.ReactTestRenderer | undefined;
  try {
    await act(() => {
      tree = Renderer.create(<PhoneAuthProbe />);
    });
    await act(() => state.requestCode('+821055500000'));
    expect(state.state).toBe('error');
    expect(state.errorMessage).toContain('다시 시도');
    expect(state.canRequestCode).toBe(true);
    expect(state.canVerifyCode).toBe(false);

    await act(() => state.requestCode('+821055500000'));
    expect(state.state).toBe('codeSent');
    expect(state.errorMessage).toBeNull();
    expect(state.canVerifyCode).toBe(true);
  } finally {
    await act(() => tree?.unmount());
    jest.restoreAllMocks();
  }
});
