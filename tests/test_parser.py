from pathlib import Path

from app.parser import normalize_slug, parse_gift_html


HTML = """
<meta property="og:title" content="Record Player #25016">
<meta property="og:image" content="https://example.com/gift.jpg">
<svg><radialGradient id="giftGradient"><stop stop-color="#45b8ed"></stop><stop stop-color="#3886d9"></stop></radialGradient></svg>
<table class="tgme_gift_table"><tbody>
<tr><th>Owner</th><td><span>Denis</span></td></tr>
<tr><th>Model</th><td>Mr. Orange <mark>1.5%</mark></td></tr>
<tr><th>Backdrop</th><td>Celtic Blue <mark>1.5%</mark></td></tr>
<tr><th>Symbol</th><td>Ghost <mark>0.5%</mark></td></tr>
<tr><th>Quantity</th><td>35 457/46 888 issued</td></tr>
</tbody></table>
"""


def test_normalize_slug():
    assert normalize_slug("https://t.me/nft/RecordPlayer-25016") == "recordplayer-25016"


def test_parse_gift_html():
    gift = parse_gift_html(HTML, "recordplayer-25016")
    assert gift.collection == "Record Player"
    assert gift.number == 25016
    assert gift.owner_name == "Denis"
    assert gift.model == "Mr. Orange"
    assert gift.symbol_rarity == .5
    assert gift.issued == 35457
    assert gift.total == 46888
    assert gift.center_color == "#45b8ed"

