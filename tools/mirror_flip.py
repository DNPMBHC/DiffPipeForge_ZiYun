#!/usr/bin/env python3
import argparse
import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageOps

IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff'}
VIDEO_EXTENSIONS = {'.mp4', '.mov', '.mkv', '.webm', '.avi', '.m4v', '.wmv'}


def get_ffmpeg_exe() -> str:
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        ffmpeg = shutil.which('ffmpeg')
        if ffmpeg:
            return ffmpeg
        raise RuntimeError('ffmpeg not found. Please install imageio-ffmpeg or add ffmpeg to PATH.')


def iter_files(input_path: Path, media_type: str):
    exts = set()
    if media_type in ('all', 'image'):
        exts.update(IMAGE_EXTENSIONS)
    if media_type in ('all', 'video'):
        exts.update(VIDEO_EXTENSIONS)

    if input_path.is_file():
        if input_path.suffix.lower() in exts:
            yield input_path
        return

    for path in input_path.iterdir():
        if path.is_file() and path.suffix.lower() in exts:
            yield path


def build_output_path(src: Path) -> Path:
    dst = src.with_name(f'{src.stem}_fliped{src.suffix}')
    if not dst.exists():
        return dst

    counter = 2
    while True:
        candidate = src.with_name(f'{src.stem}_fliped_{counter}{src.suffix}')
        if not candidate.exists():
            return candidate
        counter += 1


def apply_image_flip(src: Path, dst: Path, mode: str):
    dst.parent.mkdir(parents=True, exist_ok=True)

    with Image.open(src) as img:
        result = img
        if mode in ('horizontal', 'both'):
            result = ImageOps.mirror(result)
        if mode in ('vertical', 'both'):
            result = ImageOps.flip(result)
        save_kwargs = {}
        if result.format:
            save_kwargs['format'] = result.format
        result.save(dst, **save_kwargs)


def apply_video_flip(src: Path, dst: Path, mode: str, ffmpeg: str):
    tmp = dst.with_name(dst.stem + '.tmp' + dst.suffix)
    tmp.parent.mkdir(parents=True, exist_ok=True)

    filters = []
    if mode in ('horizontal', 'both'):
        filters.append('hflip')
    if mode in ('vertical', 'both'):
        filters.append('vflip')
    vf = ','.join(filters) or 'null'

    cmd = [
        ffmpeg,
        '-y',
        '-hide_banner',
        '-loglevel', 'error',
        '-i', str(src),
        '-vf', vf,
        '-map', '0',
        '-c:a', 'copy',
        str(tmp),
    ]
    result = subprocess.run(cmd, text=True, capture_output=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or f'ffmpeg failed with code {result.returncode}')

    tmp.replace(dst)


def copy_sidecar_caption(src: Path, dst: Path):
    caption = src.with_suffix('.txt')
    if caption.exists():
        target = dst.with_suffix('.txt')
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(caption, target)


def main():
    parser = argparse.ArgumentParser(description='Mirror flip images and videos.')
    parser.add_argument('--input', required=True, help='Input file or directory')
    parser.add_argument('--mode', choices=['horizontal', 'vertical', 'both'], default='horizontal')
    parser.add_argument('--type', choices=['all', 'image', 'video'], default='all')
    args = parser.parse_args()

    input_path = Path(args.input).expanduser().resolve()
    if not input_path.exists():
        print(f'[ERROR] Input path not found: {input_path}')
        return 1

    files = list(iter_files(input_path, args.type))
    if not files:
        print('[WARN] No supported media files found.')
        return 0

    ffmpeg = None
    if any(path.suffix.lower() in VIDEO_EXTENSIONS for path in files):
        ffmpeg = get_ffmpeg_exe()
        print(f'[INFO] ffmpeg: {ffmpeg}')

    print(f'[INFO] Found {len(files)} file(s). Mode={args.mode}, Type={args.type}')
    ok = 0
    failed = 0

    for idx, src in enumerate(files, 1):
        dst = build_output_path(src)
        try:
            if src.suffix.lower() in IMAGE_EXTENSIONS:
                apply_image_flip(src, dst, args.mode)
                copy_sidecar_caption(src, dst)
            else:
                if ffmpeg is None:
                    raise RuntimeError('ffmpeg unavailable')
                apply_video_flip(src, dst, args.mode, ffmpeg)
            ok += 1
            print(f'[{idx}/{len(files)}] OK: {src.name} -> {dst}')
        except Exception as exc:
            failed += 1
            print(f'[{idx}/{len(files)}] FAIL: {src} | {exc}')

    print(f'[DONE] success={ok}, failed={failed}')
    return 0 if failed == 0 else 2


if __name__ == '__main__':
    sys.exit(main())
