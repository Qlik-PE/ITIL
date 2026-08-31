/*
 * ITILFreshnessSeal.js
 * Version: 2.0.0
 *
 * Displays a data-freshness seal image, sized to always fit its tile
 * without ever overflowing it, plus an optional live badge.
 *
 * DESIGN NOTES (read before modifying):
 *
 * 1) NO qHyperCubeDef / no 'data' section on purpose. Every value this
 *    extension needs is supplied via expression props using
 *    expression:'always', which means Qlik hands paint() the
 *    already-EVALUATED number/string in layout.props.* directly. paint()
 *    never needs app.evaluate() / enigmaModel.evaluate() at all, which
 *    sidesteps the entire class of async-inside-paint() problems (debounce
 *    timers, infinite paint() loops, captured appRef staleness).
 *
 * 2) THE EXTENSION DOES NOT KNOW OR ASSUME ANYTHING ABOUT IMAGE NAMING,
 *    HOSTING, OR URL STRUCTURE. Earlier versions built the image URL
 *    inside this JS file (a specific /api/v1/apps/.../media/files/ path
 *    plus a Layer_Tier_Freshness.png naming convention) -- that baked one
 *    tenant's specific setup into the extension itself, which breaks the
 *    moment this is used in a different app or tenant with different
 *    naming. Now there is exactly ONE image-related property -- Image URL
 *    Expression -- and it must resolve to the complete, ready-to-use URL.
 *    However that URL gets built (media library path, external CDN,
 *    whatever) is entirely the app author's business, expressed in Qlik
 *    expression/variable language, not in this extension's code.
 *
 * 3) SIMILARLY, THERE IS NO "MAX HOURS" CONFIGURATION HERE ANYMORE. An
 *    earlier version had Gold/Silver/Bronze Max Hours as separate
 *    hand-typed properties so the live ticker could keep re-deriving the
 *    tier locally between real repaints. That was a governance mistake:
 *    those numbers are a SECOND, disconnected copy of the same bands
 *    already governed in the app's own SLA table, and the two copies WILL
 *    eventually disagree the moment someone edits one without the other
 *    (this is exactly what happened -- band values got retyped here,
 *    drifted from the real SLA table, and the ticker started showing a
 *    different tier than the native subtitle). The fix is to not let this
 *    extension have an opinion about tier bands at all. Tier Expression is
 *    the ONLY source of truth for which tier is currently shown, full stop.
 *
 * 4) WHAT THIS MEANS FOR THE LIVE TICKER: since the extension no longer
 *    has band boundaries to check, it cannot detect a tier crossing on its
 *    own anymore, and therefore cannot swap the image or the tier label
 *    between real Qlik repaints. What it CAN still safely do with pure
 *    browser-clock arithmetic (no call back into Qlik) is keep the
 *    "hours old" number and "last refreshed" timestamp advancing live in
 *    the badge. The tier text and the image itself only change on a real
 *    repaint -- which is correct: the moment the tier actually changes,
 *    Tier Expression and Image URL Expression will both be re-evaluated
 *    by Qlik and this extension will faithfully display whatever they say.
 *
 * 5) Native Title / Subtitle / Footnote (via 'uses: settings' in the
 *    property panel) are rendered by QLIK'S OWN OBJECT CHROME, which lives
 *    OUTSIDE $element. This extension's JS can only ever read/write inside
 *    its own $element -- so the live badge below is a separate, small
 *    overlay on the image, not an attempt to rewrite the native Subtitle.
 *
 * 6) TICKER SAFETY: every paint() that runs with showTicker=true starts a
 *    fresh setInterval. Because Qlik can call paint() again for reasons
 *    unrelated to this tile (a filter click elsewhere on the sheet, a
 *    scheduled reload, etc.), the PREVIOUS timer must be cleared first --
 *    otherwise this one tile quietly accumulates duplicate timers over
 *    time. self._tickTimer is private to THIS instance; it cannot affect
 *    or be affected by any other copy of this extension on the same sheet.
 */

