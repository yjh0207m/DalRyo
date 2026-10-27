# Whole-body crawl candidate — visual review only

The user rejected the previous upright segmented rabbit as grotesque, with
incorrect proportions and clothing that did not follow the body. That asset
was removed from the approved default registry. Do not restore it based on
compiler or geometry test results.

This candidate preserves the original crawling baby silhouette. Each pose is a
complete illustration with its shirt/shorts/shoes attached; no puppet limbs or
separately rotated garment pieces are used. Eight generated poses are selected
by held image-opacity tracks for runtime compatibility. Eye X and foot-floor measurements in `frames.json` register the
poses. The body does not receive a looping translation/bounce during crawling.

## Build and compare

- `npm run rive:build` regenerates and validates this **developer preview**.
- Default app registry remains empty. The main app uses its original PNG path.
- My page → Character preview offers a candidate/original comparison.
- Candidate override is ignored outside development builds. Stone uses the
  original PNG rendering path; this candidate does not contain a stone material.
- App preview binary: `../rabbit-crawl-candidate.riv` (940,253 bytes).

The eight AI-generated poses are not a perfectly consistent hand-authored
animation: subtle face and pose differences and discrete frame changes remain.
It is not approved for the default UI or as a reusable production template.
The previous biped's passing tests did not establish visual quality.

## Artwork generation

Built-in imagegen tool, reference: original `../rabbit/images/rabbit_S.png`.
Original generated PNG retained in `images/crawl-atlas.png`; the WebP is a
lossless storage encoding. No Python drawing/cropping/recoloring was used.

Prompt specification: preserve the exact cream baby rabbit identity, round
oversized head, short chubby limbs, white T-shirt, gray diaper shorts, yellow
pacifier and ochre shoes. Keep it crawling on all fours, 3/4 side view facing
right. Never stand upright or give it long human limbs. Clothing must move
with the complete body, with no detached sleeves, joint gaps or hollow parts.
Create exactly eight complete figures in a strict 4×2 transparent atlas,
equal cells, same camera and scale, no shadows/text/background. Animate one
continuous alternating hand/knee crawl on a treadmill: reach, plant, support,
push, opposite half-cycle, recovery, reach and contact. Keep all figures on the
same floor, with subtle weight shift, no airborne phase or hopping. The output
did not meet perfect consistency; registration and visual review are required.
