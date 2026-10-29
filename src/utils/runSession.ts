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
    if (this.state.phase !== 'running' || !Number.isFinite(fix.lat) || !Number.isFinite(fix.lng) || Math.abs(fix.lat) > 90 || Math.abs(fix.lng) > 180 || !Number.isFinite(fix.accuracyM) || fix.accuracyM < 0 || fix.accuracyM > 25 || fix.receivedAt - fix.timestamp > 15000 || fix.timestamp > fix.receivedAt + 5000) return;
    const last = this.last;
    if (last) {
      const dt = fix.timestamp - last.timestamp;
      if (dt <= 0) return;
      const step = calcDistanceKm(last.lat, last.lng, fix.lat, fix.lng);
      const speed = step / (dt / 3600000);
      if (dt > 30000) this.state.speedKmh = 0;
      else {
        if (speed > 45) {if (++this.rejects >= 3) {this.last = fix; this.rejects = 0;} return;}
        this.rejects = 0; this.state.distanceKm += step;
        this.state.speedKmh = this.state.speedKmh * 0.6 + Math.min(45, fix.speedMps && fix.speedMps > 0 ? fix.speedMps * 3.6 : speed) * 0.4;
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
