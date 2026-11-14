"""Offline regression fixtures; synthetic FITS are never served by the live application."""
import pytest
import numpy as np
from astropy.io import fits
from PIL import Image

from worker import SOURCE_MASK, decode, make_grid, render, wave_map


def spectral_table(size=32):
    xs = np.array([1.0, float(size)])
    yy, xx = np.meshgrid(xs, xs, indexing="ij")
    values = np.stack([1 + xx * .0001, np.full_like(yy, .1)], axis=-1)
    return fits.BinTableHDU.from_columns([
        fits.Column(name="X", format="2D", array=[xs]),
        fits.Column(name="Y", format="2D", array=[xs]),
        fits.Column(name="VALUES", format="8D", dim="(2,2,2)", array=[values]),
    ], name="WCS-WAVE")


def test_spectral_scalar_has_same_values_as_a_pixel_in_an_array():
    image = fits.ImageHDU(np.zeros((32, 32)), name="IMAGE")
    image.header["CRPIX1A"] = 1
    image.header["CRPIX2A"] = 1
    hdul = fits.HDUList([fits.PrimaryHDU(), image, spectral_table()])
    scalar = wave_map(hdul, np.asarray(10.0), np.asarray(11.0))
    field = wave_map(hdul, np.array([[10.0]]), np.array([[11.0]]))
    assert scalar.shape == (2,)
    np.testing.assert_allclose(scalar, [1.0011, .1])
    np.testing.assert_allclose(field[0, 0], scalar)


@pytest.mark.parametrize("fov", [.1, 1., 2.])
def test_render_keeps_a_shared_grid_contrast_and_north_up_orientation(tmp_path, fov):
    size = 32
    wcs = make_grid(133.79512917, -7.24514722, fov, size)
    header = wcs.to_header()
    header["BUNIT"] = "MJy/sr"
    header["CRPIX1A"] = 1
    header["CRPIX2A"] = 1
    yy, xx = np.indices((size, size))
    star = np.exp(-((xx - 14) ** 2 + (yy - 20) ** 2) / 5)
    files = []
    for index, amplitude in enumerate([1, 2]):
        path = tmp_path / f"{index}.fits"
        fits.HDUList([
            fits.PrimaryHDU(), fits.ImageHDU(star * amplitude, header, name="IMAGE"),
            fits.ImageHDU(np.where(star > .05, SOURCE_MASK, 0).astype(np.int32), name="FLAGS"),
            fits.ImageHDU(np.ones((size, size)), name="VARIANCE"),
            fits.ImageHDU(np.zeros((size, size)), name="ZODI"), spectral_table(),
        ]).writeto(path)
        files.append({"id": str(index), "observationId": str(index), "path": path.name,
                      "observedAtUtc": f"2025-05-0{index + 1}T00:00:00Z", "sourceUrl": "https://example.test/synthetic"})
    result = render({"input": {"raDeg": 133.79512917, "decDeg": -7.24514722, "fovDeg": fov},
                     "files": files, "outputDirectory": "output"}, tmp_path)
    assert len(result["frames"]) == 2
    assert result["frames"][0]["coverage"] > .8
    a, b = [np.array(Image.open(tmp_path / "output" / f"{index}.png")) for index in range(2)]
    assert a.shape == (256, 256, 4)
    linear = np.fromfile(tmp_path / "output" / result["frames"][1]["radianceName"], dtype="<f4").reshape(256, 256)
    assert np.nanmax(linear) > 1  # preserve values beyond the PNG white point
    assert np.isfinite(linear).sum() > 0
    diagnostic = np.array(Image.open(tmp_path / "output" / result["frames"][0]["unmaskedImageName"]))
    assert result["frames"][0]["unmaskedCoverage"] >= result["frames"][0]["coverage"]
    valid = a[:, :, 3] > 0
    np.testing.assert_array_equal(a[valid, :3], diagnostic[valid, :3])
    rows, columns = np.indices((256, 256))
    centre_a = [np.average(axis, weights=a[:, :, 0]) for axis in (rows, columns)]
    centre_b = [np.average(axis, weights=b[:, :, 0]) for axis in (rows, columns)]
    np.testing.assert_allclose(centre_a, centre_b, atol=.25)
    peak_y, peak_x = np.unravel_index(np.argmax(a[:, :, 0]), (256, 256))
    assert peak_y < 128  # source is north of centre; PNG rows increase southward
    assert peak_x < 128
    assert b[peak_y, peak_x, 0] > a[peak_y, peak_x, 0]  # identical stretch, not per-frame normalization


