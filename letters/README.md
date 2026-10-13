# The Letters

Fifty glossy white balls, each with a black letter, clumping in zero gravity.
The motion is rebuilt after Paul Henschel's "Best Served Bold" baubles example
(pmndrs, 2020), and the look after his "object clump" example (pmndrs, 2022).
It uses plain three.js, with cannon-es for physics and postprocessing + N8AO
from a CDN. The only asset file is the drum loop, `track-1.wav`.

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

## Track 1

The "1" button at the top loops `track-1.wav`, a 174 bpm drum loop from the
ÆONMODE Sample Pack V1 on Splice, converted to 16-bit WAV so it repeats
without a gap. It plays through a Web Audio analyser, and the spectrum is split
into eight log-spaced bands from 40 Hz to 12 kHz. Each ball listens to one band.
When that band jumps above its recent average, the ball is bounced outward,
so kicks, snares and hats each move a different set of balls. The bass
(the two lowest bands, about 40–170 Hz) kicks twice as hard, and every bass
hit also reaches every ball at 60% strength, so the whole pile thumps on the
kick drum. Click the button again to pause.

Kicks raise a ball's outward speed (capped at 8 units/s, 16 for bass) instead
of adding to it. Each band waits 150 ms before firing again, and only balls within
4–8 units of the centre get kicked. Without those limits the hits outpace the
pull toward the centre and the cluster drifts apart. With them, it pulses
between about 5.9 and 7 units from the centre and settles back when paused.

The typographic underlay keeps the baubles example's layout, but the text is new.

Serve the repository and open `letters/` (ES modules need `http://`, not `file://`).
