import React from 'react';
import {act, create, type ReactTestRenderer} from 'react-test-renderer';
import {DialectProvider, useDialect} from '../src/locales/DialectProvider';
import {createTranslator, messages, type MessageKey} from '../src/locales/translate';

test.each(['seoul', 'gyeonggi', 'gangwon', undefined, null, 'unknown', '__proto__'])(
  '기존 지역 코드와 알 수 없는 말투는 표준어로 표시한다: %s',
  dialect => {
    expect(createTranslator(dialect)('run.start')).toBe('달료!');
  },
);

test('방언마다 모든 키와 보간 변수가 동일하게 존재한다', () => {
  const keys = Object.keys(messages.std).sort() as MessageKey[];
  for (const catalog of Object.values(messages)) {
    expect(Object.keys(catalog).sort()).toEqual(keys);
    for (const key of keys) {
      expect(catalog[key].trim().length).toBeGreaterThan(0);
      expect(catalog[key].match(/\{\{\w+\}\}/g) ?? []).toEqual(messages.std[key].match(/\{\{\w+\}\}/g) ?? []);
    }
  }
});

test('이름의 달러 기호를 치환 문법으로 해석하지 않는다', () => {
  expect(createTranslator('chung')('run.completeBody', {name: '$&달료'})).toBe('$&달료도 한 뼘 더 자랐슈');
});

test('말투가 바뀌면 같은 화면을 재마운트하지 않고 문구를 바꾼다', async () => {
  let value = '';
  let mounts = 0;
  let renderer: ReactTestRenderer;
  function Probe() {
    const t = useDialect();
    React.useEffect(() => {
      mounts += 1;
    }, []);
    value = t('run.start');
    return null;
  }
  await act(async () => {
    renderer = create(
      <DialectProvider dialect="std">
        <Probe />
      </DialectProvider>,
    );
  });
  expect(value).toBe('달료!');
  await act(async () => {
    renderer.update(
      <DialectProvider dialect="gyeong">
        <Probe />
      </DialectProvider>,
    );
  });
  expect(value).toBe('달려뿌라!');
  expect(mounts).toBe(1);
  await act(async () => {
    renderer.unmount();
  });
});
