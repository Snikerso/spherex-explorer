"""Local FITS -> common TAN grid -> PNG. No network or arbitrary code execution.

WCS-WAVE is used for visual compatibility, not scientific spectrophotometry.
The input manifest and every FITS path must be under the supplied cache root.
"""
from __future__ import annotations

import json
import hashlib
import os
import uuid
import sys
from pathlib import Path
import warnings

import numpy as np
from astropy.io import fits
from astropy.wcs import WCS
from astropy.utils.exceptions import AstropyWarning
from PIL import Image
from reproject import reproject_interp
from scipy.interpolate import RegularGridInterpolator

warnings.simplefilter("ignore", AstropyWarning)
PIPELINE_VERSION = "tan-all-wavelengths-v5"
# IRSA SOURCE (bit 21) marks astrophysical signal for background estimation, not a defect.
SOURCE_MASK = 1 << 21


class ImagingError(Exception):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code


def wave_map(hdul, x, y):
    table = hdul["WCS-WAVE"].data[0]
    xs = np.asarray(table["X"], dtype=float)
    ys = np.asarray(table["Y"], dtype=float)
    values = np.asarray(table["VALUES"], dtype=float)
    header = hdul["IMAGE"].header
    # SPHEREx cutouts retain the parent detector spectral lookup grid.
    original_x = 1 + x - header.get("CRPIX1A", 1)
    original_y = 1 + y - header.get("CRPIX2A", 1)
    interpolator = RegularGridInterpolator((ys, xs), values, bounds_error=False, fill_value=np.nan)
    points = np.stack([original_y + 1, original_x + 1], axis=-1)
    return interpolator(points).reshape(np.shape(x) + values.shape[2:])


def decode(path, ra, dec):
    with fits.open(path, memmap=False) as hdul:
        for name in ("IMAGE", "FLAGS", "VARIANCE", "ZODI", "WCS-WAVE"):
            if name not in hdul:
                raise ImagingError("INVALID_FITS", f"Brak rozszerzenia {name} w FITS.")
        image = np.array(hdul["IMAGE"].data, dtype=float)
        if image.ndim != 2 or image.size > 2040 * 2040:
            raise ImagingError("INVALID_FITS", "Nieprawidłowy rozmiar obrazu.")
        header = hdul["IMAGE"].header
        if "MJy" not in header.get("BUNIT", ""):
            raise ImagingError("INVALID_UNITS", "Nieznana jednostka jasności FITS.")
        wcs = WCS(header, hdul).celestial
        if not wcs.has_celestial:
            raise ImagingError("MISSING_WCS", "Brak układu współrzędnych nieba.")
        cx, cy = wcs.world_to_pixel_values(ra, dec)
        if not (-0.5 <= cx < image.shape[1] - 0.5 and -0.5 <= cy < image.shape[0] - 0.5):
            raise ImagingError("NO_COVERAGE", "Środek obszaru jest poza tą obserwacją.")
        centre_wave = wave_map(hdul, np.asarray(cx), np.asarray(cy))
        if not np.all(np.isfinite(centre_wave)) or centre_wave[1] <= 0:
            raise ImagingError("INVALID_WAVELENGTH", "Nie można ustalić długości fali w środku pola.")
        yy, xx = np.indices(image.shape, dtype=float)
        spectral = wave_map(hdul, xx, yy)
        flags = np.asarray(hdul["FLAGS"].data)
        variance = np.asarray(hdul["VARIANCE"].data)
        usable = ((flags == 0) | (flags == SOURCE_MASK)) & np.isfinite(image) & np.isfinite(variance) & (variance > 0)
        image -= np.asarray(hdul["ZODI"].data, dtype=float)
        unmasked = image.copy()
        image[~usable] = np.nan
        flag_header = hdul["FLAGS"].header
        unsigned = flags.astype(np.uint32)
        quality_bits = [{"bit": bit, "name": flag_header.get(f"MSKN{bit:04d}", "SOURCE" if bit == 21 else f"BIT_{bit}"), "description": flag_header.get(f"MSKD{bit:04d}", ""), "pixels": int(np.count_nonzero(unsigned & (1 << bit))), "fraction": float(np.mean((unsigned & (1 << bit)) != 0))} for bit in range(32) if np.any(unsigned & (1 << bit))]
        return {"qualityBits": quality_bits, "variance": variance, "image": image, "unmasked": unmasked, "wcs": wcs, "spectral": spectral, "wave": float(centre_wave[0]),
                "bandwidth": float(centre_wave[1]), "flagged": float(1 - np.mean(usable))}


def make_grid(ra, dec, fov, size=256):
    wcs = WCS(naxis=2)
    wcs.wcs.crpix = [(size + 1) / 2, (size + 1) / 2]
    wcs.wcs.cdelt = [-fov / size, fov / size]
    wcs.wcs.crval = [ra, dec]
    wcs.wcs.ctype = ["RA---TAN", "DEC--TAN"]
    return wcs


