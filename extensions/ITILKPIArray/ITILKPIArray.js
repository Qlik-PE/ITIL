/*
 * ITIL KPI Array
 * QlikDork Service Intelligence Suite
 *
 * VERSION: 1.2.0
 * CHANGELOG:
 *   1.0.0 - Initial build. Repeatable KPI slot array, tag-filtered master
 *           measure dropdown (per-slot category: Incident/Change/Problem/
 *           Custom), current-vs-previous comparison, paginated vertical
 *           stack with side position track, optional auto-rotate.
 *   1.0.1 - Fixed measureId/customExpr fields not rendering in the property
 *           panel: their conditional show functions were being silently
 *           swallowed inside the array-item context, hiding both fields
 *           regardless of category. Removed the show conditionals - both
 *           fields now always render, clearly labeled which one is active
 *           for the current Category setting. paint() logic already knew
 *           to read the right one, so this is a property-panel-only fix.
 *   1.0.2 - Root cause found: 'qlik' was used as a bare global instead of
 *           an AMD dependency, throwing a ReferenceError at the top of
 *           paint() (blank canvas) and inside the measure dropdown's
 *           options function (field silently dropped from panel). Added
 *           'qlik' to the define() dependency list. Also: current-value
 *           expression field now works as a fallback regardless of
 *           Category (not just when Category = Custom), and the measure
 *           options function now try/catches so a future failure shows
 *           an error message in the dropdown instead of deleting the
 *           field.
 *   1.0.3 - Fixed percentage display bug: ratio-based master measures
 *           (e.g. 0.98 formatted as "98.0%" by Qlik) were being shown as
 *           "1%" because the extension manually appended a "%" suffix to
 *           the raw qNum instead of respecting the measure's own number
 *           format. Now uses qText (Qlik's pre-formatted display string)
 *           for current/previous values, and detects percent formatting
 *           from qText to scale the delta arrow correctly instead of
 *           guessing based on the unit suffix property.
 *   1.1.0 - Removed Category and the tag-filtered master measure dropdown
 *           entirely, per explicit request. There is no Qlik syntax for
 *           referencing a master measure by name inside a typed expression
 *           (square brackets mean field, not measure) - the tag-filtered
 *           dropdown existed specifically to avoid that trap by picking
 *           the qLibraryId directly, but it wasn't populating reliably,
 *           so it's gone. Every slot now has exactly one input for its
 *           current value: a plain expression field. To use a master
 *           measure, paste its actual underlying formula text (open the
 *           measure in the app and copy its expression), not the
 *           measure's name.
 *           CORRECTION (post-release): referencing a master measure by
 *           name in brackets, e.g. =[INC: Total Open Incidents], IS valid
 *           Qlik syntax and does work - confirmed directly against a
 *           working panel. The 1.0.x display bug was a number-format
 *           inheritance inconsistency, not an invalid-reference problem.
 *   1.1.1 - Unit suffix now acts as an explicit override: if the suffix
 *           field is set to a value containing "%" but the referenced
 *           measure's qText isn't already percent-formatted (i.e. the
 *           source expression doesn't wrap itself in Num(...,'0.0%')),
 *           the extension multiplies the raw value by 100 and appends %
 *           itself rather than trusting qText unconditionally. Also
 *           removed the four hardcoded default KPI slots - this
 *           extension is reused across separate Incident/Change/Problem
 *           instances, so it now ships with an empty slot array and lets
 *           each instance's own property panel configuration drive it.
 *   1.2.0 - Added a third optional expression per slot: Overall value
 *           (lifetime/no date filter). Each row now shows four labeled
 *           stat blocks side by side - Overall, Current, Previous,
 *           Variance - instead of the old compact single-line-plus-
 *           corner-PREV layout. A faint vertical divider separates
 *           Overall from the Current/Previous/Variance trio, since
 *           Variance is the delta between Current and Previous only and
 *           should not be visually implied to relate to Overall. Overall
 *           and Previous both render as an em dash when their expression
 *           field is left blank, rather than falling back to 0.
 */
