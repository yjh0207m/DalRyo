/* eslint-env jest */
// 화면 전환 애니메이션은 테스트에서 끄고 바로 끝난 상태로 만든다. 전환 로직(어느 화면이 되는지)은 그대로 검증한다
const { motion } = require('./src/navigation/motion');

motion.enabled = false;

// 기기 저장소는 네이티브 모듈이라 테스트에서는 라이브러리가 제공하는 메모리 구현을 쓴다(테마 설정 저장 등).
// 테스트 파일에서 따로 jest.mock하면 그쪽이 우선한다
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
