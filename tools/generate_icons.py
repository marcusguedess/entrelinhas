"""Gera ícones PNG do PWA a partir da identidade visual do projeto."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "Entrelinhas" / "imagens"


def scaled(size: int, value: int) -> int:
    return round(value * (size / 512))


def generate_icon(size: int) -> Path:
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    s = lambda value: scaled(size, value)

    draw.rounded_rectangle([0, 0, size, size], radius=s(96), fill="#2f241f")
    draw.polygon(
        [
            (s(72), s(126)),
            (s(112), s(120)),
            (s(152), s(122)),
            (s(196), s(138)),
            (s(256), s(174)),
            (s(256), s(426)),
            (s(210), s(394)),
            (s(160), s(378)),
            (s(112), s(374)),
            (s(72), s(380)),
        ],
        fill="#fffdf8",
    )
    draw.polygon(
        [
            (s(440), s(126)),
            (s(400), s(120)),
            (s(360), s(122)),
            (s(316), s(138)),
            (s(256), s(174)),
            (s(256), s(426)),
            (s(302), s(394)),
            (s(352), s(378)),
            (s(400), s(374)),
            (s(440), s(380)),
        ],
        fill="#eadfce",
    )
    draw.line([(s(256), s(174)), (s(256), s(426))], fill="#bf8b3d", width=s(18))
    for y in (196, 252):
        draw.line([(s(108), s(y)), (s(150), s(y - 3)), (s(220), s(y + 30))], fill="#7a3225", width=s(14))
        draw.line([(s(404), s(y)), (s(362), s(y - 3)), (s(292), s(y + 30))], fill="#7a3225", width=s(14))

    path = OUTPUT / f"icon-{size}.png"
    image.save(path)
    return path


def main() -> int:
    for size in (192, 512):
        print(generate_icon(size).relative_to(ROOT))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
