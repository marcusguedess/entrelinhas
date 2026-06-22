"""Ferramentas sem dependências para manter e servir o projeto Entrelinhas."""

from __future__ import annotations

import argparse
import json
import mimetypes
import os
import re
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
WEB_ROOT = ROOT / os.environ.get("ENTRELINHAS_APP_DIR", "Entrelinhas")
CATALOG_PATH = WEB_ROOT / "data" / "catalog.json"
SAFE_MEDIA = re.compile(r"^[\w./-]+\.(?:mp3|m4a|ogg|wav|vtt|md)$", re.IGNORECASE)
TIMING = re.compile(r"^(\d{2}:)?\d{2}:\d{2}[.,]\d{3}\s+-->\s+(\d{2}:)?\d{2}:\d{2}[.,]\d{3}")
BITRATE_BPS = 64_000


def format_duration(seconds: int) -> str:
    minutes, secs = divmod(max(seconds, 0), 60)
    return f"{minutes} min" if secs < 30 else f"{minutes + 1} min"


def load_catalog() -> dict[str, Any]:
    with CATALOG_PATH.open(encoding="utf-8") as file:
        value = json.load(file)
    if not isinstance(value, dict) or not isinstance(value.get("chapters"), list):
        raise ValueError("data/catalog.json não contém uma lista de capítulos")
    return value


def resolve_asset(value: object) -> Path | None:
    if value is None:
        return None
    relative = str(value)
    if not relative.startswith("./") or ".." in relative or not SAFE_MEDIA.match(relative[2:]):
        raise ValueError(f"caminho de mídia inseguro: {relative!r}")
    resolved = (WEB_ROOT / relative[2:]).resolve()
    if WEB_ROOT.resolve() not in resolved.parents:
        raise ValueError(f"mídia fora da pasta pública: {relative!r}")
    return resolved


def validate_vtt(path: Path) -> list[str]:
    issues: list[str] = []
    source = path.read_text(encoding="utf-8-sig")
    if not source.lstrip().startswith("WEBVTT"):
        issues.append(f"{path.name}: cabeçalho WEBVTT ausente")
    if not any(TIMING.match(line.strip()) for line in source.splitlines()):
        issues.append(f"{path.name}: nenhuma marcação de tempo válida")
    return issues


def validate_markdown(path: Path) -> list[str]:
    issues: list[str] = []
    source = path.read_text(encoding="utf-8-sig")
    if not source.strip():
        issues.append(f"{path.name}: transcrição Markdown vazia")
    return issues


def validate() -> int:
    errors: list[str] = []
    warnings: list[str] = []
    try:
        catalog = load_catalog()
        seen: set[str] = set()
        for chapter in catalog["chapters"]:
            if not isinstance(chapter, dict):
                errors.append("capítulo deve ser um objeto")
                continue
            chapter_id = str(chapter.get("id", ""))
            if not re.fullmatch(r"capitulo-\d{2,3}", chapter_id) or chapter_id in seen:
                errors.append(f"id inválido ou duplicado: {chapter_id!r}")
            seen.add(chapter_id)
            for field in ("audio", "transcript"):
                try:
                    path = resolve_asset(chapter.get(field))
                except ValueError as exc:
                    errors.append(str(exc))
                    continue
                if path and not path.is_file():
                    errors.append(f"arquivo declarado não existe: {path.relative_to(ROOT)}")
                elif path and field == "transcript":
                    if path.suffix.lower() == ".vtt":
                        errors.extend(validate_vtt(path))
                    elif path.suffix.lower() == ".md":
                        errors.extend(validate_markdown(path))
            if chapter.get("audio") is None and chapter.get("transcript") is None:
                warnings.append(f"{chapter_id}: sem áudio e sem transcrição")
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        errors.append(str(exc))

    for required in ("index.html", "style.css", "manifest.json", "sw.js", "js/app.js"):
        if not (WEB_ROOT / required).is_file():
            errors.append(f"arquivo obrigatório ausente: {required}")

    for warning in warnings:
        print(f"AVISO: {warning}")
    for error in errors:
        print(f"ERRO: {error}", file=sys.stderr)
    print(f"Validação concluída: {len(errors)} erro(s), {len(warnings)} aviso(s).")
    return 1 if errors else 0


