# Username economy v5

## Goal

Make a username feel like a scarce address rather than a generic rarity drop. The player should immediately understand why a short clean name is valuable and why a meaningful longer word can beat random noise.

Market references:

- Telegram documents collectible usernames as transferable TON-secured addresses sold through Fragment: https://telegram.org/blog/topics-in-groups-collectible-usernames
- Telegram's FAQ documents the allowed character set and permanent ownership of collectible usernames: https://telegram.org/faq#usernames-and-t-me
- Public on-chain market research shows four-character names are a tiny share of sales but account for a disproportionate share of volume: https://namesniper.pro/research

## Valuation model

The base curve is set by length, then multiplied by meaning/readability and cleanliness:

| Length | Base value |
| --- | ---: |
| 3 | $36,000,000 |
| 4 | $9,000,000 |
| 5 | $1,850,000 |
| 6 | $720,000 |
| 7 | $300,000 |
| 8 | $125,000 |
| 9 | $58,000 |
| 10 | $28,000 |

- Exact dictionary/root words receive the full semantic multiplier.
- Pronounceable or recognizable constructions receive a partial multiplier.
- Digits reduce value, except memorable endings such as `77`, `777`, and `007`.
- Underscores reduce value.
- Any valid four-character handle has a hard floor: $2.6M without digits and $2.1M with digits.
- The five known three-character legacy handles (`nft`, `gif`, `pic`, `vid`, `ufc`) are finite ULTRA specials and are never generated randomly.
- A deterministic ±4% jitter prevents identical-looking bands while keeping server restarts stable.

These numbers are live balance hypotheses and must be reviewed after real player-market data is available. A broken state is defined as either paid-drop salvage EV reaching the drop cost or four-character drops exceeding 0.1% in simulation.

## Upgrader mechanic

Purpose: create a clear, inspectable risk decision with a meaningful currency sink.

- Input: exactly one owned non-ULTRA username.
- Output: one preselected higher-rarity username on success; the source is consumed in both outcomes.
- Displayed and server chance: `clamp(0.90 × source value / target value, 1%, 75%)`.
- The filled circle sector is the exact server chance.
- The server resolves first; the pointer then lands inside the matching win or loss sector.
- Preview sessions are fixed for ten minutes, so reopening the same selection cannot reroll the target.
- Failure state: the source is consumed and no target is granted.

## Migration and tuning

Migration `4.4.0-fragment-value-model` revalues every existing template, active instance, and drop-history row. Marketplace listing prices remain player-authored and are not overwritten.

Tuning levers: length bases, quality multipliers, special prices, digit/underscore penalties, upgrader house factor, chance cap, and rarity thresholds.
