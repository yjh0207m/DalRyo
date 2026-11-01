// 서버가 본문을 2000자까지 받으므로, 위치 한 줄과 태그를 더해도 넘지 않게 입력 길이를 제한한다
export const MAX_CONTENT_LENGTH = 1500;
export const MAX_TAG_INPUT_LENGTH = 200;
const MAX_TAGS = 10;
const MAX_TAG_LENGTH = 30;

// 쉼표나 띄어쓰기로 나눈 입력을 #태그 목록으로 정리한다. # 유무와 특수문자는 신경 쓰지 않아도 된다.
// 서버가 본문의 #태그를 읽어 저장하므로 여기서는 모양만 맞춘다
export function parseTags(input: string): string[] {
  const tags: string[] = [];
  for (const token of input.split(/[\s,]+/)) {
    const name = token
      // _ 를 뺀 ASCII 기호(#, !, ? 등)를 지운다
      .replace(/[!-/:-@[-^`{-~]/g, '')
      .slice(0, MAX_TAG_LENGTH);
    if (name && !tags.includes(`#${name}`)) tags.push(`#${name}`);
    if (tags.length === MAX_TAGS) break;
  }
  return tags;
}

// 직접 쓴 내용, 공개하기로 한 위치, 태그를 줄바꿈으로 이어 본문을 만든다
export function buildPostText({
  content,
  tags,
  location,
}: {
  content: string;
  tags: string;
  location: string | null;
}) {
  const lines: string[] = [];
  const body = content.trim();
  if (body) lines.push(body);
  if (location) lines.push(`📍 ${location}`);
  const hashtags = parseTags(tags);
  if (hashtags.length > 0) lines.push(hashtags.join(' '));
  return lines.join('\n');
}
