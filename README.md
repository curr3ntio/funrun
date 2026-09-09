# Paint Pour

A standalone page with a full-screen "paint pouring down the screen" overlay.
Plain HTML, vanilla JS and raw WebGL2. No dependencies, no build step.

## Run

Open `index.html` directly in a browser, or serve the folder with any static server:

```bash
npx serve .
```

or

```bash
python3 -m http.server 8080
```

The sequence plays automatically on load:

| time   | what happens                                                    |
| ------ | --------------------------------------------------------------- |
| 0 s    | black paint pours from the top, front reaches the bottom in ~3 s |
| 8 s    | white paint pours over the black                                |
| 16 s   | black pours again over the white, and so on (loop mode)         |

`CONFIG.loop` is `true` by default, which makes the page usable as a background
animation: black and white keep pouring over each other every `loopPeriod`
seconds (default 2 × `whiteStart` = 16 s of timeline, stretched by `speed`),
with a fresh noise seed each cycle. With `tapToContinue: true` (default) the
timeline holds once a pour has covered the screen (`holdAt` seconds after it
started) and a click or tap anywhere starts the next pour; set it to `false` to
cycle automatically. Set `loop: false` to get the one-shot
sequence instead: the overlay then fades out at `fadeStart` (23 s) over
`fadeDuration` (1 s) and the canvas is removed from the DOM.

All timings live in the `CONFIG` object at the top of `paint.js`.
If WebGL2 is unavailable the overlay is simply not shown.

## Centred logo

`funrun-text-black.png` and `funrun-text-white.png` are drawn centred on the overlay. Per pixel, the shader
looks at what is underneath — paint or the uncovered page — and shows the
**black** image where it is light and the **white** image where it is dark. The
choice is made per pixel, so the drip edge masks and reveals the logo exactly as
it passes. Size and file names live in `CONFIG.logo`; set `pageIsDark: true` if
the page behind the overlay is dark. If the files are missing the overlay simply
runs without a logo.

## Debug panel

The panel is hidden on load; press `d` or tap the "press d for controls" hint to open it (set `showPanel: true` in `CONFIG` to start open). It has a restart button, a timeline scrubber and sliders for playback speed (down to
almost a standstill, slowing the whole timeline), speed variation and size variation between runs, drip size, run length (how far
the runs race ahead of the paint block), thin ↔ thick paint (viscosity: affects fall
speed, trail width, bead size and run length together), noise scale, logo size and shading (0 = flat colour, the default; 1 = full glossy 3D look). The page also exposes
`window.__setTime(seconds)` to freeze the timeline at a given moment (used by
the screenshot script) and `window.__paint.resume()` to let the clock run again.

## Files

- `index.html` – a plain white page with the overlay canvas, the hint and the control panel
- `style.css` – page styling, the fixed full-screen canvas and the panel
- `paint.js` – config, vertex + fragment shader (template strings), a tiny WebGL2 helper, timeline and render loop

## How the shader works

Everything is drawn with a single full-screen triangle; the fragment shader
decides for every pixel whether it is covered by paint and how it is lit.
Pixel coordinates are CSS pixels with `y` growing downward from the top edge.

Each pour is described by a **signed distance field** `d` (negative inside
paint), built from three parts and joined with a smooth minimum so runs merge
with soft menisci:

1. **Sheet** – the bulk of the paint. Its front is a base progress value that
   accelerates from rest and tends to a terminal speed (`easeFall`), multiplied
   by a low-frequency 1D noise so some regions run ahead, plus a 3-octave value
   noise for lumps and scallops.
2. **Fingers** – the screen is split into columns about 26 px wide. Each column
   hashes to a rivulet with its own centre offset, half width (5–19 px, so runs
   are roughly 10–40 px wide), speed, lag and late "catch-up". A finger is a vertical
   capsule (the trail, whose width wobbles along its length) ending in an
   elongated bead that is wider than the trail. The seven nearest columns are
   evaluated per pixel so wide runs can overlap their neighbours.
3. **Drops** – a few slow fingers release a small teardrop at a random moment,
   which then falls with its own acceleration.

A small 2D noise is added to `d` so no outline is a perfect circle, and a
time-varying wobble on the front and tips keeps the edge alive after the paint
has passed.

From `d` the shader derives a **fake thickness field**: a quarter-circle
profile near the edge (flat film inside), raised domes on the beads, and faint
ridges along each run that relax the further behind the front they are, plus a
slow-moving low-frequency film noise for a wet sheen. The screen-space gradient
of this height (`dFdx` / `dFdy`) gives a normal, which is shaded with
**Blinn-Phong**: ambient + diffuse, a tight specular lobe from an upper-left
light and a small rim term. By default `CONFIG.gloss` is 0, which gives flat
solid colour; raise it to bring back the 3D look. Black paint keeps a very dark base colour with only
grey highlights, so it still reads as black.

Coverage is anti-aliased with `smoothstep` over `fwidth(d)`. The two pours use
the same function with different colour, start time and noise seed, and are
composited "white over black" in premultiplied alpha before the fade multiplier.

## Screenshots

`shot.js` in the development scratchpad drives `window.__setTime` with Playwright
(headless Chromium with SwiftShader) to capture the frame at fixed times.
