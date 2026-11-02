// 앱 안에서 나를 가리키는 아이디. 닉네임과 달리 겹치지 않고, 프로필 맨 위에 @아이디로 보인다
export const USER_ID_PATTERN = /^[a-z0-9_]{4,20}$/;
export const USER_ID_RULE = '영문 소문자, 숫자, 밑줄(_)로 4~20자';

// 앞의 @와 공백을 떼고 소문자로 맞춘다. 입력칸과 검색어 모두 이 값을 기준으로 본다
export function normalizeUserId(value: string) {
  return value.trim().replace(/^@/, '').toLowerCase();
}

// 올바르지 않으면 이유를, 올바르면 null
export function userIdError(value: string) {
  return USER_ID_PATTERN.test(normalizeUserId(value))
    ? null
    : `아이디는 ${USER_ID_RULE}로 입력해 주세요.`;
}
