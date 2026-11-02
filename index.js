/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import messaging from '@react-native-firebase/messaging';
import { installIosBackBridge } from './src/navigation/backGesture';

// Notification payloads are displayed by the OS while the app is backgrounded.
messaging().setBackgroundMessageHandler(async () => {});

// iOS에서 화면 왼쪽 가장자리 스와이프로 뒤로 가려면 화면이 등록하는 뒤로가기를 가로채 둬야 해서, 화면을 그리기 전에 켠다
installIosBackBridge();

AppRegistry.registerComponent(appName, () => App);