def projected_source(path, root, ra, dec, fov, size, target):
    """Cache only source projection; contrast is recomputed for each selected sequence."""
    stat = path.stat()
    identity = [str(path), stat.st_size, stat.st_mtime_ns, ra, dec, fov, size,
                hashlib.sha256(Path(__file__).read_bytes()).hexdigest()]
    key = hashlib.sha256(json.dumps(identity).encode()).hexdigest()
    cache = root / "projections" / f"{key}.npz"
    try:
        with np.load(cache, allow_pickle=False) as saved:
            image, diagnostic = saved["image"], saved["diagnostic"]
            metadata = json.loads(str(saved["metadata"]))
            if image.shape != (size, size) or diagnostic.shape != (size, size):
                raise ValueError("Invalid projection shape")
            return image, diagnostic, metadata
    except (OSError, ValueError, KeyError, EOFError):
        pass
    source = decode(path, ra, dec)
    image, footprint = reproject_interp((source["image"], source["wcs"]), target, shape_out=(size, size))
    diagnostic, diagnostic_footprint = reproject_interp((source["unmasked"], source["wcs"]), target, shape_out=(size, size))
    image[(footprint <= 0) | ~np.isfinite(image)] = np.nan
    diagnostic[diagnostic_footprint <= 0] = np.nan
    metadata = {key: source[key] for key in ["wave", "bandwidth", "flagged", "qualityBits"]}
    cache.parent.mkdir(parents=True, exist_ok=True)
    temporary = cache.with_suffix(f".{uuid.uuid4().hex}.tmp")
    try:
        with temporary.open("wb") as destination:
            np.savez(destination, image=image, diagnostic=diagnostic, metadata=json.dumps(metadata))
        os.replace(temporary, cache)
    finally:
        temporary.unlink(missing_ok=True)
    return image, diagnostic, metadata


def render(request, root):
    region = request["input"]
    ra, dec, fov = region["raDeg"], region["decDeg"], region["fovDeg"]
    if not (0 <= ra < 360 and -90 <= dec <= 90 and 0 < fov <= 2):
        raise ImagingError("INVALID_COORDINATES", "Nieprawidłowy region nieba.")
    files = request["files"]
    if len(files) < 2:
        raise ImagingError("INVALID_SELECTION", "Przygotowanie wymaga co najmniej 2 klatek.")
    output = (root / request["outputDirectory"]).resolve()
    if not output.is_relative_to(root):
        raise ImagingError("INVALID_PATH", "Nieprawidłowa ścieżka wyjściowa.")
    output.mkdir(parents=True, exist_ok=True)
    size = 256
    target = make_grid(ra, dec, fov, size)
    frames, notes = [], []
    for item in files:
        path = (root / item["path"]).resolve()
        if not path.is_relative_to(root):
            raise ImagingError("INVALID_PATH", "FITS musi znajdować się w cache.")
        try:
            image, diagnostic, metadata = projected_source(path, root, ra, dec, fov, size, target)
            frames.append({**item, "decoded": metadata, "plane": image, "diagnostic": diagnostic})
        except ImagingError as error:
            notes.append(f"Pominięto {item['observationId']}: {error}")
    group = frames
    if len(group) < 2:
        raise ImagingError("NO_COMPARABLE_FRAMES", "Pobrano mniej niż dwie poprawne klatki obejmujące wybrane pole.")
    notes.append("Filtrowanie długości fali wyłączone. Animacja pokazuje wszystkie dostępne obserwacje; różnice jasności i wyglądu mogą wynikać z różnych długości fali.")
    group.sort(key=lambda frame: frame["observedAtUtc"])
    if len({frame["observedAtUtc"] for frame in group}) < 2:
        raise ImagingError("NO_COMPARABLE_FRAMES", "Potrzebne są odrębne czasy obserwacji.")
    arrays = [frame["plane"] for frame in group]
    unmasked_arrays = [frame["diagnostic"] for frame in group]
    pixels = np.concatenate([image[np.isfinite(image)] for image in unmasked_arrays])
    if not pixels.size:
        raise ImagingError("INSUFFICIENT_COVERAGE", "Brak danych obrazu w wybranym polu.")
    low, high = (float(value) for value in np.nanpercentile(pixels, [2, 99.7]))
    if not high > low:
        high = low + 1
    rendered = []
    for frame, image, diagnostic in zip(group, arrays, unmasked_arrays):
        common = np.isfinite(image)
        unmasked_common = np.isfinite(diagnostic)
        coverage = float(np.mean(common))
        unmasked_coverage = float(np.mean(unmasked_common))
        normalized = np.clip(np.nan_to_num((image - low) / (high - low)), 0, 1)
        grey = (np.arcsinh(10 * normalized) / np.arcsinh(10) * 255).astype(np.uint8)
        rgba = np.stack([grey, grey, grey, common.astype(np.uint8) * 255], axis=-1)
        name = f"{frame['id']}.png"
        Image.fromarray(np.flipud(rgba)).save(output / name)
        diagnostic_normalized = np.clip(np.nan_to_num((diagnostic - low) / (high - low)), 0, 1)
        diagnostic_grey = (np.arcsinh(10 * diagnostic_normalized) / np.arcsinh(10) * 255).astype(np.uint8)
        diagnostic_rgba = np.stack([diagnostic_grey, diagnostic_grey, diagnostic_grey, unmasked_common.astype(np.uint8) * 255], axis=-1)
        radiance_name = f"{frame['id']}-radiance.f32"
        # Linear samples retain highlights above the PNG white point. Browser exposure is lossless.
        np.flipud((diagnostic - low) / (high - low)).astype("<f4").tofile(output / radiance_name)
        diagnostic_name = f"{frame['id']}-unmasked.png"
        Image.fromarray(np.flipud(diagnostic_rgba)).save(output / diagnostic_name)
        rendered.append({"id": frame["id"], "observationId": frame["observationId"], "observedAtUtc": frame["observedAtUtc"],
                         "wavelengthUm": frame["decoded"]["wave"], "bandwidthUm": frame["decoded"]["bandwidth"],
                         "coverage": coverage, "qualityBits": frame["decoded"]["qualityBits"], "radianceName": radiance_name, "unmaskedCoverage": unmasked_coverage, "unmaskedImageName": diagnostic_name, "flaggedFraction": frame["decoded"]["flagged"], "imageName": name,
                         "sourceUrl": frame["sourceUrl"], **({"detector": frame["detector"]} if frame.get("detector") else {})})
    notes.extend(["Podgląd wizualny: odjęty model ZODI, wspólny kontrast asinh, bez dopasowania PSF i bez fotometrii.",
                  "Maska zachowuje flagę SOURCE (bit 21: źródła astronomiczne), a wyklucza pozostałe flagi jakości. Przezroczyste obszary oznaczają brak poprawnych danych."])
    return {"frames": rendered, "grid": {"width": size, "height": size, "raDeg": ra, "decDeg": dec, "pixelScaleDeg": fov / size},
            "stretch": {"low": low, "high": high, "function": "asinh(10*x)/asinh(10)"}, "warnings": notes, "pipelineVersion": PIPELINE_VERSION}


