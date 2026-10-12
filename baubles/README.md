# Christmas Baubles

Fifty pink baubles clustering in zero gravity, rebuilt after Paul Henschel's
"Best Served Bold" baubles example (pmndrs, 2020) in plain three.js, with
cannon-es for physics and postprocessing + N8AO from a CDN. No asset files.

Each bauble is a sphere plus a small cylinder for its cap, in a world without
gravity. Every frame it gets an impulse toward the origin, three times stronger
on the vertical axis, so the pile spreads out wide and flat. A kinematic ball
follows the pointer across the z = 0 plane and shoves them out of the way.
Damping, friction, sizes and spawn positions use the original's numbers;
rapier's damping model is converted to cannon's.

What changed from the original:

- The metal cap is built in code (a lathe profile with crimped grooves, plus a
  torus loop) instead of loaded from a glb.
- A generated `RoomEnvironment` stands in for the HDR panorama that gives the
  caps their reflections.
- The typographic underlay keeps the layout, but the text is new.

The look comes from a Lambert material with a red emissive, a red light from
below, ACES tone mapping, and red-tinted N8AO multiplied on top. Tone mapping
runs before the AO, as in the original, so the shadows stay a deep pink.

Serve the repository and open `baubles/` (ES modules need `http://`, not `file://`).
