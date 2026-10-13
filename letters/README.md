# The Letters

Fifty glossy white balls, each with a black letter, clumping in zero gravity.
The motion is rebuilt after Paul Henschel's "Best Served Bold" baubles example
(pmndrs, 2020), and the look after his "object clump" example (pmndrs, 2022).
It uses plain three.js, with cannon-es for physics and postprocessing + N8AO
from a CDN. No asset files.

Each ball is a sphere in a world without gravity. Every frame it gets an
impulse toward the origin, three times stronger on the vertical axis, so the
pile spreads out wide and flat. A kinematic ball follows the pointer across the
z = 0 plane and shoves them out of the way. Click or tap a ball to flick it
away from the spot you hit, 25% harder than a brisk sweep of the pointer
knocks one (a measured ~28 units/s, so 35). Damping, friction, sizes and spawn
positions use the baubles example's numbers; rapier's damping model is
converted to cannon's.

The balls use a white `MeshStandardMaterial` with zero roughness. Each gets a
random letter from `LETTERS` (A–Z by default), set in Antonio and painted on a
canvas in equirectangular space so it sits undistorted on the equator. The
original example uses a brushed X from a jpg instead; edit `LETTERS` or
`makeLetterTexture()` to put something else on the balls. A generated `RoomEnvironment` stands in for the
HDR panorama that gives the reflections. One soft spotlight casts shadows, and
ACES tone mapping, black half-resolution N8AO and SMAA finish the frame.

The typographic underlay keeps the baubles example's layout, but the text is new.

Serve the repository and open `letters/` (ES modules need `http://`, not `file://`).