def test_source_flag_is_retained_but_source_combined_with_a_defect_is_masked(tmp_path):
    size = 32
    header = make_grid(133.79512917, -7.24514722, .1, size).to_header()
    header["BUNIT"] = "MJy/sr"
    header["CRPIX1A"] = header["CRPIX2A"] = 1
    flags = np.full((size, size), SOURCE_MASK, dtype=np.int32)
    flags[10, 10] |= 1 << 6  # non-functional detector pixel, even if SOURCE is also set
    path = tmp_path / "flags.fits"
    fits.HDUList([
        fits.PrimaryHDU(), fits.ImageHDU(np.ones((size, size)), header, name="IMAGE"),
        fits.ImageHDU(flags, name="FLAGS"), fits.ImageHDU(np.ones((size, size)), name="VARIANCE"),
        fits.ImageHDU(np.zeros((size, size)), name="ZODI"), spectral_table(),
    ]).writeto(path)
    result = decode(path, 133.79512917, -7.24514722)
    assert result["image"][15, 15] == 1
    assert np.isnan(result["image"][10, 10])
    assert result["unmasked"][10, 10] == 1
    assert result["flagged"] == 1 / (size * size)
    assert {flag["bit"]: flag["pixels"] for flag in result["qualityBits"]} == {6: 1, 21: size * size}


def test_multiple_bands_are_rendered_as_separate_temporal_groups(tmp_path):
    from worker import render_request
    size = 32
    header = make_grid(133.79512917, -7.24514722, .1, size).to_header()
    header["BUNIT"] = "MJy/sr"
    header["CRPIX1A"] = header["CRPIX2A"] = 1
    yy, xx = np.indices((size, size))
    signal = np.exp(-((xx - 14) ** 2 + (yy - 20) ** 2) / 5)
    files = []
    for detector, wavelength in [("SPHEREx-D1", 1.0), ("SPHEREx-D4", 3.0)]:
        for index in range(30 if detector == "SPHEREx-D1" else 2):
            spectral = spectral_table()
            spectral.data[0]["VALUES"][..., 0] += wavelength - 1 + index * .1
            name = f"{detector}-{index}"
            fits.HDUList([
                fits.PrimaryHDU(), fits.ImageHDU(signal, header, name="IMAGE"),
                fits.ImageHDU(np.zeros((size, size), dtype=np.int32), name="FLAGS"),
                fits.ImageHDU(np.ones((size, size)), name="VARIANCE"),
                fits.ImageHDU(np.zeros((size, size)), name="ZODI"), spectral,
            ]).writeto(tmp_path / f"{name}.fits")
            files.append({"id": name, "observationId": name, "detector": detector, "path": f"{name}.fits",
                          "observedAtUtc": f"2025-05-{index + 1:02d}T00:00:00Z", "sourceUrl": "https://example.test/synthetic"})
    result = render_request({"input": {"raDeg": 133.79512917, "decDeg": -7.24514722, "fovDeg": .1},
                             "files": files, "detectors": ["SPHEREx-D1", "SPHEREx-D4", "SPHEREx-D6"],
                             "outputDirectory": "output"}, tmp_path)
    assert len(result["frames"]) == 32
    assert [band["status"] for band in result["bands"]] == ["ready", "ready", "failed"]
    for band in result["bands"][:2]:
        assert len(band["frameIds"]) == (30 if band["detector"] == "SPHEREx-D1" else 2)
        selected = [frame for frame in result["frames"] if frame["id"] in band["frameIds"]]
        assert {frame["detector"] for frame in selected} == {band["detector"]}
        assert all((tmp_path / "output" / frame["unmaskedImageName"]).exists() for frame in selected)
    assert result["bands"][2]["frameIds"] == []


def test_exports_all_frames_to_playable_mp4(tmp_path):
    import imageio_ffmpeg
    from export_video import export_video
    frames = []
    for index in range(30):
        path = tmp_path / f"{index}.png"
        Image.new("RGBA", (32, 32), (index * 8, 50, 100, 255)).save(path)
        frames.append({"path": path.name, "caption": f"2025-05-{index + 1:02d} UTC"})
    export_video(tmp_path, {"output": "sequence.mp4", "fps": 2.5, "frames": frames})
    reader = imageio_ffmpeg.read_frames(str(tmp_path / "sequence.mp4"))
    metadata = next(reader)
    assert metadata["fps"] == 2.5
    assert metadata["size"] == (32, 64)
    assert len(list(reader)) == 30


