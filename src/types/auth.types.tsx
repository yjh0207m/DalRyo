import type {FirebaseAuthTypes} from '@react-native-firebase/auth';

export type AuthProviderId = 'phone' | 'google' | 'kakao';

export type PhoneConfirmation = FirebaseAuthTypes.ConfirmationResult;

export type PhoneAuthState =
  | 'idle'
  | 'requesting'
  | 'codeSent'
  | 'verifying'
  | 'verified'
  | 'error';

export type AuthResult = {
  uid: string;
  phoneNumber: string | null;
  isNewUser: boolean;
};
