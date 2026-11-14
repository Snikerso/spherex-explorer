"""Exploratory pixel spectra and inverse-variance detector coadds from cached FITS."""
import base64
from io import BytesIO
import json
from pathlib import Path
import re
import sys

import numpy as np
from PIL import Image
from astropy.io import fits
from astropy.time import Time
from astropy.wcs import WCS
from reproject import reproject_interp
from worker import decode, make_grid


def recorded_pointing(path, fallback_time):
    """Astrometric reference and detector axes, NOT spacecraft attitude or optical boresight."""
    try:
        with fits.open(path, memmap=False) as hdul:
            header = hdul['IMAGE'].header
            wcs = WCS(header, hdul).celestial
            x, y = wcs.wcs.crpix - 1
            center = wcs.pixel_to_world(x, y).icrs
            positive_x = wcs.pixel_to_world(x + 1, y).icrs
            positive_y = wcs.pixel_to_world(x, y + 1).icrs
            time_key = 'DATE-AVG' if header.get('DATE-AVG') else 'DATE-OBS' if header.get('DATE-OBS') else 'archive_observedAtUtc'
            observed = header.get('DATE-AVG') or header.get('DATE-OBS') or fallback_time
            scale = header.get('TIMESYS', 'UTC').lower()
            timestamp = Time(observed, scale=scale).utc.isot + 'Z'
            return {'raDeg': float(center.ra.deg), 'decDeg': float(center.dec.deg), 'positiveXAngleDeg': float(center.position_angle(positive_x).deg), 'positiveYAngleDeg': float(center.position_angle(positive_y).deg), 'observedAtUtc': timestamp, 'timeSource': time_key, 'coordinateSystem': 'ICRS', 'scope': 'detector-WCS-reference', 'method': 'IMAGE celestial WCS at CRPIX; detector +X/+Y position angles east of north'}
    except Exception:
        return None


def recorded_spacecraft(path, fallback_time):
    """Locate a historical exposure from its ground track and geocentric radius.

    The viewer uses a spherical Earth; do not assume inertial XYZ axes are Earth-fixed.
    """
    try:
        with fits.open(path, memmap=False) as hdul:
            header = hdul['IMAGE'].header
            if str(header.get('XYZ_SC_SYSTEM', '')).strip().upper() != 'GEOCENTER':
                return None
            latitude, longitude = float(header['SGT_LAT_MIDPT']), float(header['SGT_LON_MIDPT'])
            radius = float(np.linalg.norm([float(header[key]) for key in ['X_SC', 'Y_SC', 'Z_SC']]))
            if not np.isfinite([latitude, longitude, radius]).all() or not (-90 <= latitude <= 90 and -180 <= longitude <= 360 and 6400 < radius < 10000):
                return None
            observed = header.get('DATE-AVG') or fallback_time
            timestamp = Time(observed, scale=header.get('TIMESYS', 'UTC').lower()).utc.isot + 'Z'
            speed = None
            velocity = None
            if all(key in header for key in ['VX_SC', 'VY_SC', 'VZ_SC']):
                components = [float(header[key]) for key in ['VX_SC', 'VY_SC', 'VZ_SC']]
                value = float(np.linalg.norm(components))
                if np.isfinite(value) and 0 < value < 15:
                    speed = value
                    velocity = dict(zip(['x', 'y', 'z'], components))
            return {'latitudeDeg': latitude, 'longitudeDeg': (longitude + 180) % 360 - 180,
                    'radiusKm': radius, 'speedKmS': speed, 'observedAtUtc': timestamp,
                    'inertialPositionKm': dict(zip(['x', 'y', 'z'], [float(header[key]) for key in ['X_SC', 'Y_SC', 'Z_SC']])),
                    'inertialVelocityKmS': velocity if str(header.get('VXYZ_SC_SYSTEM', 'GEOCENTER')).strip().upper() == 'GEOCENTER' else None,
                    'method': 'FITS SGT_LAT_MIDPT/SGT_LON_MIDPT + norm(X_SC,Y_SC,Z_SC); spherical Earth approximation'}
    except (KeyError, ValueError, TypeError, OSError):
        return None


