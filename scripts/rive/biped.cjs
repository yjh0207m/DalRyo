// Shared two-leg gait. Coordinates are in artboard pixels; angles are radians.
// Images never determine joint locations: the species manifest does.
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mod = v => ((v % 1) + 1) % 1;
const GAITS = Object.freeze(require('../../assets/rive/biped-v1.motion.json'));

function solveLeg(dx, dy, upper, lower) {
  const distance = Math.hypot(dx, dy);
  const reach = clamp(
    distance,
    Math.abs(upper - lower) + 0.001,
    upper + lower - 0.001,
  );
  const a =
    Math.atan2(dy, dx) -
    Math.acos(
      clamp(
        (upper * upper + reach * reach - lower * lower) / (2 * upper * reach),
        -1,
        1,
      ),
    );
  const b = Math.acos(
    clamp(
      (reach * reach - upper * upper - lower * lower) / (2 * upper * lower),
      -1,
      1,
    ),
  );
  return { upper: a, lower: b, reachError: Math.abs(reach - distance) };
}

function footAt(gait, phase) {
  const p = mod(phase);
  if (p <= gait.duty)
    return {
      x: gait.stride * (0.5 - p / gait.duty),
      lift: 0,
      pitch: 0,
      contact: true,
    };
  const t = (p - gait.duty) / (1 - gait.duty);
  // Smooth horizontal turn-around, with a toe-up recovery and flat landing.
  const smooth = t * t * (3 - 2 * t);
  return {
    x: gait.stride * (smooth - 0.5),
    lift: Math.sin(Math.PI * t) * gait.lift,
    pitch: -0.32 * Math.sin(TAU * t) * Math.sin(Math.PI * t),
    contact: false,
  };
}

function frameAt(config, motion, phase) {
  const rig = config.rig;
  const p = mod(phase);
  const gait = GAITS[motion];
  const jumping = motion === 'jump';
  const frozen = motion === 'stone';
  const jumpT = clamp(phase, 0, 1);
  const jumpHeight =
    jumping && jumpT > 0.16 && jumpT < 0.8
      ? Math.sin((Math.PI * (jumpT - 0.16)) / 0.64) * 60
      : 0;
  const crouch = jumping
    ? jumpT < 0.16
      ? Math.sin((Math.PI * jumpT) / 0.16) * 9
      : jumpT > 0.8
      ? Math.sin((Math.PI * (jumpT - 0.8)) / 0.2) * 7
      : 0
    : 0;
  const highPoint = gait ? gait.duty / 2 + (gait.duty < 0.5 ? 0.25 : 0) : 0;
  const rootY =
    (gait ? rig.hipY : rig.restHipY ?? rig.hipY) +
    (gait ? (-gait.bob * (1 + Math.cos(2 * TAU * (p - highPoint)))) / 2 : 0) -
    jumpHeight +
    crouch;
  const lean = gait
    ? gait.lean + 0.018 * Math.sin(2 * TAU * p)
    : jumping
    ? -0.04 * Math.sin(Math.PI * jumpT)
    : 0;
  const result = {
    rootY,
    lean,
    head: frozen
      ? 0
      : -lean * 0.58 + (gait ? 0.025 : 0.01) * Math.sin(TAU * p - 0.5),
    earNear: frozen ? 0 : (gait ? 0.14 : 0.035) * Math.sin(TAU * p - 0.7),
    earFar: frozen ? 0 : (gait ? 0.18 : 0.045) * Math.sin(TAU * p - 1.05),
    tail: frozen ? 0 : (gait ? 0.12 : 0.03) * Math.sin(TAU * p - 0.9),
    breath:
      !gait && !jumping && motion !== 'stone'
        ? 1 + 0.008 * Math.sin(TAU * p)
        : 1,
    legs: {},
    arms: {},
  };
  for (const side of ['near', 'far']) {
    const sidePhase = p + (side === 'far' ? 0.5 : 0);
    const hip = rig.hips[side];
    const foot = gait
      ? footAt(gait, sidePhase)
      : { x: side === 'near' ? 5 : -5, lift: 0, pitch: 0, contact: true };
    const ankleY = jumping
      ? rig.groundY - rig.sole - jumpHeight - jumpHeight * 0.3
      : rig.groundY - rig.sole - foot.lift;
    const angles = solveLeg(foot.x, ankleY - rootY, rig.upperLeg, rig.lowerLeg);
    result.legs[side] = {
      ...angles,
      foot: foot.pitch - angles.upper - angles.lower,
      targetX: rig.centerX + hip + foot.x,
      targetY: ankleY,
      contact: foot.contact && !jumping,
    };
    const swing = gait
      ? Math.cos(TAU * sidePhase) * gait.arm
      : frozen
      ? 0
      : 0.035 * Math.sin(TAU * p);
    result.arms[side] = {
      upper:
        Math.PI / 2 + swing - (jumping ? 1.25 * Math.sin(Math.PI * jumpT) : 0),
      lower: gait
        ? gait.elbow + 0.12 * Math.sin(TAU * sidePhase)
        : jumping
        ? -0.9 * Math.sin(Math.PI * jumpT)
        : -0.22,
    };
  }
  return result;
}

