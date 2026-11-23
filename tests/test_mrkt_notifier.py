from app.mrkt_notifier import BroadcastStore, normalize, nft_url, format_giveaway


def gift_item(name="Test", identifier="demo123"):
    return normalize({"id": identifier, "ticketPriceNanoTons": 200000000,
                      "participantsCount": 18, "totalTickets": 24,
                      "previewGift": {"collectionName": name},
                      "chanels": ["samplechannel"]}, "Paid")


def test_normalize_and_no_invented_nft():
    item = gift_item()
    assert item["participants"] == 18
    assert item["tickets"] == 24
    assert item["price_ton"] == .2
    assert item["channels"] == ["samplechannel"]
    assert item["nft"] is None
    assert nft_url({"previewGift": {"slug": "PlushPepe-12345"}}) == "https://t.me/nft/PlushPepe-12345"
    assert nft_url({"nftUrl": "https://attacker.test/nft/PlushPepe-12345"}) is None
    assert "18" in format_giveaway(item)


def test_durable_delivery_to_opted_in_subscribers(tmp_path):
    db = str(tmp_path / "scout.db")
    store = BroadcastStore(db)
    store.subscribe(111)
    item = gift_item()
    assert store.insert_feed([item]) == 1
    assert store.pending() == []  # first scan: no notification storm
    other = gift_item(identifier="demo124")
    assert store.insert_feed([item, other]) == 1
    assert [x[0] for x in store.pending()] == [111]
    store.mark_delivered(111, other["key"])
    assert store.pending() == []
    again = BroadcastStore(db)
    assert again.is_active(111)
    assert again.insert_feed([other]) == 0
    again.unsubscribe(111)
    assert not again.is_active(111)
    assert again.count_subscribers() == 0


def test_only_subscribers_receive_future_events(tmp_path):
    store = BroadcastStore(str(tmp_path / "db.sqlite"))
    store.insert_feed([gift_item()])
    store.subscribe(1)
    store.subscribe(2)
    store.unsubscribe(2)
    item = gift_item(identifier="demo125")
    store.insert_feed([item])
    assert [u for u, _ in store.pending()] == [1]
