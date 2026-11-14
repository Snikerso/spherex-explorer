"""AllWISE intensity preview on the exact SPHEREx TAN grid; no cross-mission photometry."""
import base64
from io import BytesIO
import json
import sys
import numpy as np
from PIL import Image
from astropy.io import fits
from astropy.time import Time
from astropy.wcs import WCS
from reproject import reproject_interp


def render(path, grid):
    target = WCS(naxis=2)
    target.wcs.crpix = [(grid['width'] + 1) / 2, (grid['height'] + 1) / 2]
    target.wcs.crval = [grid['raDeg'], grid['decDeg']]
    target.wcs.cdelt = [-grid['pixelScaleDeg'], grid['pixelScaleDeg']]
    target.wcs.ctype = ['RA---TAN', 'DEC--TAN']
    with fits.open(path, memmap=False) as hdus:
        hdu = next(hdu for hdu in hdus if hdu.data is not None and hdu.data.ndim == 2)
        values, footprint = reproject_interp((hdu.data, WCS(hdu.header).celestial), target,
                                            shape_out=(grid['height'], grid['width']))
        def timestamp(key):
            try:
                return Time(float(hdu.header[key]), format='mjd').utc.isot + 'Z'
            except (KeyError, ValueError, TypeError):
                return None
        start, end = timestamp('MJD_MIN'), timestamp('MJD_MAX')
    valid = np.isfinite(values) & (footprint > 0)
    if not valid.any():
        raise ValueError('No WISE coverage on requested grid')
    lo, hi = np.percentile(values[valid], [1, 99.5])
    scaled = np.arcsinh(10 * np.clip((values - lo) / max(hi - lo, 1e-12), 0, 1)) / np.arcsinh(10)
    # FITS array origin is lower left; PNG has north at the top.
    rgba = np.zeros((*values.shape, 4), dtype=np.uint8)
    rgba[:, :, :3] = np.nan_to_num(scaled[:, :, None] * 255).astype(np.uint8)
    rgba[:, :, 3] = valid * 255
    output = BytesIO()
    Image.fromarray(np.flipud(rgba)).save(output, format='PNG')
    return dict(image='data:image/png;base64,' + base64.b64encode(output.getvalue()).decode(),
                timeStart=start, timeEnd=end)


if __name__ == '__main__':
    request = json.loads(open(sys.argv[2]).read())
    print(json.dumps(render(request['path'], request['grid'])))
