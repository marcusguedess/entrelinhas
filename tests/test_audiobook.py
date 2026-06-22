import importlib.util
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parents[1] / "tools" / "audiobook.py"
SPEC = importlib.util.spec_from_file_location("audiobook", MODULE_PATH)
audiobook = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(audiobook)


class AudiobookToolsTests(unittest.TestCase):
    def test_catalog_is_valid_json_with_unique_ids(self):
        catalog = audiobook.load_catalog()
        ids = [chapter["id"] for chapter in catalog["chapters"]]
        self.assertTrue(ids)
        self.assertEqual(len(ids), len(set(ids)))

    def test_rejects_path_traversal(self):
        with self.assertRaises(ValueError):
            audiobook.resolve_asset("./../segredo.mp3")

    def test_accepts_local_media_path(self):
        path = audiobook.resolve_asset("./audios/01.mp3")
        self.assertEqual(path.name, "01.mp3")

    def test_current_transcript_is_valid(self):
        transcript = audiobook.resolve_asset("./transcripts/secao-01.vtt")
        self.assertEqual(audiobook.validate_vtt(transcript), [])

    def test_markdown_transcript_is_valid(self):
        transcript = audiobook.resolve_asset("./transcripts/1.md")
        self.assertEqual(audiobook.validate_markdown(transcript), [])

    def test_catalog_uses_generated_section_transcripts(self):
        catalog = audiobook.load_catalog()
        transcripts = [chapter["transcript"] for chapter in catalog["chapters"]]
        self.assertEqual(transcripts[0], "./transcripts/secao-01.vtt")
        self.assertTrue(all(path.startswith("./transcripts/secao-") for path in transcripts))

    def test_every_catalog_entry_has_existing_audio_and_transcript(self):
        catalog = audiobook.load_catalog()
        self.assertEqual(len(catalog["chapters"]), 10)
        for chapter in catalog["chapters"]:
            with self.subTest(chapter=chapter["id"]):
                audio = audiobook.resolve_asset(chapter["audio"])
                transcript = audiobook.resolve_asset(chapter["transcript"])
                self.assertTrue(audio.is_file())
                self.assertGreater(audio.stat().st_size, 1_000_000)
                self.assertTrue(transcript.is_file())
                self.assertEqual(audiobook.validate_vtt(transcript), [])
                self.assertGreater(len(transcript.read_text(encoding="utf-8")), 1_000)

    def test_catalog_duration_labels_are_consistent(self):
        catalog = audiobook.load_catalog()
        for chapter in catalog["chapters"]:
            with self.subTest(chapter=chapter["id"]):
                audio = audiobook.resolve_asset(chapter["audio"])
                estimated = round((audio.stat().st_size * 8) / audiobook.BITRATE_BPS)
                self.assertEqual(chapter["durationSeconds"], estimated)
                self.assertEqual(chapter["durationLabel"], audiobook.format_duration(estimated))

    def test_section_one_transcript_is_not_demo_stub(self):
        transcript = audiobook.resolve_asset("./transcripts/secao-01.vtt")
        source = transcript.read_text(encoding="utf-8")
        self.assertIn("Capítulo 5. O agregado.", source)
        self.assertNotIn("Trecho de exemplo", source)


if __name__ == "__main__":
    unittest.main()
