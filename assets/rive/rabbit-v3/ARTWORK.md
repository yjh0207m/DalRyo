# Layered rabbit art direction

Created with the built-in imagegen tool, using the project's `rabbit_S.png` as
the identity/style reference. The source remains intact. Generated PNGs and
lossless WebP encodings are kept in `images/`.

## Base atlas prompt specification

Production 2D skeletal animation texture atlas; one square transparent RGBA
image, four columns × four rows. No labels, grid lines, assembled character or
background shadow. Preserve the cream baby rabbit's soft plush 3D illustration
style, glossy dark eyes, pink nose/blush and yellow pacifier. Right-facing 3/4
view; white T-shirt, gray diaper shorts, ochre yellow little sneakers. The new
pose is an upright chibi biped. Every part must be complete, detached, rounded at
the joints and include hidden surfaces for overlap.

Requested row-major parts:

1. Earless head; torso without arms; pelvis/shorts; near upper arm.
2. Near forearm/hand; far upper arm; far forearm/hand; near thigh.
3. Near shin; near right-facing sneaker; far thigh; far shin.
4. Far right-facing sneaker; near ear; far ear; pompom tail.

Limbs are vertical down in the source, ears vertical up. All assets use matching
lighting and scale; far-side parts are slightly darker. Do not attach ears to
the head or arms to the torso. Final UV regions follow measured alpha bounds,
not assumed regular cells: generated parts did not follow the grid exactly.

## Blink edit prompt

Edit this existing game animation atlas very precisely. Preserve EVERY part,
EVERY pixel position, size, identity, transparency, clothing, and lighting.
ONLY change the rabbit head in the top-left corner: close its two eyes into
gentle smiling curved eyelids for a blink frame, preserving eye positions,
nose, pacifier and face exactly. Do not move or resize the head, do not change
its silhouette. All remaining 15 body parts remain exactly as before, same
positions. Clean genuine transparent background without colored speckles or
noise. Output same square atlas dimensions and layout. No text or gridlines.

## Stone edit prompt

Create the petrified STONE material variant of this exact 16-part skeletal
animation atlas. Edit material/color ONLY. Preserve the exact square 1254x1254
canvas, exact positions and silhouettes and sizes of every one of the 16
isolated parts. Do not rearrange, redraw pose, move, rotate, resize, merge or
add any part. Keep the baby rabbit recognizable. All parts including white
shirt, gray shorts, yellow shoes, pink ear inner skin, face and pacifier now
become the SAME softly shaded neutral cool gray stone material, medium gray
with fine restrained natural stone grain, gentle matte texture, delicate tiny
surface cracks but no damage. The open eyes are charcoal gray carved rounded
ovals and keep visible reflections subtle. Face remains cute and gentle. The
head still has NO ears attached. Every part remains separate with complete
rounded joint ends. NO gold, pink, cream or other colored areas. No background,
no labels, no shadows on background. Preserve genuine alpha transparency and
clean the background speckles. Same original cell layout and image framing
exactly. This is a texture-swap atlas to fit an existing animated rig,
positional fidelity is essential.

## Inspection notes

Generated artwork is not assumed to satisfy the prompt automatically. Source
alpha bounds were measured, source dimensions verified, and the assembled
character/eye swap/stone material were rendered in Rive and inspected. Raw
atlases contain almost-transparent background pixels; only the measured
regions are sampled. No Python drawing, recoloring, cropping or resampling
was used. Lossless WebP changes the storage encoding, not the visible art.
