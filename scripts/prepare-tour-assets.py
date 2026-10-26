"""Prepare a reviewed, private photo catalog. Original files are never changed.

python scripts/prepare-tour-assets.py --manifest private.json --source FOTOS --out .tools/tour-assets
Requires Pillow. The manifest and real output must stay outside the public repository.
"""
import argparse, hashlib, json, math, re
from pathlib import Path
from PIL import Image, ImageOps, ImageFilter, ImageDraw

def prepare(manifest, source, output):
    source, output = Path(source).resolve(), Path(output).resolve()
    if output == source or source in output.parents:
        raise ValueError('La salida debe estar fuera de los originales.')
    if output.exists() and any(output.iterdir()):
        raise ValueError('Usa una carpeta de salida nueva o vacía; no se mezclan versiones.')
    output.mkdir(parents=True, exist_ok=True)
    (output / 'media').mkdir(exist_ok=True)
    hashes, images, catalog = {}, {}, {'format': 1, 'tours': []}

    def load(spec):
        path = (source / spec['file']).resolve()
        if source not in path.parents or not path.is_file():
            raise ValueError('Imagen fuera de la carpeta de origen.')
        raw = path.read_bytes()
        hashes[str(path.relative_to(source))] = hashlib.sha256(raw).hexdigest()
        im = ImageOps.exif_transpose(Image.open(path)).convert('RGB')
        # Redactions are reviewer-selected normalized rectangles, applied to copies only.
        for box in spec.get('redactions', []):
            validate_rect(box)
            rect = tuple(round(v * (im.width if i % 2 == 0 else im.height)) for i, v in enumerate(box))
            mask = Image.new('L', im.size, 0)
            ImageDraw.Draw(mask).rectangle(rect, fill=255)
            mask = mask.filter(ImageFilter.GaussianBlur(max(8, im.width / 240)))
            im = Image.composite(im.filter(ImageFilter.GaussianBlur(max(18, im.width / 90))), im, mask)
        if 'crop' in spec:
            validate_rect(spec['crop'])
            im = im.crop(tuple(round(v * (im.width if i % 2 == 0 else im.height)) for i, v in enumerate(spec['crop'])))
        if spec.get('rotate'):
            im = im.rotate(spec['rotate'], expand=True)
        return raw, im

    def save(im, limit, quality=83):
        copy = im.copy()
        copy.thumbnail((limit, limit), Image.Resampling.LANCZOS)
        import io
        content = io.BytesIO()
        # A fresh image drops EXIF/XMP/GPS; geometry is stored in the catalog.
        copy.save(content, 'WEBP', quality=quality, method=6)
        data = content.getvalue()
        key = 'photo-' + hashlib.sha256(data).hexdigest()[:24]
        (output / 'media' / (key + '.webp')).write_bytes(data)
        images[key] = {'bytes': len(data), 'width': copy.width, 'height': copy.height}
        return key, copy.size

    def detail(spec, limit=2048):
        _, im = load(spec)
        key, (w, h) = save(im, limit)
        thumb, _ = save(im, 360, 75)
        return {'id': key, 'thumbnail': thumb, 'alt': spec['alt'], 'width': w, 'height': h}

    for scene in manifest['tours']:
        if 'crop' in scene['panorama'] or scene['panorama'].get('rotate'):
            raise ValueError('No recortes ni gires una panorámica sin recalcular antes su geometría GPano.')
        raw, pano = load(scene['panorama'])
        xmp = {k.decode(): int(v) for k, v in re.findall(rb'GPano:([A-Za-z]+)="([0-9]+)"', raw)}
        required = ['FullPanoWidthPixels', 'FullPanoHeightPixels', 'CroppedAreaImageWidthPixels', 'CroppedAreaImageHeightPixels']
        if any(key not in xmp for key in required):
            raise ValueError('Falta geometría GPano original; no se puede inventar el recorte.')
        full_w, full_h = xmp['FullPanoWidthPixels'], xmp['FullPanoHeightPixels']
        p = {'fullWidth': full_w, 'fullHeight': full_h,
             'croppedWidth': xmp['CroppedAreaImageWidthPixels'], 'croppedHeight': xmp['CroppedAreaImageHeightPixels'],
             'croppedX': xmp.get('CroppedAreaLeftPixels', 0), 'croppedY': xmp.get('CroppedAreaTopPixels', 0)}
        key, (w, h) = save(pano, 4096)
        thumb, _ = save(pano, 600, 75)
        scale = w / pano.width
        scaled = {k: round(v * scale) for k, v in p.items()}
        scaled['fullHeight'] = scaled['fullWidth'] // 2
        scaled['croppedWidth'], scaled['croppedHeight'] = w, h

        def position(at):
            if len(at) != 2 or not all(isinstance(v, (int, float)) and 0 <= v <= 1 for v in at):
                raise ValueError('Las posiciones deben ser dos coordenadas entre 0 y 1.')
            x, y = at
            return {'yaw': ((p['croppedX'] + x * p['croppedWidth']) / full_w - .5) * 2 * math.pi,
                    'pitch': math.pi / 2 - (p['croppedY'] + y * p['croppedHeight']) / full_h * math.pi}

        tour = {k: scene[k] for k in ['id', 'venueId', 'departmentId', 'title', 'version', 'capturedAt']}
        tour.update(panorama={'id': key, 'thumbnail': thumb, 'alt': scene['panorama']['alt'], 'width': w, 'height': h},
                    panoData=scaled, initialView=position(scene['initialView']), zones=[])
        for zone in scene['zones']:
            specs = []
            for original_spec in zone['images']:
                spec = dict(original_spec)
                if spec['file'] == scene['panorama']['file'] and 'redactions' not in spec:
                    spec['redactions'] = scene['panorama'].get('redactions', [])
                specs.append(spec)
            tour['zones'].append({'id': zone['id'], 'title': zone['title'], 'icon': zone['icon'],
                                  **position(zone['at']), 'images': [detail(spec) for spec in specs]})
        catalog['tours'].append(tour)
    # Write catalog last so an interrupted build never publishes a partially prepared catalog.
    (output / '__tour_catalog.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding='utf8')
    receipt = {'sources': hashes, 'images': images, 'totalBytes': sum(im['bytes'] for im in images.values())}
    (output.parent / (output.name + '-receipt.json')).write_text(json.dumps(receipt, indent=2), encoding='utf8')
    print(json.dumps({'tours': len(catalog['tours']), 'images': len(images), 'bytes': receipt['totalBytes']}, ensure_ascii=False))

def validate_rect(box):
    if len(box) != 4 or not all(isinstance(v, (int, float)) and 0 <= v <= 1 for v in box) or box[0] >= box[2] or box[1] >= box[3]:
        raise ValueError('Revisa los rectángulos de recorte y privacidad: cuatro valores entre 0 y 1.')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    for flag in ['manifest', 'source', 'out']:
        parser.add_argument('--' + flag, required=True)
    args = parser.parse_args()
    prepare(json.loads(Path(args.manifest).read_text(encoding='utf8')), args.source, args.out)
