import gzip
import json

import pytest

from app.animation import AnimationUnavailable, decode_tgs, find_tgs_url
from app.db import Database


def test_extracts_public_telegram_tgs_url():
    html = '<source type="application/x-tgsticker" src="https://cdn4.telesco.pe/file/test">'
    assert find_tgs_url(html) == "https://cdn4.telesco.pe/file/test"


def test_rejects_untrusted_host():
    with pytest.raises(AnimationUnavailable):
        find_tgs_url('<source type="application/x-tgsticker" src="https://evil.test/a.tgs">')


def test_decodes_real_tgs_structure():
    document = {"v": "5.5", "layers": [], "w": 512, "h": 512}
    assert decode_tgs(gzip.compress(json.dumps(document).encode())) == document


def test_rejects_invalid_tgs():
    with pytest.raises(AnimationUnavailable):
        decode_tgs(b"not a tgs")


def test_pagination_and_filters_cover_all_indexed_gifts(tmp_path):
    db = Database(str(tmp_path / "gifts.db"))
    db.init(False)
    for n in range(115):
        db.upsert_data({
            "slug": f"samplegift-{n+1}", "collection": "Sample Gift",
            "number": n+1, "owner_name": "Alice", "model": "Model A" if n % 2 else "Model B",
            "model_rarity": 1.0, "backdrop": "Blue", "backdrop_rarity": 2.0,
            "symbol": "Stars", "symbol_rarity": 3.0,
            "center_color": "#0000ff", "edge_color": "#001144",
        })
    assert db.count() == 115
    assert len(db.search(limit=48, offset=0)) == 48
    assert len(db.search(limit=48, offset=96)) == 19
    assert db.count("", {"model": "Model A"}) == 57
    assert db.count("#115") == 1
