# Rabbit baby Rive prototype

Archived single-image prototype. The app now uses `../rabbit-v3` and
`../rabbit-baby-layered.riv`; follow `scripts/rive/README.md` for new work.

Rive CLI 1.8.0. Original `rabbit_S.png` from the project's existing Firebase Storage.

- Deliverable: `../rabbit-baby.riv`, embedded PNG, no scripts or external image dependencies.
- Artboard: `baby`, 500 × 500, transparent; feet near y=410.
- State machine: `Character`.
- Inputs: `speed` number (km/h), `running` boolean, `stone` boolean, `jump` trigger.
- Timelines: idle, walk, run, sprint, stone, jump.
- 475 mesh vertices, 864 triangles, seven independently animated bones.
- Speed bands: below 6 walking; 6 to below 11 running; 11+ sprinting, only while `running=true`.
- `stone=true` overrides locomotion. Jump returns to idle then resolves current locomotion.

Rebuild from repository root (PowerShell):

```powershell
node assets/rive/rabbit/build-source.cjs
& "$env:USERPROFILE\.rive\bin\rive.exe" assets/rive/rabbit --verify
& "$env:USERPROFILE\.rive\bin\rive.exe" inspect assets/rive/rabbit --summary
& "$env:USERPROFILE\.rive\bin\rive.exe" assets/rive/rabbit --screenshot --advance=1
```

Copy `build/rabbit.riv` to `../rabbit-baby.riv` after changing the source.
The generated RML is editable; regeneration replaces it. Edit the generator for reproducible changes.

Validation: compiler and inspector report no errors or warnings. The bundled asset renders in the installed Android app using rive-react-native 9.8.6. The adapter disables automatic data binding because this file uses legacy state-machine inputs. Motion uses smooth sampled cycles, delayed ear movement, alternating forelegs, a foot-centered body pivot and jump anticipation/landing.

The app prefers this bundled asset only for rabbit/baby. Stone and outfit layers use the existing PNG renderer. Child/runner use the remote asset resolver and PNG fallback. Fatal Rive errors fall back to PNG, and late remote replies cannot replace the current animal/stage. The development build exposes My page → Character preview for checking the real CharacterView without changing account data.

This is a deformation prototype using a single raster image, not a finished layered illustration. Limbs cannot reveal hidden artwork, the stone pose has no stone recoloring, outfit slots are not authored, and child/runner artboards are absent. Do not replace the full remote rabbit asset with this baby-only file. When a full rabbit file is ready, update or remove the bundled baby mapping in characterAssets.ts as well.
