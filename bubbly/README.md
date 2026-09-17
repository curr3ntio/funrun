# Poppin' Bubbally

A cluster of soap bubbles on black, rebuilt after Lars Berg's 2016 sketch
"poppin' bubbally" with three.js and cannon-es from a CDN and no asset files.
130 bubbles are rigid spheres in a zero-gravity world; each is pulled toward a
point just under an invisible ceiling, so they pile up, jostle and squash
against each other. The bubble shader wobbles the sphere with noise (more when
it moves fast) and colours it from a generated night-sky panorama sampled
through the view normal with the green and blue channels offset, which gives
the rainbow fringes, plus a drifting colour-noise film and a fresnel ramp. A
quarter-resolution blurred copy of the frame is added back on top for the glow.

Bubbles pop on their own every 6–20 seconds with a soft synthesized "blop"
(pitch by size, panned by position) and respawn far below. Click or tap a
bubble to burst it: a louder blop, a puff of particles, and the neighbours are
shoved away. Drag to pan the camera.

Serve the repository and open `bubbly/` (ES modules need `http://`, not `file://`).