define(['jquery', 'qlik'], function ($, qlik) {
  'use strict';

  var C = {
    bright: '#06FFB1',
    core: '#00E676',
    mid: '#00C853',
    dark: '#007A3D',
    deepBg: '#001A12',
    cardBg: '#040d08',
    trackBg: '#0a1f14',
    railBg: '#0a3320',
    label: '#5fa98a',
    labelDim: '#3f7a5f',
    down: '#ff5c5c'
  };

  var STYLE_ID = 'qd-kpiarray-styles';
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.innerHTML =
      '.qd-kpi-root{background:' + C.cardBg + ';border:0.5px solid ' + C.railBg + ';border-radius:8px;' +
      'padding:12px 12px 12px 14px;display:flex;gap:12px;height:100%;box-sizing:border-box;font-family:Arial,sans-serif;overflow:hidden;}' +
      '.qd-kpi-col{flex:1;display:flex;flex-direction:column;justify-content:space-between;min-width:0;}' +
      '.qd-kpi-row{display:flex;flex-direction:column;padding:10px 0;border-bottom:0.5px solid ' + C.railBg + ';}' +
      '.qd-kpi-row:last-child{border-bottom:none;}' +
      '.qd-kpi-label{font-size:11px;color:' + C.label + ';letter-spacing:0.06em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:8px;}' +
      '.qd-kpi-stats{display:flex;align-items:stretch;gap:22px;}' +
      '.qd-kpi-stat{text-align:center;min-width:64px;}' +
      '.qd-kpi-stat-value{font-family:"Courier New",monospace;font-weight:bold;color:' + C.bright + ';line-height:1.2;white-space:nowrap;}' +
      '.qd-kpi-stat-caption{font-size:9px;color:' + C.labelDim + ';letter-spacing:0.06em;text-transform:uppercase;margin-top:4px;}' +
      '.qd-kpi-divider{width:1px;background:' + C.railBg + ';opacity:0.7;align-self:stretch;min-height:32px;}' +
      '.qd-kpi-stat-value.up{color:' + C.core + ';}' +
      '.qd-kpi-stat-value.down{color:' + C.down + ';}' +
      '.qd-kpi-stat-value.flat{color:' + C.labelDim + ';}' +
      '.qd-kpi-track-col{display:flex;flex-direction:column;align-items:center;gap:5px;flex-shrink:0;width:20px;}' +
      '.qd-kpi-chev{cursor:pointer;color:' + C.label + ';font-size:12px;line-height:1;user-select:none;padding:2px;}' +
      '.qd-kpi-chev.disabled{color:' + C.railBg + ';cursor:default;}' +
      '.qd-kpi-track{flex:1;width:4px;background:' + C.trackBg + ';border-radius:2px;position:relative;min-height:40px;}' +
      '.qd-kpi-track-fill{position:absolute;left:0;width:100%;background:' + C.bright + ';border-radius:2px;}' +
      '.qd-kpi-pageLabel{font-family:"Courier New",monospace;font-size:9px;color:' + C.labelDim + ';writing-mode:vertical-rl;text-orientation:mixed;white-space:nowrap;}' +
      '.qd-kpi-empty{color:' + C.labelDim + ';font-size:12px;padding:8px;}';
    document.head.appendChild(s);
  }

  function extractExpressionText(value) {
    if (value == null) return '';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    if (value.qStringExpression && value.qStringExpression.qExpr) return value.qStringExpression.qExpr;
    if (value.qValueExpression && value.qValueExpression.qExpr) return value.qValueExpression.qExpr;
    if (value.qExpr) return value.qExpr;
    if (value.qDef) return value.qDef;
    return '';
  }

  function safeNum(n) {
    if (n === undefined || n === null) return null;
    if (n === Number.POSITIVE_INFINITY || n === Number.NEGATIVE_INFINITY) return null;
    if (n === 1e308 || n === -1e308) return null;
    if (isNaN(n)) return null;
    return n;
  }

  function fmt(n, unit) {
    if (n === null) return '—';
    var rounded = Math.abs(n) >= 100 ? Math.round(n) : Math.round(n * 10) / 10;
    return rounded + (unit || '');
  }

  

  var definition = {
    type: 'items',
    component: 'accordion',
    items: {
      settings: {
        uses: 'settings',
        items: {
          general: {
            type: 'items',
            label: 'Panel',
            items: {
              panelTitle: {
                ref: 'props.panelTitle', label: 'Panel Title', type: 'string',
                defaultValue: 'INCIDENTS', expression: 'none'
              },
              keyword: {
                ref: 'props.keyword', label: 'Badge Text', type: 'string',
                defaultValue: 'ITIL', expression: 'none'
              },
              itemsPerPage: {
                ref: 'props.itemsPerPage', label: 'KPIs Per Page', type: 'integer',
                defaultValue: 4, min: 1, max: 10
              },
              autoRotate: {
                ref: 'props.autoRotate', label: 'Auto-Rotate Pages', type: 'boolean',
                defaultValue: true
              },
              rotateSeconds: {
                ref: 'props.rotateSeconds', label: 'Rotate Interval (seconds)', type: 'integer',
                defaultValue: 8, min: 3, max: 60,
                show: function (data) { return !!data.props.autoRotate; }
              }
            }
          },
          kpiSlots: {
            type: 'array',
            ref: 'props.kpiSlots',
            label: 'KPI Slots',
            itemTitleRef: 'label',
            allowAdd: true,
            allowRemove: true,
            allowMove: true,
            addTranslation: 'Add KPI slot',
            items: {
              label: {
                ref: 'label', label: 'Display label', type: 'string',
                defaultValue: 'New KPI', expression: 'none'
              },
              overallExpr: {
                ref: 'overallExpr', label: 'Overall value expression (optional, lifetime/no date filter)',
                type: 'string', expression: 'optional', defaultValue: ''
              },
              customExpr: {
                ref: 'customExpr', label: 'Current value expression',
                type: 'string', expression: 'optional', defaultValue: ''
              },
              previousExpr: {
                ref: 'previousExpr', label: 'Previous value expression (optional)', type: 'string',
                expression: 'optional', defaultValue: ''
              },
              unit: {
                ref: 'unit', label: 'Unit suffix (e.g. %, h)', type: 'string',
                defaultValue: '', expression: 'none'
              },
              higherIsBetter: {
                ref: 'higherIsBetter', label: 'Higher value = improvement', type: 'boolean',
                defaultValue: true
              }
            }
          }
        }
      }
    }
  };

  return {
    definition: definition,
    initialProperties: {
      qHyperCubeDef: { qDimensions: [], qMeasures: [], qInitialDataFetch: [{ qWidth: 0, qHeight: 0 }] },
      showTitles: false,
      props: {
        panelTitle: 'INCIDENTS',
        keyword: 'ITIL',
        itemsPerPage: 4,
        autoRotate: true,
        rotateSeconds: 8,
        kpiSlots: []
      }
    },
    support: { snapshot: true, export: true, exportData: false },

    paint: function ($element, layout) {
      var self = this;
      injectStyles();
      var appRef = qlik.currApp(self); // MUST be synchronous, before any async call

      return self.backendApi.model.getProperties().then(function (rawProps) {
        var rawSlots = (rawProps.props && rawProps.props.kpiSlots) || [];
        var slots = (layout.props.kpiSlots || []).map(function (slot, idx) {
          var raw = rawSlots[idx] || {};
          return {
            label: slot.label,
            overallExprRaw: extractExpressionText(raw.overallExpr),
            customExprRaw: extractExpressionText(raw.customExpr),
            previousExprRaw: extractExpressionText(raw.previousExpr),
            unit: slot.unit,
            higherIsBetter: slot.higherIsBetter !== false
          };
        });

        if (!slots.length) {
          $element.html('<div class="qd-kpi-root"><div class="qd-kpi-empty">No KPI slots configured. Add one in the property panel.</div></div>');
          return;
        }

        // Build/cache a dimensionless session cube covering ALL slots so
        // pagination never needs a re-fetch. Column layout per slot:
        // [current, previous?, overall?] - previous/overall only present
        // if an expression was given for them.
        var qMeasures = [];
        var colMap = []; // { current: idx, previous: idx|null, overall: idx|null }
        slots.forEach(function (slot) {
          var currentIdx = qMeasures.length;
          qMeasures.push({ qDef: { qDef: slot.customExprRaw || '0' } });
          var previousIdx = null;
          if (slot.previousExprRaw) {
            previousIdx = qMeasures.length;
            qMeasures.push({ qDef: { qDef: slot.previousExprRaw } });
          }
          var overallIdx = null;
          if (slot.overallExprRaw) {
            overallIdx = qMeasures.length;
            qMeasures.push({ qDef: { qDef: slot.overallExprRaw } });
          }
          colMap.push({ current: currentIdx, previous: previousIdx, overall: overallIdx });
        });

        var exprKey = JSON.stringify(qMeasures);
        var cubePromise;
        if (self._kpiExprKey === exprKey && self._kpiCubeObj) {
          cubePromise = Promise.resolve(self._kpiCubeObj);
        } else {
          if (self._kpiCubeObj) {
            try { appRef.model.enigmaModel.destroySessionObject(self._kpiCubeObj.id); } catch (e) {}
            self._kpiCubeObj = null;
          }
          self._kpiExprKey = exprKey;
          cubePromise = appRef.model.enigmaModel.createSessionObject({
            qInfo: { qType: 'ITILKPIArrayCube' },
            qHyperCubeDef: {
              qDimensions: [],
              qMeasures: qMeasures,
              qInitialDataFetch: [{ qWidth: qMeasures.length, qHeight: 1 }],
              qSuppressMissing: false,
              qSuppressZero: false
            }
          }).then(function (obj) { self._kpiCubeObj = obj; return obj; });
        }

        return cubePromise.then(function (cubeObj) {
          return cubeObj.getLayout().then(function (cubeLayout) {
            var pages = cubeLayout.qHyperCube.qDataPages;
            var row = (pages && pages[0] && pages[0].qMatrix && pages[0].qMatrix[0]) || [];

            slots.forEach(function (slot, i) {
              var map = colMap[i];
              slot.current = row[map.current] ? safeNum(row[map.current].qNum) : null;
              slot.previous = map.previous !== null && row[map.previous] ? safeNum(row[map.previous].qNum) : null;
              slot.overall = map.overall !== null && row[map.overall] ? safeNum(row[map.overall].qNum) : null;
              slot.currentText = row[map.current] ? row[map.current].qText : null;
              slot.previousText = map.previous !== null && row[map.previous] ? row[map.previous].qText : null;
              slot.overallText = map.overall !== null && row[map.overall] ? row[map.overall].qText : null;
              slot.hasOverall = !!slot.overallExprRaw;
            });

            render(slots);
          });
        });

        function render(slots) {
          var itemsPerPage = layout.props.itemsPerPage || 4;
          var totalPages = Math.max(1, Math.ceil(slots.length / itemsPerPage));
          if (self._kpiPage === undefined) self._kpiPage = 0;
          if (self._kpiPage >= totalPages) self._kpiPage = totalPages - 1;
          if (self._kpiPage < 0) self._kpiPage = 0;
          var page = self._kpiPage;

          var start = page * itemsPerPage;
          var end = Math.min(start + itemsPerPage, slots.length);
          var visible = slots.slice(start, end);

          var rowsHtml = visible.map(function (slot) {
            var qTextIsPercent = !!(slot.currentText && slot.currentText.indexOf('%') > -1);
            var unitWantsPercent = (slot.unit || '').indexOf('%') > -1;
            var isPercent = qTextIsPercent || unitWantsPercent;
            var valFontSize = itemsPerPage <= 4 ? '20px' : '15px';

            function displayFor(num, text) {
              if (qTextIsPercent && text != null) return text;
              if (unitWantsPercent && num !== null) return fmt(num * 100, '%');
              return text != null ? text : fmt(num, slot.unit);
            }

            var overallStr = slot.hasOverall ? displayFor(slot.overall, slot.overallText) : '\u2014';
            var currentStr = displayFor(slot.current, slot.currentText);
            var previousStr = slot.previousExprRaw ? displayFor(slot.previous, slot.previousText) : '\u2014';

            var varianceStr = '\u2014';
            var varianceCls = '';
            if (slot.previous !== null && slot.current !== null) {
              var delta = slot.current - slot.previous;
              var improved = slot.higherIsBetter ? delta > 0 : delta < 0;
              var flat = Math.abs(delta) < 0.0001;
              varianceCls = flat ? 'flat' : (improved ? 'up' : 'down');
              var arrow = flat ? '\u2192' : (delta > 0 ? '\u25B2' : '\u25BC');
              varianceStr = arrow + ' ' + (isPercent ? fmt(Math.abs(delta) * 100, '%') : fmt(Math.abs(delta), slot.unit));
            }

            return (
              '<div class="qd-kpi-row">' +
                '<div class="qd-kpi-label">' + escapeHtml(slot.label) + '</div>' +
                '<div class="qd-kpi-stats">' +
                  '<div class="qd-kpi-stat">' +
                    '<div class="qd-kpi-stat-value" style="font-size:' + valFontSize + ';">' + overallStr + '</div>' +
                    '<div class="qd-kpi-stat-caption">Overall</div>' +
                  '</div>' +
                  '<div class="qd-kpi-divider"></div>' +
                  '<div class="qd-kpi-stat">' +
                    '<div class="qd-kpi-stat-value" style="font-size:' + valFontSize + ';">' + currentStr + '</div>' +
                    '<div class="qd-kpi-stat-caption">Current</div>' +
                  '</div>' +
                  '<div class="qd-kpi-stat">' +
                    '<div class="qd-kpi-stat-value" style="font-size:' + valFontSize + ';">' + previousStr + '</div>' +
                    '<div class="qd-kpi-stat-caption">Previous</div>' +
                  '</div>' +
                  '<div class="qd-kpi-stat">' +
                    '<div class="qd-kpi-stat-value ' + varianceCls + '" style="font-size:' + valFontSize + ';">' + varianceStr + '</div>' +
                    '<div class="qd-kpi-stat-caption">Variance</div>' +
                  '</div>' +
                '</div>' +
              '</div>'
            );
          }).join('');

          var fillPct = 100 * (end - start) / slots.length;
          var fillTopPct = 100 * start / slots.length;
          var upDisabled = page === 0;
          var downDisabled = page >= totalPages - 1;

          var html =
            '<div class="qd-kpi-root">' +
              '<div class="qd-kpi-col">' + rowsHtml + '</div>' +
              '<div class="qd-kpi-track-col">' +
                '<div class="qd-kpi-chev qd-kpi-up ' + (upDisabled ? 'disabled' : '') + '">&#9650;</div>' +
                '<div class="qd-kpi-track"><div class="qd-kpi-track-fill" style="top:' + fillTopPct + '%;height:' + fillPct + '%;"></div></div>' +
                '<div class="qd-kpi-chev qd-kpi-down ' + (downDisabled ? 'disabled' : '') + '">&#9660;</div>' +
                '<div class="qd-kpi-pageLabel">' + (start + 1) + '-' + end + ' / ' + slots.length + '</div>' +
              '</div>' +
            '</div>';

          $element.html(html);

          $element.find('.qd-kpi-up').off('click.qdkpi').on('click.qdkpi', function () {
            if (self._kpiPage > 0) { self._kpiPage -= 1; self.paint($element, layout); }
          });
          $element.find('.qd-kpi-down').off('click.qdkpi').on('click.qdkpi', function () {
            if (self._kpiPage < totalPages - 1) { self._kpiPage += 1; self.paint($element, layout); }
          });

          // Auto-rotate: one interval per instance, only recreated if the
          // interval length or page count actually changed.
          var rotateSeconds = layout.props.rotateSeconds || 8;
          var rotateKey = layout.props.autoRotate + '|' + rotateSeconds + '|' + totalPages;
          if (self._kpiRotateKey !== rotateKey) {
            if (self._kpiRotateTimer) { clearInterval(self._kpiRotateTimer); self._kpiRotateTimer = null; }
            self._kpiRotateKey = rotateKey;
            if (layout.props.autoRotate && totalPages > 1) {
              self._kpiRotateTimer = setInterval((function ($elSnap, layoutSnap, pagesSnap) {
                return function () {
                  self._kpiPage = (self._kpiPage + 1) % pagesSnap;
                  self.paint($elSnap, layoutSnap);
                };
              })($element, layout, totalPages), rotateSeconds * 1000);
            }
          }
        }

        function escapeHtml(str) {
          return String(str == null ? '' : str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }
      });
    }
  };
});
