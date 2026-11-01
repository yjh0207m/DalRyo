import {
  buildPostText,
  parseTags,
} from '../src/utils/shareCard';

test('tags are normalized however they are typed', () => {
  expect(parseTags('#오운완 #달료런')).toEqual(['#오운완', '#달료런']);
  expect(parseTags('오운완, 달료런')).toEqual(['#오운완', '#달료런']);
  expect(parseTags('##a !b? c_d')).toEqual(['#a', '#b', '#c_d']);
  expect(parseTags('#러닝 러닝 #러닝')).toEqual(['#러닝']);
  expect(parseTags('   ,, # ')).toEqual([]);
  expect(parseTags('')).toEqual([]);
});

test('tags are limited to 10 and each to 30 characters', () => {
  const many = Array.from({ length: 15 }, (_, i) => `t${i}`).join(' ');
  expect(parseTags(many)).toHaveLength(10);
  expect(parseTags('가'.repeat(40))[0]).toBe(`#${'가'.repeat(30)}`);
});

test('the post is the written content, then the chosen location, then the tags', () => {
  expect(
    buildPostText({
      content: '  한강에서 달렸어요  ',
      tags: '#오운완 #한강',
      location: '서울특별시 강남구',
    }),
  ).toBe('한강에서 달렸어요\n📍 서울특별시 강남구\n#오운완 #한강');
});

test('empty parts are left out, and with nothing at all the text is empty', () => {
  expect(buildPostText({ content: '', tags: '#오운완', location: null })).toBe(
    '#오운완',
  );
  expect(
    buildPostText({
      content: '오늘도',
      tags: '  ',
      location: '경기도 수원시 영통구',
    }),
  ).toBe('오늘도\n📍 경기도 수원시 영통구');
  expect(buildPostText({ content: ' ', tags: '', location: null })).toBe('');
});
