# Slug Luv

Two striped worms tangled on a paper-textured
table, rebuilt after Lars Berg's 2018 sketch with three.js and Tone.js from a
CDN and no model files. The rings are chains of point bodies simulated with a
small position-based solver in the page; a tube is skinned along each chain
every frame. One ring at a time crawls along itself in pulses, each pulse with
a kick drum. Click or touch and drag to speed the pulses up (vertical) and sweep
the phaser (horizontal); drag also orbits the camera.

Serve the repository and open `slug/` (ES modules need `http://`, not `file://`).
Press `d` for the panel: pulse rate, crawl strength, physics gains, rib depth,
glow, tube radius, stripe count, one or two worms, sound, a palette list
(the sketch's own plus classic Adobe Kuler themes), a box to paste any five hex
codes or a coolors.co link, and camera field of view, distance, tilt, swing,
drag-orbit and auto-orbit toggles. Defaults live in `CONFIG` inside `index.html`.

**Share** puts the whole setup (all sliders, worm count, palette or pasted hex
codes, the stripe pattern's seed, and the camera) into the page URL and copies
the link. Anyone opening that link sees the same setup; only the knot itself
differs, since the physics is chaotic.