define(['qlik', 'jquery'], function (qlik, $) {
  'use strict';

  var STYLE_ID = 'qd-freshnessseal-styles-v2';
  if (!document.getElementById(STYLE_ID)) {
    var styleTag = document.createElement('style');
    styleTag.id = STYLE_ID;
    styleTag.innerHTML = [
      '.qd-fs-wrap {',
      '  position: relative;',
      '  width: 100%;',
      '  height: 100%;',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  overflow: hidden;',
      '  box-sizing: border-box;',
      '}',
      '.qd-fs-img {',
      '  max-width: 100%;',
      '  max-height: 100%;',
      '  width: auto;',
      '  height: auto;',
      '  object-fit: contain;',
      '  display: block;',
      '}',
      '.qd-fs-live {',
      '  position: absolute;',
      '  bottom: 6px;',
      '  right: 8px;',
      '  display: flex;',
      '  flex-direction: column;',
      '  align-items: flex-end;',
      '  gap: 1px;',
      '  background: rgba(0,0,0,0.6);',
      '  color: #fff;',
      '  font-size: 11px;',
      '  font-family: sans-serif;',
      '  padding: 4px 9px;',
      '  border-radius: 10px;',
      '  line-height: 1.4;',
      '  white-space: nowrap;',
      '}',
      '.qd-fs-live-status {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 6px;',
      '  font-weight: 600;',
      '}',
      '.qd-fs-dot {',
      '  width: 7px;',
      '  height: 7px;',
      '  border-radius: 50%;',
      '  background: #06FFB1;',
      '  flex: 0 0 auto;',
      '  animation: qd-fs-pulse 1.6s ease-in-out infinite;',
      '}',
      '.qd-fs-live-refreshed {',
      '  font-size: 10px;',
      '  opacity: 0.75;',
      '}',
      '@keyframes qd-fs-pulse {',
      '  0%   { opacity: 1; }',
      '  50%  { opacity: 0.25; }',
      '  100% { opacity: 1; }',
      '}'
    ].join('\n');
    document.head.appendChild(styleTag);
  }

  // Formats the moment of a tick as a local wall-clock time string. This is
  // the actual PROOF the ticker is alive -- unlike a pulsing dot (which
  // would keep animating via pure CSS even if the timer silently died),
  // a timestamp that visibly advances by ~1 minute each tick can only be
  // showing that if the timer genuinely fired.
  function formatRefreshedAt(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  return {

    initialProperties: {
      props: {
        imageUrlExpr: "=''",
        tierExpr: "='Gold'",
        hoursOldExpr: '=0',
        showTicker: false
      }
    },

    definition: {
      type: 'items',
      component: 'accordion',
      items: {

        freshnessSeal: {
          type: 'items',
          label: 'Freshness Seal',
          items: {

            introLabel: {
              type: 'items',
              component: 'text',
              label: 'Point every expression field below at whatever governed variable or ' +
                'master measure your app uses to compute freshness -- this extension has ' +
                'no knowledge of Stage/Practice/SLA tables, image naming, or hosting paths. ' +
                'It only displays exactly what these expressions resolve to. That keeps it ' +
                'portable across apps and tenants.'
            },

            imageUrlExpr: {
              ref: 'props.imageUrlExpr',
              label: 'Image URL Expression (must resolve to the complete, ready-to-use image URL)',
              type: 'string',
              expression: 'always',
              defaultValue: "=''"
            },

            tierExpr: {
              ref: 'props.tierExpr',
              label: 'Tier Expression (evaluates to Gold, Silver, Bronze, or Black -- shown in the live badge only, if enabled)',
              type: 'string',
              expression: 'always',
              defaultValue: "='Gold'"
            },

            hoursOldExpr: {
              ref: 'props.hoursOldExpr',
              label: 'Hours Old Expression (evaluates to hours since last refresh -- shown in the live badge only, if enabled)',
              type: 'number',
              expression: 'always',
              defaultValue: '=0'
            },

            showTicker: {
              ref: 'props.showTicker',
              label: 'Enable live badge (Hours Old and Last Refreshed keep advancing every 60 seconds using the browser\u2019s own clock; Tier and the image itself only change on a real Qlik repaint)',
              type: 'boolean',
              component: 'switch',
              defaultValue: false,
              options: [
                { value: true, label: 'On' },
                { value: false, label: 'Off' }
              ]
            }

          }
        },

        settings: {
          uses: 'settings'
        }
      }
    },

    support: {
      snapshot: true,
      export: true,
      exportData: false
    },

    paint: function ($element, layout) {
      var self = this;

      // ---- Every value here is exactly what the app's own governed -------
      // ---- expressions resolved to. This extension makes no assumptions --
      // ---- and re-derives nothing. -----------------------------------------
      var imageUrl   = String(layout.props.imageUrlExpr || '');
      var tier       = String(layout.props.tierExpr || '');
      var hoursOld   = Number(layout.props.hoursOldExpr) || 0;
      var showTicker = !!layout.props.showTicker;

      // ---- Always clear any previous ticker before doing anything else. --
      // ---- See design note (6) at the top of this file. -------------------
      if (self._tickTimer) {
        clearInterval(self._tickTimer);
        self._tickTimer = null;
      }

      var initialRefreshedAt = formatRefreshedAt(new Date());

      // ---- Image is centered and scaled with object-fit:contain, so it ---
      // ---- always fits the tile (shrinks or grows with it) without ever --
      // ---- overflowing or being cropped, and never distorts the seal's --
      // ---- aspect ratio. Pure CSS -- no resize listener needed. ----------
      var html = '<div class="qd-fs-wrap">' +
                   (imageUrl ?
                     '<img class="qd-fs-img" src="' + imageUrl + '" alt="' + tier + ' freshness seal" />'
                   : '') +
                   (showTicker ?
                     '<div class="qd-fs-live">' +
                       '<span class="qd-fs-live-status"><span class="qd-fs-dot"></span>' +
                         '<span class="qd-fs-live-text">' + tier + ' \u00b7 ' + hoursOld.toFixed(1) + 'h</span></span>' +
                       '<span class="qd-fs-live-refreshed">Last refreshed ' + initialRefreshedAt + '</span>' +
                     '</div>'
                   : '') +
                 '</div>';

      $element.html(html);

      if (!showTicker) {
        // Static tile: nothing further happens until Qlik genuinely
        // repaints this object (selection change, reload, manual recalc).
        return;
      }

      // ---- Live badge. Captures this paint's moment as a baseline, then --
      // ---- every 60 seconds adds however much real time has passed (per --
      // ---- the BROWSER's own clock) to hoursOld and refreshes the ---------
      // ---- "Last refreshed" timestamp. It does NOT re-derive Tier or ------
      // ---- rebuild the image URL -- see design notes (3) and (4). Tier ---
      // ---- and the image only ever change on a genuine Qlik repaint, ----
      // ---- when Tier Expression / Image URL Expression are re-evaluated --
      // ---- upstream by whatever governs them. Never calls back into ------
      // ---- Qlik here -- pure arithmetic plus DOM writes, scoped entirely -
      // ---- to this tile's own $element. ------------------------------------
      var captureTime = Date.now();
      var $liveText = $element.find('.qd-fs-live-text');
      var $refreshedText = $element.find('.qd-fs-live-refreshed');

      self._tickTimer = setInterval(function () {
        var now = new Date();
        var elapsedHours = (now.getTime() - captureTime) / 3600000;
        var currentHoursOld = hoursOld + elapsedHours;

        if ($liveText.length) {
          // Tier text is intentionally left unchanged here -- it stays
          // whatever Tier Expression last resolved to, until a real repaint.
          $liveText.text(tier + ' \u00b7 ' + currentHoursOld.toFixed(1) + 'h');
        }
        if ($refreshedText.length) {
          // This line changing by ~1 minute each tick is the visible proof
          // the ticker actually ran -- not just decorative motion.
          $refreshedText.text('Last refreshed ' + formatRefreshedAt(now));
        }
      }, 60000);
    }

  };
});