def compare_or_metadata(root, request):
    region = request['input']
    target = make_grid(region['raDeg'], region['decDeg'], region['fovDeg'])
    planes, sources = [], []
    for item in request['files']:
        path = (root / item['path']).resolve()
        if not path.is_relative_to(root):
            raise ValueError('FITS outside cache')
        data = decode(path, region['raDeg'], region['decDeg'])
        sources.append({'observationId': item['observationId'], 'sourceUrl': item['sourceUrl'], 'detector': item.get('detector'), 'observedAtUtc': item['observedAtUtc'], 'wavelengthUm': data['wave'], 'bandwidthUm': data['bandwidth'], 'flaggedFraction': data['flagged'], 'qualityBits': data['qualityBits'], 'recordedSpacecraft': recorded_spacecraft(path, item['observedAtUtc']) if request['analysis']['kind'] == 'metadata' else None, 'recordedPointing': recorded_pointing(path, item['observedAtUtc']) if request['analysis']['kind'] == 'metadata' else None})
        if request['analysis']['kind'] != 'metadata':
            plane, footprint = reproject_interp((data['image'], data['wcs']), target, shape_out=(256, 256))
            plane[footprint <= 0] = np.nan
            planes.append(plane)
    if request['analysis']['kind'] == 'metadata':
        return {'kind': 'metadata', 'sources': sources, 'skipped': []}
    valid = np.isfinite(planes[0]) & np.isfinite(planes[1])
    if not valid.any():
        raise ValueError('No shared valid coverage')
    difference = request['analysis']['operation'] == 'subtract'
    image = planes[1] - planes[0] if difference else planes[0] + planes[1]
    if difference:
        scale = max(float(np.percentile(np.abs(image[valid]), 99)), 1e-10)
        strength = np.clip(np.arcsinh(10 * np.abs(image) / scale) / np.arcsinh(10), 0, 1)
        red = np.where(image > 0, strength, 0); blue = np.where(image < 0, strength, 0)
        rgb = np.stack([red, np.minimum(red, blue), blue], axis=-1)
    else:
        low, high = np.percentile(image[valid], [2, 99.7])
        grey = np.clip(np.arcsinh(10 * np.maximum(0, (image - low) / max(high - low, 1e-10))) / np.arcsinh(10), 0, 1)
        rgb = np.stack([grey] * 3, axis=-1)
    rgba = np.concatenate([np.nan_to_num(rgb), valid[..., None]], axis=-1)
    buffer = BytesIO(); Image.fromarray(np.flipud((rgba * 255).astype(np.uint8))).save(buffer, format='PNG')
    return {'kind': 'compare', 'operation': request['analysis']['operation'], 'image': 'data:image/png;base64,' + base64.b64encode(buffer.getvalue()).decode(), 'sources': sources, 'coverage': float(valid.mean()), 'valueMin': float(image[valid].min()), 'valueMax': float(image[valid].max()), 'unit': 'MJy/sr', 'spectrallyDifferent': abs(sources[0]['wavelengthUm'] - sources[1]['wavelengthUm']) > .5 * min(source['bandwidthUm'] for source in sources), 'skipped': []}


