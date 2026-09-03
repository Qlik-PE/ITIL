# ITILFreshnessSeal

**Version:** 2.0.0
**Type:** Qlik Sense visualization extension
**Author:** QlikDork

A single-purpose tile that displays a data-freshness "seal" image (Gold / Silver / Bronze / Black) plus an optional live-ticking badge showing how stale the data currently is. It's the visual capstone of the [ITIL 5 Service Intelligence Accelerator](../../) pipeline-observability story — the moment someone glances at a dashboard and goes "yep, that's fresh" or "uh oh."

## Design philosophy: this extension has no opinions

Earlier versions of this seal baked in assumptions — a hardcoded media-library path, a `Layer_Tier_Freshness.png` naming convention, even hand-typed Gold/Silver/Bronze hour thresholds duplicated from the app's real SLA table. That's the microwave version, and it bit us: the hardcoded thresholds drifted from the governed SLA table the first time someone updated one and not the other, and the ticker started disagreeing with the native subtitle about what tier we were even in.

v2.0.0 fixes that by making the extension deliberately dumb. It has **zero knowledge** of:
- Image hosting, naming conventions, or URL structure
- SLA tier bands or hour thresholds
- Where "freshness" data comes from (data island, master measure, variable — doesn't care)

It has exactly **three expression properties**. Whatever they resolve to is exactly what gets shown. All governance lives in the app, where it belongs — this extension is just the picture frame.

## Properties

| Property | Type | What it controls |
|---|---|---|
| **Image URL Expression** | string, `expression: always` | Must resolve to the complete, ready-to-use image URL (media library path, CDN, whatever). The extension does zero URL construction. |
| **Tier Expression** | string, `expression: always` | Should evaluate to `Gold`, `Silver`, `Bronze`, or `Black`. Shown only in the live badge, if enabled. |
| **Hours Old Expression** | number, `expression: always` | Hours since last refresh. Also badge-only. |
| **Enable live badge** | boolean switch | Turns on the ticking overlay described below. Off by default. |

Native Title / Subtitle / Footnote are exposed via the standard `uses: settings` panel and rendered by Qlik's own object chrome — this extension doesn't touch them.

## The live badge — what it does and doesn't do

This is the part worth understanding before you go poking at the code.

**What it does:** every `paint()` where the badge is on starts a `setInterval` (60s). Each tick, it takes the browser's own wall clock, computes elapsed time since that `paint()` fired, and adds it to Hours Old. It also refreshes a "Last refreshed [time]" line so you have visible proof the timer is alive — a pulsing CSS dot would keep animating even if the interval silently died, but a timestamp that visibly advances by ~1 minute can only be doing that if the timer genuinely fired.

**What it deliberately does NOT do:** re-derive the Tier, swap the seal image, or call back into the Qlik engine in any way. Since the extension no longer owns the SLA band thresholds (see Design Philosophy above), it has no way to know if a tier boundary has been crossed between real repaints — and it shouldn't guess. Tier and the image only change on an actual Qlik repaint (selection change, reload, manual recalc), at which point `Tier Expression` and `Image URL Expression` get re-evaluated upstream and this extension faithfully displays whatever they say.

So: the badge's numbers drift forward in real time between repaints; the seal itself only ever changes on a genuine repaint. That split is intentional, not a bug.

**Timer hygiene:** every `paint()` clears any previous `_tickTimer` before starting a new one. Qlik can call `paint()` for reasons that have nothing to do with this tile (another object's selection, a scheduled reload), so without the clear, one tile would quietly accumulate duplicate intervals over its lifetime. `_tickTimer` is instance-scoped (`self._tickTimer`), so multiple copies of this extension on the same sheet never step on each other.

## Sizing

The image is centered in its tile with `object-fit: contain` — it always shrinks or grows to fit the container without ever overflowing, getting cropped, or having its aspect ratio distorted. Pure CSS, no resize listener required.

## Example expressions (app-side)

These live in *your* app, not in the extension. A rough sketch, using the Pipeline Pulse SLA banding pattern:

```
Tier Expression:
=Pick(Match($(vCurrentTier), 'Gold','Silver','Bronze','Black'), 'Gold','Silver','Bronze','Black')

Hours Old Expression:
=(Now() - Max(LastRefreshTimestamp)) * 24

Image URL Expression:
='https://your-tenant.us.qlikcloud.com/api/v1/apps/' & AppID() &
  '/media/files/seals/' & $(vCurrentTier) & '.png'
```

The point is: however you build these, this extension never needs to know.

## Support flags

`snapshot: true`, `export: true`, `exportData: false` — it's a picture, not a data table, so there's nothing to export as data.

## Installation

Standard Qlik Sense Cloud custom-extension install:
1. Zip `ITILFreshnessSeal.js` + `ITILFreshnessSeal.qext` together
2. Upload via the Management Console → Extensions (or the app's extension upload if using dev-hub style loading)
3. Add to a sheet like any other visualization, wire up the three expressions, flip the badge switch if you want it

## Version history

- **2.0.0** — Removed all hardcoded image-path/naming assumptions and the duplicated Gold/Silver/Bronze/Black hour-threshold properties. Tier is now single-sourced from the app's governed expression only. This is the breaking, governance-correcting rewrite.
- **1.x** — Original version with baked-in tenant-specific path and locally duplicated SLA thresholds (deprecated — thresholds drifted from the real SLA table, causing tier disagreement between the ticker and native subtitle).
