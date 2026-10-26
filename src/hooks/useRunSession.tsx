import {useCallback, useEffect, useRef, useState} from 'react';
import type {GpsPoint} from '../types/run.types';
import {calcDistanceKm, estimateCalories} from '../utils/distance';
import {useGPS, type GpsFix} from './useGPS';

export type RunPhase = 'ready' | 'running' | 'paused' | 'finished';

export type RunResult = {
  startedAt: Date;
  durationSec: number;
  distanceKm: number;
  avgSpeedKmh: number;
  calories: number;
  route: GpsPoint[];
};

// 사람이 달릴 수 없는 속도로 튄 위치는 GPS 오차로 보고 버린다
const MAX_PLAUSIBLE_KMH = 45;
// 경로는 이 거리 이상 움직였을 때만 저장 (Firestore 도큐먼트 크기 절약)
const ROUTE_MIN_STEP_KM = 0.005;
// 이 시간 동안 새 위치가 없으면 멈춘 것으로 본다
const STALE_FIX_MS = 5000;

export function useRunSession({weightKg}: {weightKg: number | null}) {
  const [phase, setPhase] = useState<RunPhase>('ready');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [distanceKm, setDistanceKm] = useState(0);
  const [speedKmh, setSpeedKmh] = useState(0);

  const phaseRef = useRef<RunPhase>('ready');
  const startedAtRef = useRef<Date | null>(null);
  const activeSinceRef = useRef<number | null>(null);
  const accumulatedMsRef = useRef(0);
  const distanceRef = useRef(0);
  const lastFixRef = useRef<GpsFix | null>(null);
  const routeRef = useRef<GpsPoint[]>([]);

  const setPhaseBoth = (next: RunPhase) => {
    phaseRef.current = next;
    setPhase(next);
  };

  const handleFix = useCallback((fix: GpsFix) => {
    if (phaseRef.current !== 'running') {
      return;
    }

    const last = lastFixRef.current;
    if (last) {
      const stepKm = calcDistanceKm(last.lat, last.lng, fix.lat, fix.lng);
      const dtHours = Math.max(1, fix.timestamp - last.timestamp) / 3_600_000;
      const impliedKmh = stepKm / dtHours;

      if (impliedKmh > MAX_PLAUSIBLE_KMH) {
        return;
      }

      distanceRef.current += stepKm;
      setDistanceKm(distanceRef.current);
      const measuredKmh = fix.speedMps !== null ? fix.speedMps * 3.6 : impliedKmh;
      setSpeedKmh(prev => prev * 0.6 + measuredKmh * 0.4);
    }

    lastFixRef.current = fix;

    const route = routeRef.current;
    const lastPoint = route[route.length - 1];
    if (!lastPoint || calcDistanceKm(lastPoint.lat, lastPoint.lng, fix.lat, fix.lng) >= ROUTE_MIN_STEP_KM) {
      route.push({lat: fix.lat, lng: fix.lng, timestamp: fix.timestamp});
    }
  }, []);

  const {status: gpsStatus, start: startGps, stop: stopGps} = useGPS(handleFix);

  useEffect(() => {
    if (phase !== 'running') {
      return undefined;
    }

    const timer = setInterval(() => {
      const now = Date.now();
      setElapsedSec(Math.floor((accumulatedMsRef.current + now - (activeSinceRef.current ?? now)) / 1000));

      const last = lastFixRef.current;
      if (!last || now - last.timestamp > STALE_FIX_MS) {
        setSpeedKmh(0);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [phase]);

  const begin = useCallback(async () => {
    startedAtRef.current = new Date();
    activeSinceRef.current = Date.now();
    setPhaseBoth('running');
    return startGps();
  }, [startGps]);

  const pause = useCallback(() => {
    if (phaseRef.current !== 'running') return;
    accumulatedMsRef.current += Date.now() - (activeSinceRef.current ?? Date.now());
    activeSinceRef.current = null;
    // 멈춘 동안 이동한 거리는 다시 출발할 때 합산하지 않는다
    lastFixRef.current = null;
    setSpeedKmh(0);
    setPhaseBoth('paused');
  }, []);

  const resume = useCallback(() => {
    if (phaseRef.current !== 'paused') return;
    activeSinceRef.current = Date.now();
    setPhaseBoth('running');
  }, []);

  const finish = useCallback((): RunResult => {
    if (phaseRef.current === 'running') {
      accumulatedMsRef.current += Date.now() - (activeSinceRef.current ?? Date.now());
      activeSinceRef.current = null;
    }
    stopGps();
    setPhaseBoth('finished');

    const durationSec = Math.max(1, Math.round(accumulatedMsRef.current / 1000));
    const finalKm = Math.round(distanceRef.current * 1000) / 1000;

    return {
      startedAt: startedAtRef.current ?? new Date(),
      durationSec,
      distanceKm: finalKm,
      avgSpeedKmh: Math.round((finalKm / (durationSec / 3600)) * 10) / 10,
      calories: estimateCalories(finalKm, weightKg),
      route: routeRef.current,
    };
  }, [stopGps, weightKg]);

  return {
    phase,
    elapsedSec,
    distanceKm,
    speedKmh,
    calories: estimateCalories(distanceKm, weightKg),
    gpsStatus,
    begin,
    pause,
    resume,
    finish,
  };
}
