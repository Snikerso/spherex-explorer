"""Encode the authorized frame list in order using the bundled FFmpeg binary."""
import json
import sys
from pathlib import Path

import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw


def safe_path(root, value):
    path = (root / value).resolve()
    if not path.is_relative_to(root):
        raise ValueError('Invalid frame path')
    return path


def linear_samples(root, source, size):
    if source.get('radiancePath'):
        return np.fromfile(safe_path(root, source['radiancePath']), dtype='<f4').reshape(size, size)
    with Image.open(safe_path(root, source['path'])) as image:
        rgba = np.asarray(image.convert('RGBA').resize((size, size)))
        values = np.sinh(rgba[..., 0].astype(float) / 255 * np.arcsinh(10)) / 10
        values[rgba[..., 3] == 0] = np.nan
        return values


def render_frame(root, frame, options, size):
    sources = frame['sources']
    values = [linear_samples(root, source, size) for source in sources]
    if options.get('color'):
        sums = np.zeros((3, size, size)); counts = np.zeros_like(sums)
        for index, value in enumerate(values):
            channel = (2 if index == 0 else 0) if len(values) == 2 else 2 - min(2, index * 3 // len(values))
            valid = np.isfinite(value)
            sums[channel] += np.where(valid, value, 0); counts[channel] += valid
        automatic = np.divide(sums, counts, out=np.full_like(sums, np.nan), where=counts > 0)
        if len(values) == 2:
            automatic[1] = np.sqrt(np.maximum(0, automatic[0]) * np.maximum(0, automatic[2]))
        channels = []
        for index, setting in enumerate(options['channels']):
            if not setting['enabled']:
                channels.append(np.zeros((size, size)))
            elif setting['detector'] == 'auto':
                channels.append(automatic[index])
            else:
                source_index = next((i for i, source in enumerate(sources) if source['detector'] == setting['detector']), None)
                if source_index is None:
                    raise ValueError('Missing RGB source')
                channels.append(values[source_index])
    else:
        channels = [values[0]] * 3
    rgb = np.stack(channels, axis=-1)
    valid = np.all(np.isfinite(rgb), axis=-1) & np.any(np.isfinite(np.stack(values)), axis=0)
    normalized = np.arcsinh(10 * 2 ** options.get('exposure', 0) * np.maximum(0, rgb)) / np.arcsinh(10)
    pixels = np.clip(np.rint(np.nan_to_num(normalized) * 255), 0, 255).astype(np.uint8)
    pixels[~valid] = [6, 13, 18]
    return Image.fromarray(pixels)


def export_video(root, request):
    output = safe_path(root, request['output'])
    writer = None
    options = request.get('options') or {}
    try:
        for frame in request['frames']:
            if 'sources' in frame:
                image = render_frame(root, frame, options, request.get('size', 256))
                caption_height = 112 if options.get('color') else 32
                canvas = Image.new('RGB', (image.width, image.height + caption_height), '#060d12')
                canvas.paste(image, (0, 0))
            else:
                with Image.open(safe_path(root, frame['path'])) as source:
                    rgba = source.convert('RGBA')
                    canvas = Image.new('RGB', (rgba.width, rgba.height + 32), '#060d12')
                    canvas.paste(rgba, (0, 0), rgba)
            ImageDraw.Draw(canvas).text((6, canvas.height - (112 if options.get('color') else 32) + 4), frame['caption'], fill='#a3e5e8', spacing=2)
            if writer is None:
                writer = imageio_ffmpeg.write_frames(str(output), canvas.size, fps=request['fps'], codec='libx264', pix_fmt_in='rgb24', pix_fmt_out='yuv420p', macro_block_size=2, output_params=['-movflags', '+faststart'], ffmpeg_log_level='error')
                writer.send(None)
            writer.send(np.asarray(canvas).tobytes())
    finally:
        if writer is not None:
            writer.close()


if __name__ == '__main__':
    export_video(Path(sys.argv[1]).resolve(), json.loads(Path(sys.argv[2]).read_text()))