function validateConfig(config) {
  if (!config || !config.rig || !config.parts || !config.atlas)
    throw Error('Missing character manifest sections');
  if (config.family !== 'biped-v1')
    throw Error(
      'Unsupported rig family; choose a template matching the species.',
    );
  if (!['baby', 'child', 'runner'].includes(config.stage))
    throw Error('Invalid artboard stage');
  const r = config.rig;
  if (
    ![config.atlas.width, config.atlas.height].every(
      v => Number.isFinite(v) && v > 0,
    )
  )
    throw Error('Invalid atlas dimensions');
  for (const key of [
    'centerX',
    'hipY',
    'groundY',
    'sole',
    'upperLeg',
    'lowerLeg',
    'upperArm',
    'lowerArm',
  ]) {
    if (!Number.isFinite(r[key])) throw Error(`Missing finite rig.${key}`);
  }
  if (r.upperLeg <= 0 || r.lowerLeg <= 0 || r.upperArm <= 0 || r.lowerArm <= 0)
    throw Error('Limb lengths must be positive');
  if (r.groundY !== 410)
    throw Error('App ground contract is y=410 in a 500px artboard');
  for (const side of ['near', 'far']) {
    if (
      !Number.isFinite(r.hips?.[side]) ||
      !Array.isArray(r.shoulders?.[side]) ||
      r.shoulders[side].length !== 2 ||
      !r.shoulders[side].every(Number.isFinite)
    )
      throw Error(`Missing joint pivots for ${side}`);
  }
  if (
    !Array.isArray(r.head) ||
    r.head.length !== 2 ||
    !r.head.every(Number.isFinite)
  )
    throw Error('Missing head pivot');
  const required = [
    'head',
    'torso',
    'pelvis',
    'upperArmNear',
    'lowerArmNear',
    'upperArmFar',
    'lowerArmFar',
    'upperLegNear',
    'lowerLegNear',
    'footNear',
    'upperLegFar',
    'lowerLegFar',
    'footFar',
  ];
  for (const name of required) {
    const part = config.parts[name];
    if (
      !part ||
      !Array.isArray(part.rect) ||
      part.rect.length !== 4 ||
      part.rect.some(v => !Number.isFinite(v))
    )
      throw Error(`Missing atlas region: ${name}`);
    const [x, y, w, h] = part.rect;
    if (
      x < 0 ||
      y < 0 ||
      w <= 0 ||
      h <= 0 ||
      x + w > config.atlas.width ||
      y + h > config.atlas.height
    )
      throw Error(`Out-of-bounds atlas region: ${name}`);
  }
  for (const [name, part] of Object.entries(config.parts)) {
    if (
      !Array.isArray(part.rect) ||
      part.rect.length !== 4 ||
      !part.rect.every(Number.isFinite)
    )
      throw Error(`Invalid atlas region: ${name}`);
    const [x, y, width, height] = part.rect;
    if (
      x < 0 ||
      y < 0 ||
      width <= 0 ||
      height <= 0 ||
      x + width > config.atlas.width ||
      y + height > config.atlas.height
    )
      throw Error(`Out-of-bounds atlas region: ${name}`);
    if (
      part.size &&
      (part.size.length !== 2 ||
        part.size.some(v => !Number.isFinite(v) || v <= 0))
    )
      throw Error(`Invalid part size: ${name}`);
    if (
      part.width !== undefined &&
      (!Number.isFinite(part.width) || part.width <= 0)
    )
      throw Error(`Invalid part width: ${name}`);
  }
  for (const name of ['head', 'torso', 'pelvis', 'footNear', 'footFar'])
    if (!config.parts[name].size) throw Error(`Missing part size: ${name}`);
  for (const name of required.filter(
    n => n.includes('Arm') || n.includes('Leg'),
  ))
    if (!config.parts[name].width) throw Error(`Missing limb width: ${name}`);
  if (
    config.blink &&
    (config.blink.width !== config.atlas.width ||
      config.blink.height !== config.atlas.height)
  )
    throw Error('Blink atlas must share the source UV dimensions');
  if (
    config.stone &&
    (config.stone.width !== config.atlas.width ||
      config.stone.height !== config.atlas.height)
  )
    throw Error('Stone atlas must share the source UV dimensions');
  for (const motion of Object.keys(GAITS))
    for (let i = 0; i < 240; i++) {
      const pose = frameAt(config, motion, i / 240);
      for (const leg of Object.values(pose.legs))
        if (leg.reachError > 0.01)
          throw Error(
            `${motion} exceeds limb reach: adjust hip height/stride/lengths`,
          );
    }
}

module.exports = { GAITS, solveLeg, footAt, frameAt, validateConfig };
