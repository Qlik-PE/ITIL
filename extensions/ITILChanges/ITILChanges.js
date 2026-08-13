/**
 * ITIL Changes KPI Panel — v1.3.4
 * QlikDork ITIL 5 Service Intelligence Accelerator
 *
 * v1.3.4: Restored VISIBLE_ROWS to 7, but this time fixed the container
 *         instead of just changing the number. Applied the same fix that
 *         solved the calendar's row-clipping bug back in v1.2.3: rows now
 *         use flex:1 1 0 with min-height:0 instead of a natural/guessed
 *         height, so they genuinely compress to fill whatever vertical
 *         space the quadrant has — 5, 7, or any count — rather than
 *         overflowing and getting silently clipped. Tightened gap
 *         (5px->3px) and badge padding (removed vertical padding, used
 *         line-height instead) to give the flexed rows more breathing
 *         room at typical quadrant heights.
 *
 * v1.3.3: v1.3.2's bump to VISIBLE_ROWS=7 was based on a screenshot that
 *         had lots of visual whitespace below 4 rows — but that was just
 *         "all the data that existed," not proof of 7-row capacity. Real
 *         capacity is ~5. At 7, two rows got silently clipped by the
 *         quadrant's overflow:hidden, AND the rotation guard
 *         (rows.length > VISIBLE_ROWS) never fired when there were
 *         exactly 7 total changes — so those 2 were invisible forever,
 *         with no rotation to ever surface them. Dialed back to 5, which
 *         actually renders without clipping and leaves the rotation
 *         logic room to kick in whenever there's more data than that.
 *
 * v1.3.2: Upcoming Changes ticker now shows 7 rows at a time instead of 4
 *         — there was room to spare. Just the VISIBLE_ROWS constant;
 *         rotation timing (4s) and everything else unchanged.
 *
 * v1.3.1: Fixed phantom "undefined / NaN" rows in the Upcoming Changes
 *         ticker. Root cause: the ticker's session cube has 3 dimensions
 *         (date/name/priority) with qSuppressMissing:false, which was
 *         intentional for the calendar's single-dimension cube (needed
 *         to be sure real dates weren't filtered) but wrong here — with
 *         3 dimensions, qSuppressMissing:false makes Qlik enumerate the
 *         full cartesian product of every date × name × priority
 *         combination, including ones that don't actually co-occur in
 *         any real record. Those synthetic rows have no date, which
 *         rendered as "undefined"/"NaN". Switched to qSuppressMissing/
 *         qSuppressZero:true so only real, associated combinations come
 *         back. Also added an isNaN() guard on the parsed date as a
 *         second line of defense — belt and suspenders in case a genuine
 *         record ever does have a null date field.
 *
 * v1.3.0: Q4 Upcoming Changes is real now — a rotating ticker instead of
 *         a blank placeholder. New "Upcoming Changes" property section:
 *           - Days Ahead (number, default 14) — the whole point of this
 *             version. 7 for chaos, 14 for steady-state, 30 for planning.
 *           - Change Name (expression:'optional', field picker)
 *           - Change Priority (expression:'optional', field picker) —
 *             badge-colored via classifyPriority(), a keyword heuristic
 *             that maps "P1"/"Critical"/etc text back to the same PC
 *             palette used everywhere else in the suite.
 *         Under the hood: a 3-dimension session cube (date/name/priority)
 *         separate from the calendar's, filtered client-side to
 *         [today, today+daysAhead), sorted ascending. Shows 4 rows at a
 *         time, rotating one row forward every 4s with a quick fade, so
 *         the full list — 3 or 50 — eventually cycles through without
 *         ever trying to cram more than 4 rows into the quadrant at once.
 *         Clicking the whole quadrant drills to the Navigation section's
 *         target sheet (same one the header DETAILS button uses) — no
 *         Gantt/density-strip build for now per Dalton's call to keep the
 *         drill-through as the "more detail" path instead.
 *         Added normalizeFieldExpr() as a shared helper (dedupes what the
 *         calendar's dateField handling was already doing inline).
 *
 * v1.2.3: Fixed Change Calendar clipping its last row on months that need
 *         6 grid rows. Root cause: .chg-cal-day had aspect-ratio:1, which
 *         forces cell height to match cell width — with 7 columns in a
 *         narrow quadrant, that width is much taller than the available
 *         row height, so grid-auto-rows:1fr couldn't compress rows to fit
 *         and the bottom row got clipped by the quadrant's overflow:hidden.
 *         Dropped the forced square aspect ratio, switched grid-auto-rows
 *         to minmax(0,1fr) so rows genuinely shrink-to-fit, and trimmed a
 *         bit of padding/label margin in that quadrant for extra headroom.
 *         No logic changes — purely a layout fix.
 *
 * v1.2.2: Change Risk donut scaled up (92px -> 112px max-width). Legend
 *         text/count nudged up slightly (9px->10px label, 12px->13px
 *         count, dot 7px->8px) and legend box widened a touch (118->126px)
 *         so the bigger text doesn't wrap. Row gap tightened 14px->10px
 *         to keep the donut+legend pair balanced now that the donut takes
 *         up more room. No logic changes.
 *
 * v1.2.1: Change Risk quadrant relayout — donut moved left, legend moved
 *         right (was stacked vertically), for visual contrast against the
 *         other quadrants. Legend box narrowed (170px -> 118px max-width)
 *         so the count numbers sit closer to their labels while staying
 *         right-aligned as a column. No logic changes.
 *
 * v1.2.0: Confirmed via research that ServiceNow's out-of-box change_request
 *         risk field is 4-tier (Very High/High/Moderate/Low, backend codes
 *         1-4), not 3. Change Risk quadrant expanded to match:
 *           Very High = P1 red (#ff3b3b), High = P2 orange (#ff8c00),
 *           Moderate  = P3 yellow (#ffd700), Low = P4 blue (#4488ff)
 *         — all reused verbatim from ITILIncidents' PC array.
 *         Change Date field switched from expression:'none' (had to type
 *         the exact field name) to expression:'optional', same picker
 *         pattern as the old trendDateField — user can now select it from
 *         the field/expression list instead of memorizing the name.
 *         getProperties() + extractExpressionText() reintroduced in
 *         paint() specifically to read that one field back out raw.
 *
 * v1.1.1: Swapped the Q1 gauge image for a version with genuine alpha
 *         transparency (the v1.1.0 source PNG had none). Same treatment
 *         as before — composited onto black, resized to 400px, JPEG'd
 *         at 22KB — so mix-blend-mode:screen still reads correctly.
 *         No logic changes.
 *
 * v1.1.0: Meat pass #1.
 *         - Property panel "Incident Panel" -> "Change Panel"
 *         - Q2 replaced: real mini month calendar (Change Calendar section,
 *           single "Change Date" field, plain text like trendDateField
 *           pattern). Session cube (Rule 8) fetches actual date field
 *           values; days present in the current month get highlighted.
 *           Today gets a subtle ring too.
 *         - Q3 replaced: Change Risk donut (High/Medium/Low), 3 expression
 *           inputs. Colors reused verbatim from ITILIncidents P2/P3/P4
 *           (High=#ff8c00, Medium=#ffd700, Low=#4488ff) to keep the
 *           palette consistent across the ITIL suite.
 *         - Q4: Upcoming Changes — header only, body intentionally blank
 *           until we design how it's populated.
 *         - Dropped the old Priority/Trend/Status placeholder code,
 *           buildSparklineSVG, and the getProperties() call entirely —
 *           no expression:'optional' fields remain, so layout.props
 *           already has everything raw. Simpler paint().
 */
