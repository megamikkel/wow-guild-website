# Exploration — concept 7 "Who's your PAPI"

Five rounds, ~36 studies, all drawn monochrome first: if the gesture does not
survive as a black silhouette, colour cannot save it.

| Round | Question | Verdict |
| --- | --- | --- |
| 1 | Which sub-direction carries the gesture? | Abstraction (wedge/chevron/arrow) collapses into media-player icons. The beckoning curl reads as a coffee mug. **The gesture needs a hand.** |
| 2 | What proportions? | Outline, gaps and negative-space versions all fail below 32px. Mass is mandatory. A slight tilt turns a pictogram into an attitude. |
| 3 | How far can the tilt go, and can a P hide in it? | −20° makes the thumb a horn. **−14° is the ceiling.** The P-hybrid reads as a hairdryer in both attempts — direction killed. |
| 4 | Wordmark | Crossbar-less **Λ** gives PAPI a signature letterform at no cost to legibility. Hand-as-I reads as a comma — killed. |
| 5 | Why does it look like a bird at small size? | A thumb floating on top of the fist reads as a head with a beak. **Merging the thumb into the fist mass fixes it.** Removing it entirely kills "hand". |

Surviving geometry: compact fist, long index finger, thumb merged into the
fist mass, −14° tilt.

## Round 6 — the register correction

The client's existing mark (a Pepsi trade-dress pastiche) turned out to be the
most useful brief in the project: it revealed the register every previous
round had missed. PAPI does not want cold geometry — it wants **warmth, pop
and instant recognition**: the confidence of a mass-market consumer brand with
PAPI in the middle. Bootleg energy, not a drawn joke.

That register is a genre, not a trademark. Circular badges, saturated
primaries, starbursts, ribbons and chunky wordmarks belong to nobody. The
specific divided globe with the wave belongs to PepsiCo, and is not reusable —
particularly on merchandise.

Studies in this round: seal, lozenge, starburst, racing roundel, app plate,
ribbon badge. The starburst carries the most personality and survives to 22px;
the app plate is the closest bridge from the existing icon.

## Round 7 — generative exploration (`generator.html`)

Every earlier round failed the same way: concepts were produced by *listing*
("objects: ring, chain, arch…"), and a list yields its most obvious members
first. Nine rounds of first guesses are nine rounds of cliché.

This round replaces curation with volume. `generator.html` produces 120 forms
parametrically across six families — rotation (R), interference (I), gesture
(G), subtraction (S), scale-stack (K), fragmentation (A) — from a seeded PRNG,
rendered as one contact sheet in pure monochrome. Selection happens by looking
at all of them, not by pre-filtering for what scales to 24px.

Outcome: families S and K largely failed (parameter ranges too narrow; S
produced near-identical rounded rings, K produced trees and mountains).
Families I, R, G and A produced forms with genuine tension — crescents and
eclipses, curved-arm whirls, tapered ribbons, and sliced discs.

Re-run with a different seed for a fresh set; widen the parameter ranges of a
family to push it further.