def analyze(root, request):
    mode = request['analysis']['kind']
    if mode in ('compare', 'metadata'):
        return compare_or_metadata(root, request)
    point = request['analysis'].get('point') or request['input']
    ra, dec = point['raDeg'], point['decDeg']
    low, high = request['analysis'].get('rangeUm', [.7, 5.1])
    points, stacks, skipped = [], {}, []
    target = make_grid(ra, dec, request['input']['fovDeg'])
    for item in request['files']:
        try:
            path = (root / item['path']).resolve()
            if not path.is_relative_to(root):
                raise ValueError('FITS outside cache')
            detector = item.get('detector') or 'SPHEREx-D' + re.search(r'D([1-6])_', item['sourceUrl']).group(1)
            data = decode(path, ra, dec)
            if mode == 'spectrum':
                cx, cy = data['wcs'].world_to_pixel_values(ra, dec)
                x, y = int(np.clip(np.floor(cx + .5), 0, data['image'].shape[1] - 1)), int(np.clip(np.floor(cy + .5), 0, data['image'].shape[0] - 1))
                value, variance = data['image'][y, x], data['variance'][y, x]
                wave, bandwidth = data['spectral'][y, x]
                if not (np.isfinite(value) and np.isfinite(variance) and variance > 0 and np.isfinite(wave) and low <= wave <= high):
                    raise ValueError('Pixel flagged, missing, or outside wavelength range')
                points.append({'observationId': item['observationId'], 'sourceUrl': item['sourceUrl'], 'detector': detector, 'observedAtUtc': item['observedAtUtc'], 'wavelengthUm': float(wave), 'bandwidthUm': float(bandwidth), 'value': float(value), 'sigma': float(np.sqrt(variance))})
            else:
                valid = np.isfinite(data['image']) & (data['spectral'][..., 0] >= low) & (data['spectral'][..., 0] <= high)
                image, footprint = reproject_interp((np.where(valid, data['image'], np.nan), data['wcs']), target, shape_out=(256, 256))
                variance, _ = reproject_interp((np.where(valid, data['variance'], np.nan), data['wcs']), target, shape_out=(256, 256))
                good = (footprint > 0) & np.isfinite(image) & np.isfinite(variance) & (variance > 0)
                if not good.any():
                    raise ValueError('No usable pixels in wavelength range')
                entry = stacks.setdefault(detector, {'weighted': np.zeros((256, 256)), 'weights': np.zeros((256, 256)), 'count': 0, 'sources': []})
                weight = np.divide(1, variance, out=np.zeros_like(variance), where=good)
                entry['weighted'] += np.where(good, image, 0) * weight
                entry['weights'] += weight
                entry['count'] += 1
                entry['sources'].append({'observationId': item['observationId'], 'observedAtUtc': item['observedAtUtc'], 'wavelengthUm': data['wave']})
        except Exception as error:
            skipped.append({'observationId': item['observationId'], 'reason': str(error)})
    if mode == 'spectrum':
        return {'kind': mode, 'point': {'raDeg': ra, 'decDeg': dec}, 'unit': 'MJy/sr', 'points': sorted(points, key=lambda p: p['wavelengthUm']), 'skipped': skipped, 'notes': 'Exploratory nearest-native-pixel surface brightness, IMAGE minus ZODI; quality flags applied. Not aperture/PSF photometry or total source flux. Epochs differ; sigma is the supplied single-pixel variance uncertainty.'}
    rendered = []
    for detector, entry in sorted(stacks.items()):
        valid = entry['weights'] > 0
        image = np.divide(entry['weighted'], entry['weights'], out=np.full((256, 256), np.nan), where=valid)
        bottom, top = np.percentile(image[valid], [2, 99.7])
        scale = max(top - bottom, 1e-10)
        grey = np.clip(np.arcsinh(10 * np.maximum(0, (image - bottom) / scale)) / np.arcsinh(10) * 255, 0, 255)
        rgba = np.stack([np.nan_to_num(grey)] * 3 + [valid.astype(float) * 255], axis=-1).astype(np.uint8)
        buffer = BytesIO(); Image.fromarray(np.flipud(rgba)).save(buffer, format='PNG')
        rendered.append({'detector': detector, 'count': entry['count'], 'sources': entry['sources'], 'image': 'data:image/png;base64,' + base64.b64encode(buffer.getvalue()).decode(), 'coverage': float(valid.mean()), 'valueMin': float(image[valid].min()), 'valueMax': float(image[valid].max())})
    return {'kind': mode, 'stacks': rendered, 'skipped': skipped, 'notes': 'Inverse-variance weighted visual coadd per detector, IMAGE minus ZODI, quality flags applied. Different wavelengths/epochs are mixed within the chosen range. Interpolated variance supplies relative weights only; this is not a calibrated single-band flux or S/N measurement.'}


if __name__ == '__main__':
    try:
        result = analyze(Path(sys.argv[1]).resolve(), json.loads(Path(sys.argv[2]).read_text()))
        print(json.dumps(result, allow_nan=False))
    except Exception:
        print(json.dumps({'error': 'Could not analyze cached FITS.'}))
        sys.exit(1)
