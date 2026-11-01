import {calcDistanceKm, estimateCalories} from './distance';
import type {RunResult, RunSessionSnapshot} from '../types/runSession';
import type {GpsFix} from '../hooks/useGPS';

export function sessionResult(snapshot: RunSessionSnapshot): RunResult {
  const durationSec = Math.max(1, Math.round(snapshot.elapsedMs / 1000));
  const distanceKm = Math.round(snapshot.distanceKm * 1000) / 1000;
  return {startedAt: new Date(snapshot.startedAtMs), durationSec, distanceKm,
    avgSpeedKmh: Math.round(distanceKm / (durationSec / 3600) * 10) / 10,
    calories: estimateCalories(distanceKm, snapshot.context.weightKg), route: snapshot.route};
}

// 위치 사이 간격이 이보다 길면 '공백'으로 보고, 직선거리가 달리기로 볼 만한 속도일 때만 더한다.
// 화면이 꺼지면 iOS에서 위치 이벤트가 몰아서 늦게 오거나 드문드문 와서, 30초 넘는 간격이 흔하다
const NORMAL_GAP_MS = 30_000;
// 이보다 긴 공백은 얼마나 움직였는지 알 수 없으므로 잇지 않는다
const MAX_GAP_MS = 30 * 60_000;
// 짧은 간격에서 이 속도를 넘는 위치 튐은 버린다
const MAX_STEP_SPEED_KMH = 45;
// 간격이 길면 직선거리는 실제 경로보다 짧게 나오므로, 이 속도를 넘으면 달린 것이 아니라(차량 등) 튐으로 본다
const MAX_GAP_SPEED_KMH = 25;
// 달리기를 시작·재개하기 직전에 측정된 캐시 위치를 걸러내는 여유 시간
const STALE_START_MS = 3_000;

// iOS JS callbacks use wall-clock elapsed time, never a counter of timer ticks.
// On a cold launch, resume from the last durable checkpoint in a paused state.
export class RunAccumulator {
  private since: number | null;
  private last: GpsFix | null = null;
  private rejects = 0;
  constructor(public state: RunSessionSnapshot, restored = false, now = Date.now()) {
    if (restored && state.phase === 'running') state = this.state = {...state, phase: 'paused', speedKmh: 0, interrupted: true};
    this.since = state.phase === 'running' ? now : null;
  }
  snapshot(now = Date.now()): RunSessionSnapshot {
    return {...this.state, elapsedMs: this.state.elapsedMs + (this.since === null ? 0 : Math.max(0, now - this.since)), updatedAtMs: now,
      speedKmh: !this.last || now - this.last.receivedAt > 5000 ? 0 : this.state.speedKmh};
  }
  change(phase: RunSessionSnapshot['phase'], now = Date.now()) {
    this.state = {...this.snapshot(now), phase, speedKmh: 0};
    this.since = phase === 'running' ? now : null;
    this.last = null; this.rejects = 0;
    return this.snapshot(now);
  }
  fix(fix: GpsFix) {
    // 위치가 JS에 도착한 시각(receivedAt)이 늦었다고 버리지 않는다. 화면이 꺼진 동안 쌓인 위치가 한꺼번에 들어와도
    // 각자의 측정 시각(timestamp)으로 이어 계산해야 한다. 오래된 캐시 위치는 달리기 시작 시각으로 걸러낸다
    const notBefore = (this.since ?? 0) - STALE_START_MS;
    if (this.state.phase !== 'running' || !Number.isFinite(fix.lat) || !Number.isFinite(fix.lng) || Math.abs(fix.lat) > 90 || Math.abs(fix.lng) > 180 || !Number.isFinite(fix.accuracyM) || fix.accuracyM < 0 || fix.accuracyM > 25 || fix.timestamp < notBefore || fix.timestamp > fix.receivedAt + 5000) return;
    const last = this.last;
    if (last) {
      const dt = fix.timestamp - last.timestamp;
      if (dt <= 0) return;
      const step = calcDistanceKm(last.lat, last.lng, fix.lat, fix.lng);
      const speed = step / (dt / 3600000);
      const gap = dt > NORMAL_GAP_MS;
      if (dt > MAX_GAP_MS || (gap && speed > MAX_GAP_SPEED_KMH)) this.state.speedKmh = 0;
      else {
        if (!gap && speed > MAX_STEP_SPEED_KMH) {if (++this.rejects >= 3) {this.last = fix; this.rejects = 0;} return;}
        this.rejects = 0; this.state.distanceKm += step;
        this.state.speedKmh = this.state.speedKmh * 0.6 + Math.min(MAX_STEP_SPEED_KMH, fix.speedMps && fix.speedMps > 0 ? fix.speedMps * 3.6 : speed) * 0.4;
      }
    }
    this.last = fix;
    const route = this.state.route;
    const previous = route[route.length - 1];
    if (!previous || calcDistanceKm(previous.lat, previous.lng, fix.lat, fix.lng) >= 0.005) {
      if (route.length >= 6000) this.state.route = route.filter((_, index) => index % 2 === 0);
      this.state.route.push({lat: fix.lat, lng: fix.lng, timestamp: fix.timestamp});
    }
  }
}