define(['qlik', 'jquery'], function (qlik, $) {
  'use strict';

  // ── Color palette ─────────────────────────────────────────────────────────
  var C = {
    bright:'#06FFB1', core:'#00E676', mid:'#00C853', dark:'#007A3D',
    cardBg:'#040d08', quadBg:'#020a04',
    border:'rgba(0,230,118,0.25)', divider:'rgba(0,230,118,0.18)',
    gridLine:'rgba(0,200,83,0.055)', textDim:'#4a7a5a', textMid:'#7ab890'
  };

  // ── extractExpressionText ─────────────────────────────────────────────────
  // Used in paint() to read the raw Change Date expression back out of
  // getProperties() — the field/expression picker wraps a selected field
  // in {qStringExpression:{qExpr:'=[Field]'}} rather than a plain string.
  function extractExpressionText(value) {
    if (value == null) return '';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (value.qStringExpression && value.qStringExpression.qExpr) return value.qStringExpression.qExpr;
    if (value.qValueExpression  && value.qValueExpression.qExpr)  return value.qValueExpression.qExpr;
    if (value.qExpr) return value.qExpr;
    if (value.qDef)  return value.qDef;
    return '';
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  var STYLE_ID = 'qd-itil-chg-v134';
  if (!document.getElementById(STYLE_ID)) {
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      '.chg-ext{background:'+C.cardBg+';border:1px solid '+C.border+';border-radius:8px;height:100%;min-height:200px;box-sizing:border-box;display:flex;flex-direction:column;font-family:"Segoe UI","Helvetica Neue",Arial,sans-serif;color:#fff;overflow:hidden;position:relative;box-shadow:0 0 40px rgba(0,230,118,0.04),inset 0 0 60px rgba(0,0,0,0.4);}',
      '.chg-header{display:flex;align-items:center;padding:7px 12px;background:'+C.cardBg+';border-bottom:1px solid '+C.divider+';flex-shrink:0;z-index:1;}',
      '.chg-header-left{display:flex;align-items:center;gap:7px;min-width:80px;}',
      '.chg-keyword{color:'+C.core+';font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;}',
      '.chg-title{flex:1;text-align:center;font-size:15px;font-weight:700;letter-spacing:5px;color:#fff;text-shadow:0 0 14px rgba(0,230,118,0.2);text-transform:uppercase;}',
      '.chg-nav{display:inline-flex;align-items:center;gap:5px;padding:2px 8px;border:1px solid rgba(0,230,118,0.35);border-radius:12px;cursor:pointer;transition:all 0.2s ease;flex-shrink:0;color:'+C.core+';font-size:9px;font-weight:700;letter-spacing:1.5px;margin-left:10px;}',
      '.chg-nav:hover{background:rgba(0,230,118,0.12);border-color:'+C.core+';box-shadow:0 0 10px rgba(0,230,118,0.35);}',
      '.chg-grid{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;flex:1;min-height:0;}',
      '.chg-q{background-color:'+C.quadBg+';background-image:linear-gradient('+C.gridLine+' 1px,transparent 1px),linear-gradient(90deg,'+C.gridLine+' 1px,transparent 1px);background-size:18px 18px;border:1px solid '+C.divider+';box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;padding:8px;position:relative;}',
      '.chg-q-gauge{padding:4px;}',
      '.chg-gauge-img-container{position:relative;width:88%;max-width:190px;}',
      '.chg-gauge-svg-wrap{width:100%;display:block;}',
      '.chg-kpi-overlay{position:absolute;bottom:8%;left:0;right:0;text-align:center;pointer-events:none;}',
      '.chg-main-number{font-size:clamp(20px,3.5vw,38px);font-weight:800;color:#fff;text-shadow:0 0 18px rgba(6,255,177,0.55),0 0 35px rgba(6,255,177,0.2);line-height:1;letter-spacing:-1px;}',
      '.chg-main-label{font-size:8px;color:#00C853;letter-spacing:2px;text-transform:uppercase;text-align:center;margin-top:1px;text-shadow:0 0 8px rgba(0,200,83,0.5);}',
      '.chg-section-label{font-size:8px;color:'+C.textDim+';letter-spacing:2px;font-weight:700;text-transform:uppercase;margin-bottom:8px;width:100%;}',
      '.chg-q-calendar .chg-section-label{margin-bottom:4px;flex-shrink:0;}',

      /* Q2 — Calendar */
      '.chg-q-calendar{align-items:flex-start;justify-content:flex-start;padding:8px 10px 6px;}',
      '.chg-cal-header{display:grid;grid-template-columns:repeat(7,1fr);width:100%;margin-bottom:2px;flex-shrink:0;}',
      '.chg-cal-dow{font-size:8px;color:'+C.textDim+';text-align:center;font-weight:700;letter-spacing:0.5px;}',
      '.chg-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);grid-auto-rows:minmax(0,1fr);gap:1px 2px;width:100%;flex:1;min-height:0;overflow:hidden;}',
      '.chg-cal-day{display:flex;align-items:center;justify-content:center;font-size:9px;line-height:1;color:#cfe9d8;border-radius:3px;box-sizing:border-box;min-height:0;}',
      '.chg-cal-blank{visibility:hidden;}',
      '.chg-cal-today{box-shadow:inset 0 0 0 1px '+C.textMid+';font-weight:700;color:#fff;}',
      '.chg-cal-changed{background:rgba(0,230,118,0.16);box-shadow:inset 0 0 0 1px '+C.core+',0 0 6px rgba(0,230,118,0.35);color:#fff;font-weight:700;}',

      /* Q3 — Risk donut */
      '.chg-q-risk{align-items:center;justify-content:center;padding:10px 10px 6px;}',
      '.chg-risk-inner{display:flex;flex-direction:row;align-items:center;justify-content:center;gap:10px;width:100%;flex:1;min-height:0;}',
      '.chg-donut-wrap{width:54%;max-width:112px;aspect-ratio:1;flex-shrink:0;}',
      '.chg-donut-wrap svg{width:100%;height:100%;}',
      '.chg-legend{display:flex;flex-direction:column;gap:6px;width:auto;max-width:126px;flex-shrink:0;}',
      '.chg-legend-row{display:flex;align-items:center;width:100%;gap:5px;}',
      '.chg-legend-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}',
      '.chg-legend-label{flex:1;font-size:10px;color:'+C.textMid+';white-space:nowrap;}',
      '.chg-legend-count{font-size:13px;font-weight:700;min-width:18px;text-align:right;}',

      /* Q4 — Upcoming (blank for now) */
      '.chg-q-upcoming{align-items:flex-start;justify-content:flex-start;padding:8px 10px 6px;position:relative;}',
      '.chg-q-upcoming.chg-clickable{cursor:pointer;}',
      '.chg-q-upcoming.chg-clickable:hover{background-color:rgba(0,230,118,0.035);}',
      '.chg-upcoming-placeholder{color:'+C.textDim+';font-size:10px;font-style:italic;margin-top:2px;}',
      '.chg-ticker-sub{font-size:8px;color:'+C.textDim+';margin:-6px 0 6px;width:100%;letter-spacing:1px;}',
      '.chg-ticker-body{display:flex;flex-direction:column;gap:3px;width:100%;flex:1;min-height:0;overflow:hidden;transition:opacity 0.25s ease;}',
      '.chg-ticker-row{display:flex;align-items:center;width:100%;gap:8px;font-size:10px;flex:1 1 0;min-height:0;overflow:hidden;}',
      '.chg-ticker-date{color:'+C.textMid+';flex-shrink:0;width:40px;font-weight:600;}',
      '.chg-ticker-name{flex:1;color:#dff5e6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;}',
      '.chg-ticker-badge{font-size:8px;font-weight:700;padding:0 6px;line-height:1.5;border-radius:9px;border:1px solid;flex-shrink:0;text-align:center;}'
    ].join('');
    document.head.appendChild(s);
  }

  // ── Gauge image ────────────────────────────────────────────────────────────
  var GAUGE_IMG_SRC = 'data:image/jpeg;base64,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xcRTxRged3Nw5sgafq9HSn0W+J4LvsteNYCO3yMUuQ5M39nZo5N+ko3d9VI06SOH9Uw6cPSd9VQ/KMgu+TXeS6XqsfVVLwGgkANjYOTGNHBrR0aAAFHi57NnH7F2vOvlTyjx49n38MTJZzl9Zk0tPTR00NsstCCy32um17GmaeZ73vPNz3cSfgFGURXxiorBE9OnGnHVisgiIql4REQBERAEREAREQBERAEREAREQBERAEREAREQBERAF2a6tqrhOZ6+pmqZiADLK8ucQBoNSeJ4ALrIhTBY4nJBHu71wuQSE4HwQqcIudFwgCIiAIiIAiIgCIiAIiIAiIgCLnROXJAAOGpOgWasuUXiyWysoLPUChbWjdqJ4WATvZpp2fa+s1h6taQD11WERUaT2lsoKSwksQiIqlwREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAXOq4RAEREAREQBERAEREAREQBc6rhEAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAf/Z';
  function buildGaugeHTML() {
    return '<img src="'+GAUGE_IMG_SRC+'" style="width:100%;height:auto;display:block;object-fit:contain;mix-blend-mode:screen;"/>';
  }

  // ── Donut ──────────────────────────────────────────────────────────────────
  function buildDonutSVG(segs) {
    var r=30,cx=38,cy=38,C2=2*Math.PI*r;
    var total=segs.reduce(function(s,g){return s+(g.value||0);},0);
    if(!total) return '<svg viewBox="0 0 76 76"><circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="#0d1f12" stroke-width="12"/></svg>';
    var offset=0,arcs=segs.map(function(seg){
      var arc=(seg.value/total)*C2,gap=Math.min(2,arc*0.08),da=Math.max(0,arc-gap),off=-offset;
      offset+=arc; return{color:seg.color,da:da,off:off};
    });
    return '<svg viewBox="0 0 76 76" xmlns="http://www.w3.org/2000/svg">'+
      '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="#0d1f12" stroke-width="12"/>'+
      arcs.map(function(a){return '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="'+a.color+'" stroke-width="12" stroke-dasharray="'+a.da.toFixed(2)+' '+C2.toFixed(2)+'" stroke-dashoffset="'+a.off.toFixed(2)+'" transform="rotate(-90,'+cx+','+cy+')"/>';}).join('')+
      '</svg>';
  }

  // ── Calendar ───────────────────────────────────────────────────────────────
  // changedDays = { dayOfMonth: true, ... } for the CURRENT month only.
  function buildCalendarBodyHTML(changedDays) {
    var now = new Date();
    var year = now.getFullYear(), month = now.getMonth();
    var daysInMonth   = new Date(year, month + 1, 0).getDate();
    var firstWeekday  = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0..Sun=6
    var todayDate     = now.getDate();
    var cells = [];
    for (var i = 0; i < firstWeekday; i++) cells.push('<span class="chg-cal-day chg-cal-blank"></span>');
    for (var day = 1; day <= daysInMonth; day++) {
      var cls = 'chg-cal-day';
      if (changedDays[day]) cls += ' chg-cal-changed';
      if (day === todayDate) cls += ' chg-cal-today';
      cells.push('<span class="'+cls+'">'+day+'</span>');
    }
    while (cells.length % 7 !== 0) cells.push('<span class="chg-cal-day chg-cal-blank"></span>');
    return cells.join('');
  }
  function buildCalendarShellHTML(qid) {
    var dow = ['M','T','W','T','F','S','S'];
    var headerHTML = dow.map(function(d){ return '<span class="chg-cal-dow">'+d+'</span>'; }).join('');
    return '<div class="chg-cal-header">'+headerHTML+'</div>'+
           '<div class="chg-cal-grid" id="qd-chg-cal-body-'+qid+'">'+buildCalendarBodyHTML({})+'</div>';
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function parseVal(raw) {
    if (raw===undefined||raw===null||raw==='') return '-';
    var n=parseFloat(String(raw).replace(/,/g,'').trim());
    if (isNaN(n)) return String(raw)||'-';
    return n%1===0 ? n.toLocaleString() : n.toFixed(1);
  }
  function numVal(raw) {
    var n=parseFloat(String(raw||0).replace(/,/g,'').trim());
    return isNaN(n)?0:n;
  }
  // Strip a leading "=" (the field/expression picker attaches one when a
  // field is selected) and bracket-wrap for use inside a qFieldDefs array.
  // Shared by Change Date, Change Name, and Change Priority.
  function normalizeFieldExpr(raw) {
    var t = (raw||'').trim();
    if (!t) return '';
    var e = t.charAt(0)==='=' ? t.substring(1).trim() : t;
    return e.charAt(0)==='[' ? e : '['+e+']';
  }
  // Heuristic match of a raw priority/risk text value to a PC palette
  // entry, so the ticker badge colors stay consistent even if the field
  // returns "P2", "2 - High", or just "High". Falls back to Planning/grey.
  function classifyPriority(text) {
    var t = String(text||'').toLowerCase();
    if (t.indexOf('p1')>-1 || t.indexOf('critical')>-1) return PC[0];
    if (t.indexOf('p2')>-1 || t.indexOf('high')>-1)      return PC[1];
    if (t.indexOf('p3')>-1 || t.indexOf('medium')>-1 || t.indexOf('moderate')>-1) return PC[2];
    if (t.indexOf('p4')>-1 || t.indexOf('low')>-1)       return PC[3];
    return PC[4];
  }

  // ── Icons ──────────────────────────────────────────────────────────────────
  var ITIL_ICON='<svg viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg" style="width:20px;height:20px;flex-shrink:0"><circle cx="11" cy="11" r="9" fill="none" stroke="'+C.core+'" stroke-width="1.4"/><circle cx="11" cy="11" r="5.8" fill="none" stroke="'+C.core+'" stroke-width="1.4"/><circle cx="11" cy="11" r="2.2" fill="none" stroke="'+C.core+'" stroke-width="1.4"/></svg>';
  var NAV_ARROW='<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width:10px;height:10px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round"><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/><polyline points="21 15 21 21 3 21 3 3 9 3"/></svg>';

  // Priority colors — kept verbatim from ITILIncidents so the palette
  // matches across the ITIL suite. RISK below reuses P2/P3/P4 exactly.
  var PC=[
    {label:'Critical',color:'#ff3b3b',bg:'rgba(255,59,59,0.13)',  border:'rgba(255,59,59,0.55)'},
    {label:'High',    color:'#ff8c00',bg:'rgba(255,140,0,0.13)',  border:'rgba(255,140,0,0.55)'},
    {label:'Medium',  color:'#ffd700',bg:'rgba(255,215,0,0.10)',  border:'rgba(255,215,0,0.5)'},
    {label:'Low',     color:'#4488ff',bg:'rgba(68,136,255,0.10)', border:'rgba(68,136,255,0.5)'},
    {label:'Planning',color:'#9e9e9e',bg:'rgba(158,158,158,0.08)',border:'rgba(158,158,158,0.4)'}
  ];
  var RISK = [
    {label:'Very High', color:PC[0].color},
    {label:'High',      color:PC[1].color},
    {label:'Moderate',  color:PC[2].color},
    {label:'Low',       color:PC[3].color}
  ];

  // ── Property panel ─────────────────────────────────────────────────────────
  var definition = {
    type:'items', component:'accordion',
    items:{
      panelConfig:{
        label:'Change Panel', type:'items',
        items:{
          keyword  :{ref:'props.keyword',   label:'Keyword Badge',  type:'string',defaultValue:'ITIL',          expression:'none'},
          mainLabel:{ref:'props.mainLabel',  label:'KPI Sub-Label',  type:'string',defaultValue:'Planned Changes',expression:'none'},
          mainExpr :{ref:'props.mainExpr',   label:'Planned Changes', type:'string',expression:'always'}
        }
      },
      calendarConfig:{
        label:'Change Calendar', type:'items',
        items:{
          changeDateField:{
            ref:'props.changeDateField',
            label:'Change Date',
            type:'string', defaultValue:'', expression:'optional'
          }
        }
      },
      riskConfig:{
        label:'Change Risk', type:'items',
        items:{
          riskVeryHigh:{ref:'props.riskVeryHigh',label:'Very High Risk',type:'string',expression:'always'},
          riskHigh    :{ref:'props.riskHigh',    label:'High Risk',     type:'string',expression:'always'},
          riskModerate:{ref:'props.riskModerate',label:'Moderate Risk', type:'string',expression:'always'},
          riskLow     :{ref:'props.riskLow',     label:'Low Risk',      type:'string',expression:'always'}
        }
      },
      upcomingConfig:{
        label:'Upcoming Changes', type:'items',
        items:{
          daysAhead:{
            ref:'props.daysAhead', label:'Days Ahead',
            type:'number', defaultValue:14, min:1, max:365, expression:'none'
          },
          changeName:{
            ref:'props.changeName', label:'Change Name',
            type:'string', defaultValue:'', expression:'optional'
          },
          changePriority:{
            ref:'props.changePriority', label:'Change Priority',
            type:'string', defaultValue:'', expression:'optional'
          }
        }
      },
      navConfig:{
        label:'Navigation', type:'items',
        items:{
          targetSheet:{
            ref:'props.targetSheet',
            label:'Drill-through Sheet',
            type:'string',component:'dropdown',defaultValue:'',
            options: function() {
              return qlik.currApp().model.enigmaModel.createSessionObject({
                qInfo:{qId:'ITILChgSheetPicker',qType:'SheetList'},
                qAppObjectListDef:{qType:'sheet',qData:{title:'/qMetaDef/title',rank:'/rank'}}
              }).then(function(obj){
                return obj.getLayout().then(function(layout){
                  var items=(layout.qAppObjectList.qItems||[]);
                  items.sort(function(a,b){return((a.qData&&a.qData.rank)||0)-((b.qData&&b.qData.rank)||0);});
                  return [{value:'',label:'— None —'}].concat(items.map(function(s){
                    return{value:s.qInfo.qId,label:(s.qData&&s.qData.title)||s.qInfo.qId};
                  }));
                });
              }).catch(function(){return [{value:'',label:'Paste Sheet ID in fallback below'}];});
            }
          },
          targetSheetFallback:{
            ref:'props.targetSheet',
            label:'— or paste Sheet ID (GUID after /sheet/ in URL)',
            type:'string',defaultValue:'',expression:'none'
          }
        }
      }
    }
  };

  // ── Initial properties ─────────────────────────────────────────────────────
  var initialProperties = {
    qHyperCubeDef:{qDimensions:[],qMeasures:[],qInitialDataFetch:[]},
    props:{
      keyword:'ITIL', mainLabel:'Planned Changes', mainExpr:'',
      changeDateField:'',
      riskVeryHigh:'', riskHigh:'', riskModerate:'', riskLow:'',
      daysAhead:14, changeName:'', changePriority:'',
      targetSheet:''
    }
  };

  // ── Extension ──────────────────────────────────────────────────────────────
  return {
    definition: definition,
    initialProperties: initialProperties,
    support:{snapshot:true, export:true, exportData:true},

    paint: function ($element, layout) {
      var self = this;
      var p    = layout.props || {};
      // Capture app reference SYNCHRONOUSLY at paint() start (Rule 7).
      var appRef = qlik.currApp(self);

      // Change Date is now expression:'optional' (Rule 3/10) so the user
      // can pick it from the field/expression picker instead of typing the
      // exact field name from memory. Need getProperties() to read the raw
      // text back out — layout.props.changeDateField comes back as an
      // object ({qStringExpression:{qExpr:...}}) when a calc is attached.
      return self.backendApi.model.getProperties().then(function (rawProps) {
        var rp = rawProps.props || {};

        var qid       = layout.qInfo.qId;
        var mainVal   = parseVal(p.mainExpr);
        var keyword     = p.keyword    || 'ITIL';
        var mainLabel   = p.mainLabel  || 'Planned Changes';
        var targetSheet = p.targetSheet || '';

        var navHTML = targetSheet
          ? '<div class="chg-nav" id="qd-chg-nav-'+qid+'">'+NAV_ARROW+'<span>DETAILS</span></div>'
          : '';

        var riskVals = [numVal(p.riskVeryHigh), numVal(p.riskHigh), numVal(p.riskModerate), numVal(p.riskLow)];
        var riskDonutSegs = RISK.map(function(r,i){ return {value:riskVals[i], color:r.color}; });
        var riskLegendHTML = RISK.map(function(r,i){
          return '<div class="chg-legend-row"><span class="chg-legend-dot" style="background:'+r.color+'"></span>'+
                 '<span class="chg-legend-label">'+r.label+'</span>'+
                 '<span class="chg-legend-count" style="color:'+r.color+'">'+riskVals[i]+'</span></div>';
        }).join('');

        $element.html([
          '<div class="chg-ext">',
          '<div class="chg-header">',
          '  <div class="chg-header-left">'+ITIL_ICON+'<span class="chg-keyword">'+keyword+'</span></div>',
          '  <span class="chg-title">CHANGES'+navHTML+'</span>',
          '</div>',
          '<div class="chg-grid">',

          /* Q1 — Gauge */
          '<div class="chg-q chg-q-gauge"><div class="chg-gauge-img-container">',
          '<div class="chg-gauge-svg-wrap">'+buildGaugeHTML()+'</div>',
          '<div class="chg-kpi-overlay">',
          '<div class="chg-main-number">'+mainVal+'</div>',
          '<div class="chg-main-label">'+mainLabel+'</div>',
          '</div></div></div>',

          /* Q2 — Change Calendar */
          '<div class="chg-q chg-q-calendar">',
          '<div class="chg-section-label">Change Calendar</div>',
          buildCalendarShellHTML(qid),
          '</div>',

          /* Q3 — Change Risk */
          '<div class="chg-q chg-q-risk">',
          '<div class="chg-section-label">Change Risk</div>',
          '<div class="chg-risk-inner">',
          '<div class="chg-donut-wrap">'+buildDonutSVG(riskDonutSegs)+'</div>',
          '<div class="chg-legend">'+riskLegendHTML+'</div>',
          '</div></div>',

          /* Q4 — Upcoming Changes */
          '<div class="chg-q chg-q-upcoming'+(targetSheet?' chg-clickable':'')+'" id="qd-chg-upcoming-'+qid+'">',
          '<div class="chg-section-label">Upcoming Changes</div>',
          '<div class="chg-ticker-sub">Next '+(numVal(p.daysAhead)||14)+' days</div>',
          '<div class="chg-ticker-body" id="qd-chg-ticker-'+qid+'"><div class="chg-upcoming-placeholder">Loading…</div></div>',
          '</div>',

          '</div></div>'
        ].join('\n'));

        if (targetSheet) {
          $element.find('#qd-chg-nav-'+qid).on('click',function(){qlik.navigation.gotoSheet(targetSheet);});
          $element.find('#qd-chg-upcoming-'+qid).on('click',function(){qlik.navigation.gotoSheet(targetSheet);});
        }

        // ── Change Calendar data — session cube, debounced 400ms ───────────
        // Rule 8/9/10: pull the raw expression via normalizeFieldExpr
        // (strips a leading "=" and bracket-wraps). Dummy measure just
        // forces real rows back for dates that exist in the data. Cache
        // by field; only recreate the session object when it changes.
        var dateField = normalizeFieldExpr(extractExpressionText(rp.changeDateField));
        if (dateField) {
          if (self._calExprKey !== dateField && self._calCubeObj) {
            try { appRef.model.enigmaModel.destroySessionObject(self._calCubeObj.id); } catch (e) {}
            self._calCubeObj = null;
          }
          self._calExprKey = dateField;

          if (self._calTimer) clearTimeout(self._calTimer);

          self._calTimer = setTimeout((function (df, qidSnap, $elSnap, app) {
            return function () {
              var cubePromise = self._calCubeObj
                ? Promise.resolve(self._calCubeObj)
                : app.model.enigmaModel.createSessionObject({
                    qInfo: { qType: 'ITILChgCalendarCube' },
                    qHyperCubeDef: {
                      qDimensions: [{ qDef: { qFieldDefs: [df] }, qSortCriterias: [{ qSortByNumeric: 1 }] }],
                      qMeasures:   [{ qDef: { qDef: '=1' } }],
                      qInitialDataFetch: [{ qWidth: 2, qHeight: 60 }],
                      qSuppressMissing: false,
                      qSuppressZero: false
                    }
                  }).then(function (obj) { self._calCubeObj = obj; return obj; });

              cubePromise.then(function (cubeObj) {
                return cubeObj.getLayout().then(function (cubeLayout) {
                  var pages  = (cubeLayout.qHyperCube && cubeLayout.qHyperCube.qDataPages) || [];
                  var matrix = (pages[0] && pages[0].qMatrix) || [];
                  var QLIK_EPOCH = new Date(1899, 11, 30).getTime();
                  var now = new Date(), curY = now.getFullYear(), curM = now.getMonth();
                  var changedDays = {};

                  matrix.forEach(function (row) {
                    var cell = row[0];
                    if (!cell || cell.qNum === undefined || cell.qNum === null || cell.qNum === 1e308) return;
                    var serial = Math.round(cell.qNum);
                    var d = new Date(QLIK_EPOCH + serial * 86400000);
                    if (d.getFullYear() === curY && d.getMonth() === curM) {
                      changedDays[d.getDate()] = true;
                    }
                  });

                  var $ce = $elSnap.find('#qd-chg-cal-body-' + qidSnap);
                  if ($ce.length) $ce.html(buildCalendarBodyHTML(changedDays));
                });
              }).catch(function () { /* leave calendar unhighlighted on error */ });
            };
          })(dateField, qid, $element, appRef), 400);
        }

        // ── Upcoming Changes ticker ──────────────────────────────────────
        // Needs all three fields (date/name/priority). Separate session
        // cube from the calendar's — different dimension set — cached and
        // debounced the same way. Once data lands, rotates VISIBLE_ROWS at
        // a time through the full result set on a timer, fading between
        // batches, so 50 upcoming changes are all reachable without ever
        // trying to cram more than a handful on screen at once.
        if (self._tickerInterval) { clearInterval(self._tickerInterval); self._tickerInterval = null; }

        var nameField     = normalizeFieldExpr(extractExpressionText(rp.changeName));
        var priorityField = normalizeFieldExpr(extractExpressionText(rp.changePriority));
        var daysAhead     = Math.max(1, numVal(p.daysAhead) || 14);
        var $ticker = $element.find('#qd-chg-ticker-' + qid);
        var VISIBLE_ROWS = 7;
        var ROTATE_MS = 4000;

        function renderTickerRows(rows) {
          if (!rows.length) return '<div class="chg-upcoming-placeholder">No changes in the next '+daysAhead+' days</div>';
          return rows.map(function (r) {
            return '<div class="chg-ticker-row">'+
                     '<span class="chg-ticker-date">'+r.dateLabel+'</span>'+
                     '<span class="chg-ticker-name">'+r.name+'</span>'+
                     '<span class="chg-ticker-badge" style="background:'+r.pc.bg+';border-color:'+r.pc.border+';color:'+r.pc.color+'">'+r.priorityText+'</span>'+
                   '</div>';
          }).join('');
        }
        function sliceCircular(data, offset, n) {
          if (data.length <= n) return data;
          var out = [];
          for (var i = 0; i < n; i++) out.push(data[(offset + i) % data.length]);
          return out;
        }

        if (!dateField || !nameField || !priorityField) {
          $ticker.html('<div class="chg-upcoming-placeholder">Configure Change Date, Change Name &amp; Change Priority</div>');
        } else {
          var tickerKey = dateField + '|' + nameField + '|' + priorityField;
          if (self._tickerExprKey !== tickerKey && self._tickerCubeObj) {
            try { appRef.model.enigmaModel.destroySessionObject(self._tickerCubeObj.id); } catch (e) {}
            self._tickerCubeObj = null;
          }
          self._tickerExprKey = tickerKey;

          if (self._tickerTimer) clearTimeout(self._tickerTimer);
          self._tickerTimer = setTimeout((function (df, nf, pf, days, $tk, app) {
            return function () {
              var cubePromise = self._tickerCubeObj
                ? Promise.resolve(self._tickerCubeObj)
                : app.model.enigmaModel.createSessionObject({
                    qInfo: { qType: 'ITILChgUpcomingCube' },
                    qHyperCubeDef: {
                      qDimensions: [
                        { qDef: { qFieldDefs: [df] }, qSortCriterias: [{ qSortByNumeric: 1 }] },
                        { qDef: { qFieldDefs: [nf] } },
                        { qDef: { qFieldDefs: [pf] } }
                      ],
                      qMeasures: [{ qDef: { qDef: '=1' } }],
                      qInitialDataFetch: [{ qWidth: 4, qHeight: 300 }],
                      qSuppressMissing: true,
                      qSuppressZero: true
                    }
                  }).then(function (obj) { self._tickerCubeObj = obj; return obj; });

              cubePromise.then(function (cubeObj) {
                return cubeObj.getLayout().then(function (cubeLayout) {
                  var pages  = (cubeLayout.qHyperCube && cubeLayout.qHyperCube.qDataPages) || [];
                  var matrix = (pages[0] && pages[0].qMatrix) || [];
                  var QLIK_EPOCH = new Date(1899, 11, 30).getTime();
                  var now = new Date();
                  var startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
                  var cutoff = startOfToday + days * 86400000;
                  var MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

                  var rows = [];
                  matrix.forEach(function (row) {
                    var dCell = row[0];
                    if (!dCell || dCell.qNum === undefined || dCell.qNum === null || dCell.qNum === 1e308 || isNaN(dCell.qNum)) return;
                    var serial = Math.round(dCell.qNum);
                    var ms = QLIK_EPOCH + serial * 86400000;
                    if (isNaN(ms) || ms < startOfToday || ms >= cutoff) return;
                    var d = new Date(ms);
                    if (isNaN(d.getTime())) return;
                    var nameText = (row[1] && row[1].qText) || '';
                    var priText  = (row[2] && row[2].qText) || '';
                    if (!nameText) return;
                    rows.push({
                      sortMs: ms,
                      dateLabel: MONTH_ABBR[d.getMonth()] + ' ' + d.getDate(),
                      name: nameText,
                      priorityText: priText,
                      pc: classifyPriority(priText)
                    });
                  });
                  rows.sort(function (a, b) { return a.sortMs - b.sortMs; });

                  var offset = 0;
                  $tk.html(renderTickerRows(sliceCircular(rows, offset, VISIBLE_ROWS)));

                  if (self._tickerInterval) clearInterval(self._tickerInterval);
                  if (rows.length > VISIBLE_ROWS) {
                    self._tickerInterval = setInterval(function () {
                      offset = (offset + 1) % rows.length;
                      $tk.css('opacity', 0);
                      setTimeout(function () {
                        $tk.html(renderTickerRows(sliceCircular(rows, offset, VISIBLE_ROWS)));
                        $tk.css('opacity', 1);
                      }, 220);
                    }, ROTATE_MS);
                  }
                });
              }).catch(function () {
                $tk.html('<div class="chg-upcoming-placeholder">Unable to load upcoming changes</div>');
              });
            };
          })(dateField, nameField, priorityField, daysAhead, $ticker, appRef), 400);
        }
      }); // end getProperties().then()
    }
  };
});
