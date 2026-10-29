# Layered rabbit reference rig

**Rejected after user visual review.** The unnatural proportions, puppet joints
and clothing attachment are not acceptable. This asset is no longer in the app's
default registry. Do not promote it or use it as the visual template for other
animals. The following notes describe the preserved experiment.

Current app asset: `../rabbit-baby-layered.riv`.
Rebuild safely with `npm run rive:build` from the repository root.
Generator and reuse guide: `scripts/rive/README.md`.
Art direction/provenance: `ARTWORK.md`.

This replaces the earlier single-PNG mesh deformation prototype. It uses
16 separately positioned parts, two-link legs/arms, independently rotating feet,
ear/tail follow-through, an idle blink and a matching stone material variant.
All textures are embedded; no runtime script or external image URL is required.

`character.json` holds species-specific atlas rectangles, lengths, proportions
and pivots. The common code in `scripts/rive/` owns the gait and state graph.
The RML is generated; make lasting changes in the manifest or shared generator.
Keep `--preview-motion` files out of the app: the export command resets the
entry state and inputs before checking/copying the binary.

Validated in Rive CLI 1.8.0 and Android rive-react-native 9.8.6. CLI snapshots
covered idle, blink, four running phases, stone and jump apex. The actual app
rendered the layered run and matching stone material. ADB run video is retained
in the chat's visualization folder. Unit tests cover foot/sole geometry,
support/flight phases, cycle seams, optional anatomy, manifest rejection,
stage/species reuse and PNG fallback.

The full file is 2,258,501 bytes; it exceeds the old 500 KB recommendation.
Neither the complete character set nor child/runner artwork is finished.
Artwork seams, motion appeal and performance still need review on physical
devices. A passing compiler or geometry test does not mean the animation is
artistically perfect or all species can be swapped without adjustment.
