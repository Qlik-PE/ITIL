# ITIL Command Center Theme

A dark "mission control" Qlik Sense **theme** — not an extension. There's no property panel, no expressions to wire up, and nothing to drag onto a sheet. Once it's applied to an app, the dark green color scheme cascades automatically to native Qlik objects across every sheet: tables, KPI objects, filter panes, listboxes, the sheet canvas grid background, selection bar — all of it picks up the styling without any per-object setup.

![Command Center theme applied to a sheet](./assets/ITIL_Command_Center_Screenshot.png)

The screenshot above shows the theme applied across a full sheet — note that the Qlik chrome itself (top nav bar, sheet title, filter/selection bar) picks up the dark styling, in addition to whatever's sitting on the canvas.

---

## 1. Install the Theme

Themes and extensions are technically different asset types in Qlik, even though the styling looks similar to what the ITIL extensions already use. Same overall idea — this doesn't require anything Cloud-specific, so it works fine on either platform, with slightly different install steps.

### Qlik Cloud

1. Go to **Management Console → Themes**.
2. Click **Add theme** (or **Import**) and upload the theme package zip — keep it zipped, same as an extension.
3. Once uploaded, it's available as a selectable theme option to any app on that tenant/space with permission to use it.

If you're not a tenant admin, hand the zip to whoever manages your Qlik Cloud environment.

### Qlik Sense Enterprise on Windows (QSEoW)

1. Open the **Qlik Management Console (QMC)** and go to **Themes** (a separate node from Extensions).
2. Click **Import**, browse to the theme package zip, and upload.
3. It'll land in the shared themes folder on the server and become available site-wide once the import completes.

## 2. Apply the Theme to an App

Installing it just makes it *available* — you still need to turn it on per app:

1. Open the app.
2. Use the app's **options menu (`...`)** → **Set theme** (in Qlik Cloud, this may live under the app's overview/settings depending on tenant configuration).
3. Select **ITIL Command Center** from the list of available themes.

That's it — every sheet in the app inherits the styling immediately, no per-sheet or per-object toggle needed.

## What Gets Styled

Because this is a theme rather than an extension, the coverage is global rather than object-by-object:

- **Sheet canvas** — background and grid lines
- **Filter panes & listboxes** — background, selected/excluded/possible state colors
- **Native charts and tables** — backgrounds, borders, gridlines, axis text
- **Selection/toolbar bar** — top chrome styling

Custom extensions that already hardcode this same green palette (like the ITIL Incidents, Changes, Problems, and KPI Array extensions) will look visually consistent with the theme by design — but that's coincidence of matching colors, not the theme actually reaching into those extensions. A *different* custom extension with its own hardcoded CSS won't automatically inherit the theme's colors unless it was specifically built to reference Qlik's theme CSS variables.

## Known Limitation

Qlik Cloud writes an explicit inline `border` style onto every native object, which makes true theme-level default borders unresolvable without resorting to `!important` — and doing that tends to break legitimate per-object border overrides elsewhere. If a specific object's border looks like it's ignoring the theme, this is why.

---

## Color Reference

| Swatch | Name | Hex | RGB |
|---|---|---|---|
| 🟢 | Bright Core Highlight | `#06FFB1` | `6, 255, 177` |
| 🟢 | Core / Primary Green | `#00E676` | `0, 230, 118` |
| 🟢 | Mid Green | `#00C853` | `0, 200, 83` |
| 🟢 | Dark Green | `#007A3D` | `0, 122, 61` |
| ⬛ | Deep Background Green | `#001A12` | `0, 26, 18` |
| ⬛ | Card Background | `#040D08` | `4, 13, 8` |
| ⬛ | Quadrant Background | `#020A04` | `2, 10, 4` |

**Status / semantic colors** (used for variance arrows, priority badges, etc.):

| Swatch | Meaning | Hex |
|---|---|---|
| 🔴 | Critical / Negative variance | `#FF3B3B` |
| 🟠 | High | `#FF8C00` |
| 🟡 | Medium | `#FFD700` |
| 🔵 | Low / In Progress | `#4488FF` |
| ⚪ | Planning / Neutral (flat variance) | `#9E9E9E` |

These are the same palette values used across the ITIL extension suite, so a theme-styled sheet and the extensions sitting on it stay visually consistent.
