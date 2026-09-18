# funrun

A collection of small, self-contained web experiments. Each one lives in its
own folder with its own `index.html` and README, and nothing is shared between
folders, so they cannot interfere with each other.

| folder   | experiment                                                              |
| -------- | ----------------------------------------------------------------------- |
| `pour/`  | Paint Pour: black and white paint pouring down the screen, raw WebGL2   |
| `slug/`  | Slug Luv: striped worms on a paper table, three.js + a tiny physics solver |
| `bubbly/` | Poppin' Bubbally: a jostling cluster of soap bubbles, three.js + cannon-es, click to pop |
| `hologram/` | Hologram Particles: a droid as 75k particles in a glowing cylinder, three.js WebGPU + TSL |

The root `index.html` is a plain list linking to them.

## Run

Serve the repository root with any static server and open a folder:

```bash
python3 -m http.server 8765
```

Then visit `http://localhost:8765/` for the list, or `/pour/` and `/slug/`
directly. Pages that use ES modules (like `slug/`, `bubbly/` and `hologram/`) need `http://`, not `file://`.

## Adding an experiment

1. Create a new folder with an `index.html` (plus whatever JS, CSS and assets
   it needs, all referenced with relative paths inside that folder).
2. Load libraries from a CDN or copy them into the folder. Do not reference
   files in other experiments' folders.
3. Add a short README in the folder and a row to the table above and to the
   list in the root `index.html`.