def render_request(request, root):
    detectors = request.get("detectors")
    if not detectors:
        return render(request, root)
    if not 1 <= len(detectors) <= 6 or len(set(detectors)) != len(detectors):
        raise ImagingError("INVALID_SELECTION", "Wybierz od jednego do sześciu różnych detektorów.")
    bands, frames, notes = [], [], []
    first = None
    for detector in detectors:
        files = [item for item in request["files"] if item.get("detector") == detector]
        try:
            result = render({**request, "files": files}, root)
            first = first or result
            frames.extend(result["frames"])
            bands.append({"detector": detector, "status": "ready", "frameIds": [item["id"] for item in result["frames"]], "stretch": result["stretch"]})
            notes.extend(f"{detector}: {note}" for note in result["warnings"] if not note.startswith("Maska "))
        except ImagingError as error:
            bands.append({"detector": detector, "status": "failed", "frameIds": [], "error": {"code": error.code, "message": str(error)}})
            notes.append(f"{detector}: {error}")
    if first is None:
        raise ImagingError("NO_COMPARABLE_FRAMES", "Żadne z wybranych pasm nie ma zgodnej pary. " + " ".join(notes))
    return {"frames": frames, "grid": first["grid"], "stretch": first["stretch"], "warnings": notes,
            "bands": bands, "pipelineVersion": "tan-all-wavelengths-multiband-v5"}


if __name__ == "__main__":
    try:
        root = Path(sys.argv[1]).resolve()
        request_path = Path(sys.argv[2]).resolve()
        if not request_path.is_relative_to(root):
            raise ImagingError("INVALID_PATH", "Manifest musi znajdować się w cache.")
        result = render_request(json.loads(request_path.read_text()), root)
        print(json.dumps({"ok": True, "result": result}, allow_nan=False))
    except Exception as error:
        code = error.code if isinstance(error, ImagingError) else "IMAGING_ERROR"
        message = str(error) if isinstance(error, ImagingError) else "Nie udało się przetworzyć FITS. Sprawdź format i dostępność wycinków."
        print(json.dumps({"ok": False, "error": {"code": code, "message": message}}))
        sys.exit(1)
