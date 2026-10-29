const {
  GAITS,
  frameAt,
  footAt,
  solveLeg,
  validateConfig,
} = require('../scripts/rive/biped.cjs');
const { buildCharacter } = require('../scripts/rive/build-character.cjs');
const rabbit = require('../assets/rive/rabbit-v3/character.json');

test('each authored leg reaches its foot target while the foot sole stays level on contact', () => {
  for (const motion of ['idle', ...Object.keys(GAITS)])
    for (let frame = 0; frame < 240; frame++) {
      const pose = frameAt(rabbit, motion, frame / 240);
      for (const side of ['near', 'far']) {
        const leg = pose.legs[side];
        const x =
          rabbit.rig.centerX +
          rabbit.rig.hips[side] +
          Math.cos(leg.upper) * rabbit.rig.upperLeg +
          Math.cos(leg.upper + leg.lower) * rabbit.rig.lowerLeg;
        const y =
          pose.rootY +
          Math.sin(leg.upper) * rabbit.rig.upperLeg +
          Math.sin(leg.upper + leg.lower) * rabbit.rig.lowerLeg;
        expect(x).toBeCloseTo(leg.targetX, 5);
        expect(y).toBeCloseTo(leg.targetY, 5);
        if (leg.contact) {
          expect(y + rabbit.rig.sole).toBeCloseTo(410, 5);
          expect(leg.upper + leg.lower + leg.foot).toBeCloseTo(0, 5);
        }
      }
    }
});

test('walking always has a support foot; running has a real flight phase', () => {
  let flightFrames = 0;
  for (let i = 0; i < 120; i++) {
    const walk = frameAt(rabbit, 'walk', i / 120);
    expect(walk.legs.near.contact || walk.legs.far.contact).toBe(true);
    const run = frameAt(rabbit, 'run', i / 120);
    if (!run.legs.near.contact && !run.legs.far.contact) flightFrames++;
  }
  expect(flightFrames).toBeGreaterThan(0);
  expect(frameAt(rabbit, 'run', 0.46).rootY).toBeLessThan(
    frameAt(rabbit, 'run', 0.21).rootY,
  );
});

test('earless and tailless bipeds retain the same motion skeleton', () => {
  const config = JSON.parse(JSON.stringify(rabbit));
  delete config.parts.earNear;
  delete config.parts.earFar;
  delete config.parts.tail;
  delete config.rig.earNear;
  delete config.rig.earFar;
  expect(() => validateConfig(config)).not.toThrow();
  expect(buildCharacter(config)).toContain('name="ear.near"');
});

test('jump folds the knees in flight and returns to its grounded starting pose', () => {
  const start = frameAt(rabbit, 'jump', 0);
  const apex = frameAt(rabbit, 'jump', 0.5);
  const end = frameAt(rabbit, 'jump', 1);
  expect(apex.rootY).toBeLessThan(start.rootY - 50);
  expect(apex.legs.near.lower).toBeGreaterThan(start.legs.near.lower + 0.3);
  expect(end.rootY).toBeCloseTo(start.rootY, 5);
  expect(end.legs.near.targetY).toBeCloseTo(start.legs.near.targetY, 5);
});

test('legs recover independently instead of moving with a bouncing image', () => {
  const pose = frameAt(rabbit, 'run', 0.1);
  const separation = Array.from({ length: 120 }, (_, i) => {
    const p = frameAt(rabbit, 'run', i / 120);
    return Math.abs(p.legs.near.upper - p.legs.far.upper);
  });
  expect(Math.max(...separation)).toBeGreaterThan(0.5);
  expect(Math.abs(pose.arms.near.upper - pose.arms.far.upper)).toBeGreaterThan(
    1,
  );
  const roots = Array.from(
    { length: 32 },
    (_, i) => frameAt(rabbit, 'run', i / 32).rootY,
  );
  expect(Math.max(...roots) - Math.min(...roots)).toBeLessThanOrEqual(4.01);
  expect(GAITS.run.lift).toBeGreaterThan(7 * GAITS.run.bob);
});

test('cyclic poses and foot paths join without a seam', () => {
  for (const motion of ['idle', ...Object.keys(GAITS)]) {
    expect(frameAt(rabbit, motion, 0)).toEqual(frameAt(rabbit, motion, 1));
  }
  for (const gait of Object.values(GAITS) as Array<{ duty: number }>) {
    const before = footAt(gait, gait.duty - 0.000001);
    const after = footAt(gait, gait.duty + 0.000001);
    expect(Math.abs(before.x - after.x)).toBeLessThan(0.001);
    expect(Math.abs(before.lift - after.lift)).toBeLessThan(0.001);
  }
});

test('invalid artwork regions, impossible limb lengths and incompatible families are rejected', () => {
  expect(() => validateConfig(rabbit)).not.toThrow();
  const wrongAtlas = JSON.parse(JSON.stringify(rabbit));
  wrongAtlas.parts.head.rect[0] = 2000;
  expect(() => validateConfig(wrongAtlas)).toThrow('Out-of-bounds');
  const impossible = JSON.parse(JSON.stringify(rabbit));
  impossible.rig.upperLeg = 10;
  expect(() => validateConfig(impossible)).toThrow('limb reach');
  expect(() => validateConfig({ ...rabbit, family: 'quadruped-v1' })).toThrow(
    'Unsupported rig family',
  );
  expect(Number.isFinite(solveLeg(0, 0, 40, 40).upper)).toBe(true);
});

test('the generator shares the same app contract for another species and stage', () => {
  const config = {
    ...rabbit,
    name: 'fox-child',
    stage: 'child',
    atlas: { ...rabbit.atlas, file: 'images/fox-parts.webp' },
    blink: { ...rabbit.blink, file: 'images/fox-blink.webp' },
    stone: { ...rabbit.stone, file: 'images/fox-stone.webp' },
  };
  const rml = buildCharacter(config);
  expect(rml).toContain('name="child"');
  expect(rml).toContain('name="Character"');
  expect(rml).toContain('name="leg.near.lower"');
  expect(rml.match(/<Image /g)).toHaveLength(33);
  for (const input of ['speed', 'running', 'stone', 'jump'])
    expect(rml).toContain(`name="${input}"`);
  expect(rml.includes('rabbit')).toBe(false);
});