def test_color_video_uses_selected_channels_and_linear_exposure(tmp_path):
    import imageio_ffmpeg
    from export_video import render_frame, export_video
    for name, value in [("blue", .2), ("red", 2.0)]:
        np.full((32, 32), value, dtype="<f4").tofile(tmp_path / f"{name}.f32")
    sources = [{"radiancePath": "blue.f32", "detector": "SPHEREx-D1"}, {"radiancePath": "red.f32", "detector": "SPHEREx-D2"}]
    options = {"color": True, "exposure": -2, "channels": [{"enabled": True, "detector": "SPHEREx-D2"}, {"enabled": False, "detector": "auto"}, {"enabled": True, "detector": "SPHEREx-D1"}]}
    frame = {"sources": sources, "caption": "RGB -2 EV"}
    image = np.asarray(render_frame(tmp_path, frame, options, 32))
    expected = np.rint(np.arcsinh(10 * .25 * np.array([2, 0, .2])) / np.arcsinh(10) * 255)
    np.testing.assert_array_equal(image[0, 0], expected)
    brighter = np.asarray(render_frame(tmp_path, frame, {**options, "exposure": 0}, 32))
    assert brighter[0, 0, 0] > image[0, 0, 0]
    export_video(tmp_path, {"output": "rgb.mp4", "size": 32, "fps": 1, "options": options, "frames": [frame] * 3})
    reader = imageio_ffmpeg.read_frames(str(tmp_path / "rgb.mp4"))
    metadata = next(reader)
    decoded = list(reader)
    assert metadata["fps"] == 1 and len(decoded) == 3
    pixel = np.frombuffer(decoded[0], dtype=np.uint8).reshape(144, 32, 3)[10, 10]
    assert pixel[0] > pixel[2] > pixel[1]
    assert pixel[1] < 8


def test_exploratory_spectrum_and_inverse_variance_stacks(tmp_path):
    from analyze import analyze
    header = make_grid(133.79512917, -7.24514722, .1, 32).to_header()
    header["BUNIT"] = "MJy/sr"; header["CRPIX1A"] = header["CRPIX2A"] = 1
    files = []
    for index, (value, variance) in enumerate([(2., 1.), (10., 4.)]):
        path = tmp_path / f"analysis-{index}.fits"
        fits.HDUList([fits.PrimaryHDU(), fits.ImageHDU(np.full((32, 32), value), header, name="IMAGE"), fits.ImageHDU(np.zeros((32, 32), dtype=np.int32), name="FLAGS"), fits.ImageHDU(np.full((32, 32), variance), name="VARIANCE"), fits.ImageHDU(np.zeros((32, 32)), name="ZODI"), spectral_table()]).writeto(path)
        files.append({"path": path.name, "id": str(index), "observationId": str(index), "detector": "SPHEREx-D1", "sourceUrl": "https://example.test/file.fits", "observedAtUtc": f"2025-05-0{index + 1}T00:00:00Z"})
    request = {"input": {"raDeg": 133.79512917, "decDeg": -7.24514722, "fovDeg": .1}, "files": files, "analysis": {"kind": "spectrum", "rangeUm": [.7, 5.1]}}
    spectrum = analyze(tmp_path, request)
    assert spectrum["unit"] == "MJy/sr"
    assert [p["value"] for p in spectrum["points"]] == [2., 10.]
    assert [p["sigma"] for p in spectrum["points"]] == [1., 2.]
    assert all(.99 < p["wavelengthUm"] < 1.01 for p in spectrum["points"])
    stack = analyze(tmp_path, {**request, "analysis": {"kind": "stack", "rangeUm": [.7, 5.1]}})
    assert len(stack["stacks"]) == 1 and stack["stacks"][0]["count"] == 2
    np.testing.assert_allclose([stack["stacks"][0]["valueMin"], stack["stacks"][0]["valueMax"]], [3.6, 3.6])
    excluded = analyze(tmp_path, {**request, "analysis": {"kind": "spectrum", "rangeUm": [3., 4.]}})
    assert excluded["points"] == [] and len(excluded["skipped"]) == 2

    difference = analyze(tmp_path, {**request, "analysis": {"kind": "compare", "operation": "subtract"}})
    np.testing.assert_allclose([difference["valueMin"], difference["valueMax"]], [8, 8])
    addition = analyze(tmp_path, {**request, "analysis": {"kind": "compare", "operation": "add"}})
    np.testing.assert_allclose([addition["valueMin"], addition["valueMax"]], [12, 12])


