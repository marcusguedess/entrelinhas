"""Converte transcrições Markdown simples em WebVTT por seção de áudio."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB_ROOT = ROOT / "Entrelinhas"
TRANSCRIPTS = WEB_ROOT / "transcripts"
AUDIOS = WEB_ROOT / "audios"
BITRATE_BPS = 64_000


def clean_markdown(text: str) -> str:
    text = re.sub(r"^\s*[-*_]{3,}\s*$", "", text, flags=re.MULTILINE)
    text = re.sub(r"^#{1,6}\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"[*_`~>#]", "", text)
    return re.sub(r"\s+", " ", text).strip()


def timestamp(seconds: float) -> str:
    millis = round(max(seconds, 0) * 1000)
    hours, remainder = divmod(millis, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    secs, millis = divmod(remainder, 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}.{millis:03d}"


def audio_duration_seconds(number: int) -> float:
    audio = AUDIOS / f"{number}.mp3"
    return (audio.stat().st_size * 8) / BITRATE_BPS


def markdown_blocks(path: Path) -> list[str]:
    source = path.read_text(encoding="utf-8-sig")
    blocks = [clean_markdown(block) for block in re.split(r"\n\s*\n+", source)]
    return [block for block in blocks if block]


def convert(number: int) -> Path:
    source = TRANSCRIPTS / f"{number}.md"
    target = TRANSCRIPTS / f"secao-{number:02d}.vtt"
    blocks = markdown_blocks(source)
    if not blocks:
        raise ValueError(f"{source.name} está vazio")

    duration = audio_duration_seconds(number)
    total_chars = sum(max(len(block), 1) for block in blocks)
    cursor = 0.0
    lines = ["WEBVTT", ""]

    for index, block in enumerate(blocks, start=1):
        share = max(len(block), 1) / total_chars
        cue_duration = max(2.5, duration * share)
        start = cursor
        end = min(duration, cursor + cue_duration)
        if index == len(blocks):
            end = duration
        lines.extend([str(index), f"{timestamp(start)} --> {timestamp(end)}", block, ""])
        cursor = end

    target.write_text("\n".join(lines), encoding="utf-8")
    return target


def main() -> int:
    for number in range(1, 11):
        target = convert(number)
        print(f"Gerado {target.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
