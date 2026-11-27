# Geoid grid

`nzgeoid2016.json` is needed for the Pole Record altitude (height above sea
level). The app converts the GPS height to sea level using this grid. Without
it, the altitude field is left blank for manual entry.

The file is not in the repository. Build it once from LINZ's NZGeoid2016 grid:

    python3 tools/build-geoid-grid.py path/to/nzgeoid2016.xyz

Accepted inputs:

- ESRI ASCII grid (`.asc`)
- XYZ text, one `lon lat undulation` per line (for example, from
  `gdal_translate -of XYZ nzgeoid2016.tif nzgeoid2016.xyz`)

The grid must be regular, and undulations must be in metres. The output is
written here. Rebuild and redeploy if LINZ publishes a new grid.

The file is precached by the service worker, so it works offline once the app is installed.
