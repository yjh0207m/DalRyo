jest.mock('../src/lib/firebase', () => ({firestore: jest.fn(), storage: jest.fn()}));
jest.mock('@react-native-firebase/firestore', () => ({
  __esModule: true, default: {FieldValue: {serverTimestamp: () => 'server-time'}},
}));

import {buildInitialCharacter, pickStarterCharacter} from '../src/services/character.service';
import {CHARACTER_TYPES, SHOP_CHARACTER_TYPES, STARTER_CHARACTER_TYPES} from '../src/types/character.types';

afterEach(() => jest.restoreAllMocks());

test('starter selection reaches rabbit and duck across the entire random range', () => {
  const random = jest.spyOn(Math, 'random');
  expect(STARTER_CHARACTER_TYPES).toEqual(['rabbit', 'duck']);
  for (const [value, expected] of [[0,'rabbit'],[0.499999,'rabbit'],[0.5,'duck'],[0.999999,'duck']] as const) {
    random.mockReturnValue(value);
    expect(pickStarterCharacter()).toBe(expected);
  }
});

test('all other animals require shop acquisition and cannot be initialized as starters', () => {
  expect(SHOP_CHARACTER_TYPES).toHaveLength(35);
  expect(SHOP_CHARACTER_TYPES).toContain('penguin');
  for (const characterType of CHARACTER_TYPES) {
    const create = () => buildInitialCharacter({uid:'new-user',petName:'달료',characterType});
    if (characterType === 'rabbit' || characterType === 'duck') {
      expect(create()).toMatchObject({stage:'egg',character_type:characterType,exp:0});
      expect(SHOP_CHARACTER_TYPES).not.toContain(characterType);
    } else {
      expect(create).toThrow('기본 캐릭터는 토끼와 오리만 받을 수 있어요.');
    }
  }
});
