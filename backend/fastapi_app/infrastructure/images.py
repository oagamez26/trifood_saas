from io import BytesIO
from pathlib import Path
import logging
import secrets
import warnings
from PIL import Image, UnidentifiedImageError
from ..shared.domain.rules import DomainError


class ImageStorage:
    def __init__(self, root, maximum):
        self.root = Path(root).resolve()
        self.maximum = maximum

    def store(self, content):
        if len(content) > self.maximum or not content:
            raise DomainError(
                "INVALID_IMAGE", "La imagen debe ocupar como máximo 5 MiB."
            )
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)
                with Image.open(BytesIO(content)) as image:
                    if (
                        image.format not in {"JPEG", "PNG", "WEBP"}
                        or image.width * image.height > 20_000_000
                        or getattr(image, "is_animated", False)
                    ):
                        raise ValueError()
                    image.verify()
                with Image.open(BytesIO(content)) as image:
                    image.load()
                    output = BytesIO()
                    image.convert("RGB").save(output, format="JPEG", quality=90)
        except (
            UnidentifiedImageError,
            OSError,
            ValueError,
            Image.DecompressionBombError,
            Image.DecompressionBombWarning,
        ):
            raise DomainError(
                "INVALID_IMAGE",
                "Usa una imagen JPEG, PNG o WebP válida de hasta 20 megapíxeles.",
            )
        self.root.mkdir(parents=True, exist_ok=True)
        name = secrets.token_hex(20) + ".jpg"
        (self.root / name).write_bytes(output.getvalue())
        return "/media/products/" + name

    def remove(self, reference):
        target = (self.root / Path(reference).name).resolve()
        if target.parent != self.root:
            return
        try:
            target.unlink(missing_ok=True)
        except OSError:
            logging.getLogger(__name__).error("No se pudo limpiar una imagen huérfana.")
