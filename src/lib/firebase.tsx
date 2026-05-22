import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import functions from '@react-native-firebase/functions';
import messaging from '@react-native-firebase/messaging';

// @react-native-firebase는 google-services.json / GoogleService-Info.plist에서
// 설정을 읽으므로 initializeApp() 호출 불필요

export { auth, firestore, storage, functions, messaging };
