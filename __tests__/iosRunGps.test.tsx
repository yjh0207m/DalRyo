import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import Geolocation from '@react-native-community/geolocation';
import { useRunSession } from '../src/hooks/useRunSession';
import type { RunContext } from '../src/types/runSession';

jest.mock('@react-native-community/geolocation', () => ({
  setRNConfiguration: jest.fn(),
  watchPosition: jest.fn(() => 1),
  clearWatch: jest.fn(),
}));
jest.mock('../src/services/locationPermission.service', () => ({
  requestIosLocationPermission: jest.fn(async () => true),
}));
jest.mock('../src/services/runJournal.service', () => ({
  nativeRunTracker: undefined,
  writeFallbackSession: jest.fn(async () => {}),
}));

test('iOS uses the live GPS status after a session starts and recovers on an accurate fix', async () => {
  const platform = jest.replaceProperty(
    require('react-native').Platform,
    'OS',
    'ios',
  );
  const context: RunContext = {
    uid: 'runner',
    sessionKey: 'gps-test',
    goal: { goalType: 'free', goalValue: null },
    before: { stageBefore: 'baby', totalKmBefore: 0, wasFrozen: false },
    weightKg: 60,
  };
  let session!: ReturnType<typeof useRunSession>;
  function Probe() {
    session = useRunSession({ context });
    return null;
  }
  let tree: Renderer.ReactTestRenderer | undefined;
  try {
    await act(() => {
      tree = Renderer.create(<Probe />);
    });
    await act(() => session.begin());
    expect(session.phase).toBe('running');
    expect(session.gpsStatus).toBe('tracking');
    const [fix, fail] = jest.mocked(Geolocation.watchPosition).mock.calls[0];
    await act(() =>
      fail?.({
        code: 2,
        message: 'No fix',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      }),
    );
    expect(session.gpsStatus).toBe('error');
    const received = {
      coords: {
        latitude: 37,
        longitude: 127,
        accuracy: 30,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: 3,
      },
      timestamp: Date.now(),
    };
    await act(() => fix(received));
    expect(session.gpsStatus).toBe('error');
    await act(() =>
      fix({ ...received, coords: { ...received.coords, accuracy: 5 } }),
    );
    expect(session.gpsStatus).toBe('tracking');
  } finally {
    await act(() => tree?.unmount());
    platform.restore();
  }
});
