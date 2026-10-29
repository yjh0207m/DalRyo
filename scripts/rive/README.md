# Character rig pipeline

**Visual review rejected the biped rabbit:** its proportions and detached-looking
clothing were unacceptable. This implementation is preserved as an experiment,
not an approved reusable art template. Geometry tests passing did not establish
natural motion. The app's approved bundled registry is now empty; the developer
preview compares a whole-body crawling sprite candidate with the original PNG.
`npm run rive:build` now rebuilds that candidate only and never promotes it.

The app contract stays `baby/child/runner` artboards, `Character` state machine,
and `speed/running/stone/jump` inputs. This template currently implements
**biped-v1**. It is not a universal quadruped, wing or snake rig.

## What is shared

- Six timelines, prioritized jump/stone transitions and jump return to current speed.
- Alternating two-link legs solved against foot targets, flat soles during contact.
- Support/flight ratios, body compression, opposite arm swing and delayed ears/tail.
- Optional ear/tail artwork, optional idle blink and same-UV stone material atlas.
- Stable semantic bone names and 500×500 / ground y=410 app coordinates.
- Validation of limb reach, artboard contract, missing assets and output size.
- `assets/rive/biped-v1.motion.json` is shared by the generator and the app's
  dust step timing, so the two-foot cadence does not drift from the animation.

## What each species needs

1. Create a dedicated Rive CLI project (`rive create ...`).
2. Supply detached head, torso, pelvis, two upper/lower arms, two upper/lower legs,
   two shoes/paws; optionally ears and tail. Rounded overlapping joint ends must
   include hidden artwork. A complete flat character PNG cannot provide this.
3. Copy `assets/rive/rabbit-v3/character.json` and change `name`, `stage`, atlas
   file/dimensions/regions, lengths, hip/shoulder/head/ear pivots and part sizes.
   Anatomy must be tuned to that species. Do not relabel rabbit art as another animal.
4. `node scripts/rive/build-character.cjs <project>` generates editable RML.
   For QA use `--preview-motion=walk|run|sprint|jump|stone` then CLI screenshots.
   Every preview rebuild must be followed by `rive <project> --verify` and
   `rive inspect <project> --summary`; inspect the actual rendered motion too.
5. Export for the app using:

```powershell
node scripts/rive/export-character.cjs assets/rive/rabbit-v3 assets/rive/rabbit-baby-layered.riv
```

The export command always rebuilds the canonical idle entry and resets preview
inputs, checks compilation and the resolved skeleton, then copies the binary.
It does not upload, publish a web page or change a Firebase document.
Set `RIVE_CLI` to override the installed executable path.

## Review gates

Inspect idle, walk, run, sprint and jump at several points in a cycle, at actual
avatar sizes, both directions and after rapid state changes. Check knee/elbow
seams, silhouette, sole height, contact timing, loops, occlusion and safe bounds.
Verify stone freezes the same rig and jump returns to the current motion.
Run `riveRig.test.ts` and `CharacterView.test.tsx`.

Mathematical checks and a valid `.riv` do not establish release-quality animation.
Each new animal needs visual review and tuning. The current layered rabbit is a
reviewable reference implementation, not a certificate that all animals are done.

Original imagegen PNGs are retained. WebP files are lossless encodings; no
resampling or color quantization was applied. Visible decoded pixels were checked
against the originals for the color and blink atlases. The embedded rabbit is
about 2.26 MB, over the earlier 500 KB recommendation: three independent textures
and dense per-frame tracks are included. A 3 MB validation ceiling prevents
unbounded growth; a separate texture-pack pass is still required for that 500 KB
goal. Do not describe this asset as meeting the smaller target.
