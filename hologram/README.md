# Hologram Particles

A droid rendered as a hologram of 75,000 tiny spheres inside a glowing
cylinder, rebuilt after [cortiz2894/hologram-particles](https://github.com/cortiz2894/hologram-particles)
(itself a replica of igloo.inc) as a single page with three.js r182's WebGPU
renderer and TSL from a CDN. Falls back to WebGL2 where WebGPU is missing.

The particles are sampled from a mesh surface and drawn as one instanced mesh.
A compute shader moves them: a collider that follows the cursor shoves them
aside in the direction you sweep, turbulence frays the wave, a spring brings
them home and the cylinder wall stops them; displaced particles glow. The
material is a two-light wrapped diffuse blended between the figure's normal and
each sphere's own, with fractal-noise wobble gated by a drifting instability
mask. Around it: a fresnel cylinder with plexus lines, two pairs of halo arcs,
an animated dot grid, a radial-gradient background, bloom and chromatic
aberration. Switching models deforms, morphs and reforms the cloud; the page
opens with the same morph from the origin.

The original samples Sketchfab GLBs of BD-1 and BB-8. Those are not shipped
here, so both droids are built from primitives, and the plexus texture is drawn
on a canvas. Drop any `.glb` onto the page to use a real model.

Serve the repository and open `hologram/` (ES modules need `http://`, not
`file://`). Move the cursor through the figure; ← → or the arrows switch models;
the moon/sun button toggles the light and dark presets; the sliders button
opens a panel with every parameter of the original playground, including
`replay` for the entrance. Defaults live in `P` inside `index.html`.