def refresh_catalog() -> int:
    """Detecta mídias adicionadas mantendo metadados editoriais existentes."""
    catalog = load_catalog()
    for chapter in catalog["chapters"]:
        number = int(chapter["number"])
        stem = f"{number:02d}"
        audio = next(
            (
                path
                for name in (stem, str(number))
                for extension in ("mp3", "m4a", "ogg", "wav")
                if (path := WEB_ROOT / "audios" / f"{name}.{extension}").is_file()
            ),
            None,
        )
        transcript = next(
            (
                path
                for name in (
                    f"secao-{number:02d}.vtt",
                    f"{stem}.vtt",
                    f"{number}.vtt",
                    f"{stem}.md",
                    f"{number}.md",
                )
                if (path := WEB_ROOT / "transcripts" / name).is_file()
            ),
            None,
        )
        chapter["audio"] = f"./audios/{audio.name}" if audio else None
        chapter["transcript"] = f"./transcripts/{transcript.name}" if transcript else None
        chapter["chapterStart"] = ((number - 1) * 5) + 1
        chapter["chapterEnd"] = number * 5
        if audio:
            duration_seconds = round((audio.stat().st_size * 8) / BITRATE_BPS)
            chapter["durationSeconds"] = duration_seconds
            chapter["durationLabel"] = format_duration(duration_seconds)
    CATALOG_PATH.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Catálogo atualizado em {CATALOG_PATH.relative_to(ROOT)}")
    return validate()


class SecureStaticHandler(SimpleHTTPRequestHandler):
    """Servidor de desenvolvimento com a mesma política de segurança da aplicação."""

    extensions_map = {
        **mimetypes.types_map,
        ".webmanifest": "application/manifest+json",
        ".vtt": "text/vtt",
        ".md": "text/markdown",
    }
    _range_remaining: int | None = None

    def send_head(self):  # noqa: D401 - mantém contrato do SimpleHTTPRequestHandler
        """Envia cabeçalhos e suporta Range requests para mídia."""
        range_header = self.headers.get("Range")
        if not range_header:
            return super().send_head()

        path = self.translate_path(self.path)
        if os.path.isdir(path) or not os.path.isfile(path):
            return super().send_head()

        match = re.fullmatch(r"bytes=(\d*)-(\d*)", range_header.strip())
        if not match:
            self.send_error(416, "Range Not Satisfiable")
            return None

        file_size = os.path.getsize(path)
        start_text, end_text = match.groups()
        if not start_text and not end_text:
            self.send_error(416, "Range Not Satisfiable")
            return None

        if start_text:
            start = int(start_text)
            end = int(end_text) if end_text else file_size - 1
        else:
            suffix_length = int(end_text)
            start = max(file_size - suffix_length, 0)
            end = file_size - 1

        if start >= file_size or end < start:
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{file_size}")
            self.end_headers()
            return None

        end = min(end, file_size - 1)
        file = open(path, "rb")
        file.seek(start)
        self._range_remaining = end - start + 1
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
        self.send_header("Content-Length", str(self._range_remaining))
        self.send_header("Last-Modified", self.date_time_string(os.path.getmtime(path)))
        self.end_headers()
        return file

    def copyfile(self, source, outputfile) -> None:
        if self._range_remaining is None:
            try:
                return super().copyfile(source, outputfile)
            except (BrokenPipeError, ConnectionAbortedError, ConnectionResetError):
                return

        remaining = self._range_remaining
        self._range_remaining = None
        try:
            while remaining > 0:
                chunk = source.read(min(64 * 1024, remaining))
                if not chunk:
                    break
                outputfile.write(chunk)
                remaining -= len(chunk)
        except (BrokenPipeError, ConnectionAbortedError, ConnectionResetError):
            return

    def end_headers(self) -> None:
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Security-Policy", "default-src 'self'; base-uri 'self'; object-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self' blob:; worker-src 'self'; manifest-src 'self'; frame-ancestors 'none'; form-action 'self'")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()")
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        super().end_headers()

    def log_message(self, format_string: str, *args: object) -> None:
        print(f"[{self.log_date_time_string()}] {format_string % args}")


def serve(port: int) -> int:
    if not 1024 <= port <= 65535:
        raise ValueError("a porta deve estar entre 1024 e 65535")
    handler = lambda *args, **kwargs: SecureStaticHandler(*args, directory=str(WEB_ROOT), **kwargs)  # noqa: E731
    server = ThreadingHTTPServer(("127.0.0.1", port), handler)
    print(f"Entrelinhas disponível em http://127.0.0.1:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor encerrado.")
    finally:
        server.server_close()
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    subcommands = parser.add_subparsers(dest="command", required=True)
    subcommands.add_parser("validate", help="valida catálogo, caminhos e transcrições")
    subcommands.add_parser("catalog", help="atualiza o catálogo a partir das mídias locais")
    serve_parser = subcommands.add_parser("serve", help="inicia o servidor local seguro")
    serve_parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    if args.command == "validate":
        return validate()
    if args.command == "catalog":
        return refresh_catalog()
    return serve(args.port)


if __name__ == "__main__":
    raise SystemExit(main())
