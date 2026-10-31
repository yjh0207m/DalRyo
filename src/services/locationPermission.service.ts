import Geolocation from '@react-native-community/geolocation';

// iOS의 이 라이브러리는 위치 권한 상태가 "바뀔 때만" requestAuthorization 콜백을 부른다.
// 이미 허용/거부가 정해진 뒤 다시 호출하면 콜백이 오지 않아 Promise가 영영 끝나지 않고,
// 달리기 화면은 '달리기 준비 중'에서 넘어가지 못한다. 그래서 허용 결과를 기억해 다시 묻지 않고,
// 이미 응답을 받은 뒤에도 콜백이 없으면 상태가 그대로인 것이므로 거부로 처리한다.
const REASK_TIMEOUT_MS = 1500;
let granted = false;
let answered = false;

export function requestIosLocationPermission() {
  if (granted) return Promise.resolve(true);
  return new Promise<boolean>(resolve => {
    const timer = answered ? setTimeout(() => resolve(false), REASK_TIMEOUT_MS) : undefined;
    Geolocation.requestAuthorization(
      () => {clearTimeout(timer); granted = answered = true; resolve(true);},
      () => {clearTimeout(timer); answered = true; resolve(false);},
    );
  });
}
