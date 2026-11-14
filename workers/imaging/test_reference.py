import base64
from io import BytesIO
import numpy as np
from PIL import Image
from astropy.io import fits
from astropy.wcs import WCS
from reference import render


def test_reference_matches_target_grid_north_up_and_keeps_epoch(tmp_path):
    wcs = WCS(naxis=2)
    wcs.wcs.crpix = [5, 5]
    wcs.wcs.crval = [10, 20]
    wcs.wcs.cdelt = [-0.01, 0.01]
    wcs.wcs.ctype = ['RA---TAN', 'DEC--TAN']
    values = np.zeros((9, 9), dtype=float)
    values[6, 4] = 100
    header = wcs.to_header()
    header['MJD_MIN'] = 55210
    header['MJD_MAX'] = 55530
    path = tmp_path / 'wise.fits'
    fits.writeto(path, values, header)
    result = render(path, dict(width=9, height=9, raDeg=10, decDeg=20, pixelScaleDeg=0.01))
    image = np.array(Image.open(BytesIO(base64.b64decode(result['image'].split(',')[1]))))
    assert image.shape == (9, 9, 4)
    assert image[2, 4, 0] > image[6, 4, 0]
    assert result['timeStart'].startswith('2010-')
    assert result['timeEnd'] > result['timeStart']
