jest.mock('../src/services/character.service', () => ({
  fetchCharacterImageUrl: jest.fn(), fetchCharacterRiveUrl: jest.fn(),
}));
import {bundledCharacterRive, bundledCharacterStepMs} from '../src/components/character/characterAssets';

test('visually rejected biped rabbit is absent from the default approved registry', () => {
  expect(bundledCharacterRive('rabbit', 'baby')).toBeNull();
  expect(bundledCharacterRive('rabbit', 'child')).toBeNull();
  expect(bundledCharacterStepMs('rabbit', 'baby', 'run')).toBeNull();
});