def test_recorded_pointing_uses_wcs_reference_and_exposure_time_not_cutout_center(tmp_path):
    from analyze import recorded_pointing
    wcs = make_grid(133.79512917, -7.24514722, .1, 32)
    angle = np.deg2rad(30)
    wcs.wcs.pc = [[np.cos(angle), -np.sin(angle)], [np.sin(angle), np.cos(angle)]]
    header = wcs.to_header()
    header['CRPIX1'] = -150.5
    header['CRPIX2'] = 300.5
    header['DATE-OBS'] = '2025-05-01T01:00:00.000'
    header['DATE-AVG'] = '2025-05-01T01:02:03.456'
    header['TIMESYS'] = 'UTC'
    path = tmp_path / 'pointing.fits'
    fits.HDUList([fits.PrimaryHDU(), fits.ImageHDU(np.zeros((32, 32)), header, name='IMAGE')]).writeto(path)
    measured = recorded_pointing(path, '2026-01-01T00:00:00Z')
    np.testing.assert_allclose([measured['raDeg'], measured['decDeg']], [133.79512917, -7.24514722], atol=1e-8)
    np.testing.assert_allclose([measured['positiveXAngleDeg'], measured['positiveYAngleDeg']], [300, 30], atol=1e-3)
    assert measured['observedAtUtc'] == '2025-05-01T01:02:03.456Z'
    assert measured['timeSource'] == 'DATE-AVG'
    assert measured['scope'] == 'detector-WCS-reference'


def test_projection_cache_reuses_planes_and_invalidates_changed_inputs(tmp_path, monkeypatch):
    import worker
    path = tmp_path / "source.fits"
    path.write_bytes(b"fixture")
    calls = []
    def decode_fixture(*args):
        calls.append(args)
        return {"image": np.ones((2, 2)), "unmasked": np.full((2, 2), 2.),
                "wcs": None, "wave": 1., "bandwidth": .1, "flagged": 0., "qualityBits": []}
    monkeypatch.setattr(worker, "decode", decode_fixture)
    monkeypatch.setattr(worker, "reproject_interp", lambda source, target, shape_out: (source[0].copy(), np.ones(shape_out)))
    def project(fov=.1):
        return worker.projected_source(path, tmp_path, 10., 20., fov, 2, None)
    first, second = project(), project()
    assert len(calls) == 1
    np.testing.assert_array_equal(first[0], second[0])
    np.testing.assert_array_equal(first[1], second[1])
    assert first[2] == second[2]
    project(.2)
    assert len(calls) == 2
    path.write_bytes(b"changed fixture")
    project()
    assert len(calls) == 3
    for cache in (tmp_path / "projections").glob("*.npz"):
        cache.write_bytes(b"corrupted")
    project()
    assert len(calls) == 4


def test_recorded_spacecraft_reads_midpoint_and_rejects_unknown_reference(tmp_path):
    from analyze import recorded_spacecraft
    path = tmp_path / 'position.fits'
    header = fits.Header()
    for key, value in {'XYZ_SC_SYSTEM': 'GEOCENTER', 'SGT_LAT_MIDPT': 30.,
                       'SGT_LON_MIDPT': 140., 'X_SC': 7000., 'Y_SC': 0., 'Z_SC': 0.,
                       'VX_SC': 0., 'VY_SC': 7.5, 'VZ_SC': 0.,
                       'DATE-AVG': '2025-07-01T12:00:56.000', 'TIMESYS': 'UTC'}.items():
        header[key] = value
    fits.HDUList([fits.PrimaryHDU(), fits.ImageHDU(np.zeros((2, 2)), header, name='IMAGE')]).writeto(path)
    value = recorded_spacecraft(path, '2025-07-01T12:00:00Z')
    assert value['observedAtUtc'] == '2025-07-01T12:00:56.000Z'
    assert value['latitudeDeg'] == 30.
    assert value['longitudeDeg'] == 140.
    assert value['radiusKm'] == 7000.
    assert value['speedKmS'] == 7.5
    assert value['inertialPositionKm'] == {'x': 7000., 'y': 0., 'z': 0.}
    assert value['inertialVelocityKmS'] == {'x': 0., 'y': 7.5, 'z': 0.}
    with fits.open(path, mode='update') as hdul:
        hdul['IMAGE'].header['XYZ_SC_SYSTEM'] = 'UNKNOWN'
    assert recorded_spacecraft(path, '2025-07-01T12:00:00Z') is None
