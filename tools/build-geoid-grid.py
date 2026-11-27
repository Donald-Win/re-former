#!/usr/bin/env python3
"""Build public/geoid/nzgeoid2016.json from a regular NZGeoid2016 grid.

Input (one of):
  - CSV with a header containing longitude, latitude and N columns (LINZ
    layer 53418). Other columns, such as WKT, are ignored.
  - ESRI ASCII grid (.asc)
  - XYZ text with one point per line, space or comma separated. Column order
    is lon, lat, undulation by default. Use --lat-first for lat, lon, undulation.

Only points inside the NZ area are kept (see NZ_BOX). Coordinates in LINZ's
CSV are rounded to 5 decimal places, so each point is matched to its grid
node by index and checked to lie close to that node, rather than requiring
exactly equal spacing.

Usage:
  python3 tools/build-geoid-grid.py INPUT [OUTPUT] [--lat-first]

The output holds the lowest latitude and longitude, the spacing, the size,
and the undulation values row by row from south to north.
"""
import csv
import json
import os
import sys

ESRI_KEYS = {'ncols', 'nrows', 'xllcorner', 'yllcorner', 'xllcenter', 'yllcenter',
             'cellsize', 'nodata_value'}
DEFAULT_OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                           '..', 'public', 'geoid', 'nzgeoid2016.json')

# Only NZ is needed. Keeping this box keeps the file small and avoids the
# dateline, where the grid is not contiguous.
NZ_BOX = {'lat_min': -48.5, 'lat_max': -32.5, 'lon_min': 165.0, 'lon_max': 180.0}

# A point may sit up to this fraction of one grid step from its node.
# Rounding in the source is about 0.000005 degrees, far below this.
MAX_OFFSET_FRACTION = 0.1


def read_esri(path):
    with open(path) as f:
        tokens = f.read().split()
    header = {}
    i = 0
    while i + 1 < len(tokens) and tokens[i].lower() in ESRI_KEYS:
        header[tokens[i].lower()] = tokens[i + 1]
        i += 2
    ncols = int(header['ncols'])
    nrows = int(header['nrows'])
    cell = float(header['cellsize'])
    if 'xllcenter' in header:
        lon0 = float(header['xllcenter'])
    else:
        lon0 = float(header['xllcorner']) + cell / 2
    if 'yllcenter' in header:
        lat0 = float(header['yllcenter'])
    else:
        lat0 = float(header['yllcorner']) + cell / 2
    nodata = float(header.get('nodata_value', -9999))

    vals = [float(t) for t in tokens[i:]]
    if len(vals) != nrows * ncols:
        sys.exit(f'ESRI grid has {len(vals)} values, expected {nrows * ncols}.')

    points = []
    for r in range(nrows):              # row 0 is the northern edge
        lat = lat0 + (nrows - 1 - r) * cell
        for c in range(ncols):
            v = vals[r * ncols + c]
            if v != nodata:
                points.append((lat, lon0 + c * cell, v))
    return points


def read_csv_named(path):
    """Read a CSV with a header, using the longitude, latitude and N columns.
    Works with extra columns such as WKT, which may contain spaces."""
    points = []
    with open(path, newline='', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        cols = {name.strip().lower(): name for name in (reader.fieldnames or [])}
        need = ('longitude', 'latitude', 'n')
        if not all(k in cols for k in need):
            sys.exit(f'CSV header must include longitude, latitude and N. Found: {reader.fieldnames}')
        for row in reader:
            try:
                lon = float(row[cols['longitude']])
                lat = float(row[cols['latitude']])
                v = float(row[cols['n']])
            except (TypeError, ValueError):
                continue
            points.append((lat, lon, v))
    return points


def read_xyz(path, lat_first=False):
    points = []
    with open(path) as f:
        for line in f:
            parts = line.replace(',', ' ').split()
            if len(parts) < 3:
                continue
            try:
                a, b, v = float(parts[0]), float(parts[1]), float(parts[2])
            except ValueError:
                continue                # header or comment line
            lat, lon = (a, b) if lat_first else (b, a)
            points.append((lat, lon, v))
    return points


def make_axis(coords, name):
    """Work out the origin, step and count of one axis from its coordinates.

    Returns (origin, step, count). Exits if the coordinates do not sit on a
    regular set of nodes.
    """
    lo, hi = min(coords), max(coords)
    distinct = sorted({round(c, 4) for c in coords})   # merges rounding noise
    count = len(distinct)
    if count < 2:
        sys.exit(f'{name} axis needs at least two distinct values.')
    step = (hi - lo) / (count - 1)
    tol = step * MAX_OFFSET_FRACTION
    worst = max(abs(c - (lo + round((c - lo) / step) * step)) for c in coords)
    if worst > tol:
        sys.exit(f'{name} values are not on a regular grid '
                 f'(worst offset {worst:.6f}, allowed {tol:.6f}).')
    return lo, step, count


def write_grid(points, out_path):
    lat0, d_lat, n_lat = make_axis([p[0] for p in points], 'latitude')
    lon0, d_lon, n_lon = make_axis([p[1] for p in points], 'longitude')

    values = [None] * (n_lat * n_lon)
    for lat, lon, v in points:
        i = round((lat - lat0) / d_lat)
        j = round((lon - lon0) / d_lon)
        k = i * n_lon + j
        if values[k] is None:
            values[k] = v

    missing = sum(1 for v in values if v is None)
    if missing:
        sys.exit(f'Grid is incomplete: {missing} of {len(values)} nodes have no value.')

    grid = {
        'lat0': lat0, 'lon0': lon0,
        'dLat': d_lat, 'dLon': d_lon,
        'nLat': n_lat, 'nLon': n_lon,
        'values': [round(v, 3) for v in values],
    }
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    with open(out_path, 'w') as f:
        json.dump(grid, f, separators=(',', ':'))
    print(f'Wrote {out_path}: {n_lat} x {n_lon} points, '
          f'lat {lat0:.5f}..{lat0 + d_lat * (n_lat - 1):.5f}, '
          f'lon {lon0:.5f}..{lon0 + d_lon * (n_lon - 1):.5f}')


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    lat_first = '--lat-first' in sys.argv[1:]
    if not args:
        sys.exit(__doc__)
    src = args[0]
    out = args[1] if len(args) > 1 else DEFAULT_OUT
    with open(src, encoding='utf-8-sig') as f:
        first = f.readline().strip().lower()
    if first.startswith('ncols'):
        points = read_esri(src)
    elif ',' in first and 'longitude' in first:
        points = read_csv_named(src)
    else:
        points = read_xyz(src, lat_first)

    box = NZ_BOX
    points = [p for p in points
              if box['lat_min'] <= p[0] <= box['lat_max'] and box['lon_min'] <= p[1] <= box['lon_max']]
    if not points:
        sys.exit('No usable points found in the input (inside the NZ area).')
    write_grid(points, out)


if __name__ == '__main__':
    main()