/**
 * ITIL Problems KPI Panel — v1.2.0
 * QlikDork ITIL 5 Service Intelligence Accelerator
 *
 * v1.2.0: Q4 "Trend" placeholder replaced with a real "Age Band" grid —
 *         same Priority-Breakdown list layout ITILIncidents uses for
 *         P1-P5 (colored badge + right-aligned count per row), applied to
 *         4 fixed problem-age bands instead of 5 priorities.
 *           - New "Age Band" property section: 4 expression:'always' slots
 *             (ageNew/age8to30/age31to90/ageOver90) — same pattern as
 *             ITILIncidents' P1-P5, each one a plug-in for a master
 *             measure or raw formula, evaluated straight to a number. No
 *             session cube needed since the 4 bands are fixed, not a
 *             dynamic dimension.
 *           - Plus a "Problem Age Band Field" picker (expression:'optional',
 *             same pattern as categoryDimension) — NOT used to drive the
 *             counts (those come from the 4 measures above), only to
 *             enable click-to-select: clicking a row calls
 *             appRef.field(name).selectMatch(bandLabel) to filter the app
 *             to that band. Requires the field's actual values to match
 *             the band label text ("New (0-7 Days)", etc.) — if Dalton's
 *             age-band field uses different text, clicking won't select
 *             anything (fails silently, no crash).
 *           - New `plainFieldName()` helper — like `normalizeFieldExpr()`
 *             but strips brackets too, since `app.field(name)` wants a
 *             bare field name, not a `qFieldDefs`-style bracketed ref.
 *
 * v1.1.0: Fixed Status bar chart showing "NaN" on every bar, all rendered
 *         at identical (full) width. Root cause: the Status section had
 *         two separate inputs — a dimension AND a measure — but Dalton had
 *         (reasonably) only populated the single field literally labeled
 *         "Problem Status," which was the DIMENSION picker in name only;
 *         the actual measure slot (also confusingly close in purpose) was
 *         left pointing at a non-aggregating dimension reference, so the
 *         session cube tried to sum a text field and got NaN back for
 *         every row — and NaN also breaks the width-percentage math, which
 *         is why every bar rendered at the same (invalid-CSS-fallback)
 *         length instead of varying.
 *         Fix: Status is now dimension-only, matching how Top Problem
 *         Categories already works — one field ("Problem Status"), and the
 *         bar measure is silently reused from Q1's Open Problem Count raw
 *         expression (Rule 2/3), same as the Category donut already does.
 *         Removed the standalone statusMeasure property entirely.
 *
 * v1.0.0: First build. Companion to ITILIncidents and ITILChanges, same
 *         color theme / card / quadrant grid structure (copied verbatim
 *         from ITILChanges v1.3.4 — header, chg-grid-style 2x2 layout,
 *         session-cube data patterns).
 *           - Q1: "Problem Panel" section. Magnifying-glass image (swapped
 *             in for the gear/gauge used by Changes) with an Open Problem
 *             Count KPI overlay. expression:'optional' so the count can be
 *             a master measure (Rule 2/3) — evaluated number displays in
 *             the overlay, raw formula is reused as the measure for the
 *             Top Problem Categories pie in Q3.
 *           - Q2: "Status" section. One dimension (Problem Status) + one
 *             expression (Problem Status, expression:'optional') build a
 *             session cube (Rule 8) rendered as a horizontal bar chart —
 *             one row per status value, value label at the end of each bar.
 *           - Q3: "Top Problem Categories" section. One dimension (Problem
 *             Category) reuses the Q1 Open Problem Count raw expression as
 *             its measure — no separate expression input needed. Rendered
 *             as a donut/pie (buildDonutSVG, extended to N segments with a
 *             cycling palette) plus a legend with category + count.
 *           - Q4: "Trend" — header only, placeholder body per Dalton's call
 *             to hold off on building it out for now (same treatment as
 *             ITILChanges v1.1.0's original blank Q4).
 *           - Navigation section (drill-through target sheet) carried over
 *             verbatim from ITILChanges for suite consistency.
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

  // Cycling palette for dynamic dimension values (status / category) where
  // the number and names of members aren't known ahead of time.
  var CAT_PALETTE = ['#06FFB1','#00E676','#4488ff','#ffd700','#ff8c00','#00C853','#9e9e9e','#007A3D'];
  function paletteColor(i) { return CAT_PALETTE[i % CAT_PALETTE.length]; }

  // ── extractExpressionText ─────────────────────────────────────────────────
  // Used in paint() to read raw expression/field text back out of
  // getProperties() — the field/expression picker wraps a selected
  // field/measure in {qStringExpression:{qExpr:'=...'}} rather than a
  // plain string.
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
  var STYLE_ID = 'qd-itil-prb-v120';
  if (!document.getElementById(STYLE_ID)) {
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      '.prb-ext{background:'+C.cardBg+';border:1px solid '+C.border+';border-radius:8px;height:100%;min-height:200px;box-sizing:border-box;display:flex;flex-direction:column;font-family:"Segoe UI","Helvetica Neue",Arial,sans-serif;color:#fff;overflow:hidden;position:relative;box-shadow:0 0 40px rgba(0,230,118,0.04),inset 0 0 60px rgba(0,0,0,0.4);}',
      '.prb-header{display:flex;align-items:center;padding:7px 12px;background:'+C.cardBg+';border-bottom:1px solid '+C.divider+';flex-shrink:0;z-index:1;}',
      '.prb-header-left{display:flex;align-items:center;gap:7px;min-width:80px;}',
      '.prb-keyword{color:'+C.core+';font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;}',
      '.prb-title{flex:1;text-align:center;font-size:15px;font-weight:700;letter-spacing:5px;color:#fff;text-shadow:0 0 14px rgba(0,230,118,0.2);text-transform:uppercase;}',
      '.prb-nav{display:inline-flex;align-items:center;gap:5px;padding:2px 8px;border:1px solid rgba(0,230,118,0.35);border-radius:12px;cursor:pointer;transition:all 0.2s ease;flex-shrink:0;color:'+C.core+';font-size:9px;font-weight:700;letter-spacing:1.5px;margin-left:10px;}',
      '.prb-nav:hover{background:rgba(0,230,118,0.12);border-color:'+C.core+';box-shadow:0 0 10px rgba(0,230,118,0.35);}',
      '.prb-grid{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;flex:1;min-height:0;}',
      '.prb-q{background-color:'+C.quadBg+';background-image:linear-gradient('+C.gridLine+' 1px,transparent 1px),linear-gradient(90deg,'+C.gridLine+' 1px,transparent 1px);background-size:18px 18px;border:1px solid '+C.divider+';box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;padding:8px;position:relative;}',
      '.prb-q-gauge{padding:4px;}',
      '.prb-gauge-img-container{position:relative;width:88%;max-width:190px;}',
      '.prb-gauge-svg-wrap{width:100%;display:block;}',
      '.prb-kpi-overlay{position:absolute;bottom:8%;left:0;right:0;text-align:center;pointer-events:none;}',
      '.prb-main-number{font-size:clamp(20px,3.5vw,38px);font-weight:800;color:#fff;text-shadow:0 0 18px rgba(6,255,177,0.55),0 0 35px rgba(6,255,177,0.2);line-height:1;letter-spacing:-1px;}',
      '.prb-main-label{font-size:8px;color:#00C853;letter-spacing:2px;text-transform:uppercase;text-align:center;margin-top:1px;text-shadow:0 0 8px rgba(0,200,83,0.5);}',
      '.prb-section-label{font-size:8px;color:'+C.textDim+';letter-spacing:2px;font-weight:700;text-transform:uppercase;margin-bottom:8px;width:100%;}',

      /* Q2 — Status bar chart */
      '.prb-q-status{align-items:flex-start;justify-content:flex-start;padding:8px 10px 6px;}',
      '.prb-bars{display:flex;flex-direction:column;gap:6px;width:100%;flex:1;min-height:0;overflow:hidden;justify-content:center;}',
      '.prb-bar-row{display:flex;align-items:center;width:100%;gap:6px;flex:1 1 0;min-height:0;max-height:26px;}',
      '.prb-bar-label{width:34%;max-width:70px;flex-shrink:0;font-size:9px;color:'+C.textMid+';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.prb-bar-track{flex:1;height:9px;background:rgba(255,255,255,0.06);border-radius:5px;overflow:hidden;min-width:0;}',
      '.prb-bar-fill{height:100%;border-radius:5px;transition:width 0.4s ease;}',
      '.prb-bar-value{width:22px;flex-shrink:0;font-size:10px;font-weight:700;color:#fff;text-align:right;}',
      '.prb-status-placeholder{color:'+C.textDim+';font-size:10px;font-style:italic;margin-top:2px;}',

      /* Q3 — Top Problem Categories donut */
      '.prb-q-category{align-items:center;justify-content:center;padding:10px 10px 6px;}',
      '.prb-cat-inner{display:flex;flex-direction:row;align-items:center;justify-content:center;gap:10px;width:100%;flex:1;min-height:0;}',
      '.prb-donut-wrap{width:54%;max-width:112px;aspect-ratio:1;flex-shrink:0;}',
      '.prb-donut-wrap svg{width:100%;height:100%;}',
      '.prb-legend{display:flex;flex-direction:column;gap:6px;width:auto;max-width:126px;flex-shrink:0;max-height:100%;overflow:hidden;}',
      '.prb-legend-row{display:flex;align-items:center;width:100%;gap:5px;}',
      '.prb-legend-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}',
      '.prb-legend-label{flex:1;font-size:10px;color:'+C.textMid+';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.prb-legend-count{font-size:13px;font-weight:700;min-width:18px;text-align:right;}',
      '.prb-cat-placeholder{color:'+C.textDim+';font-size:10px;font-style:italic;margin-top:2px;}',

      /* Q4 — Age Band grid (Priority-Breakdown style, ported from ITILIncidents) */
      '.prb-q-ageband{align-items:flex-start;justify-content:flex-start;padding:8px 10px 6px;}',
      '.prb-ageband-rows{display:flex;flex-direction:column;gap:8px;width:100%;flex:1;min-height:0;justify-content:center;}',
      '.prb-ageband-row{display:flex;align-items:center;justify-content:space-between;width:100%;gap:8px;}',
      '.prb-ageband-row.prb-clickable{cursor:pointer;border-radius:4px;transition:background-color 0.15s ease;}',
      '.prb-ageband-row.prb-clickable:hover{background-color:rgba(0,230,118,0.06);}',
      '.prb-ageband-badge{font-size:10px;font-weight:700;padding:3px 10px;border-radius:4px;border:1px solid;letter-spacing:0.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.prb-ageband-count{font-size:15px;font-weight:800;flex-shrink:0;min-width:20px;text-align:right;}',
      '.prb-ageband-placeholder{color:'+C.textDim+';font-size:10px;font-style:italic;margin-top:2px;}'
    ].join('');
    document.head.appendChild(s);
  }

  // ── Magnifying-glass image (Q1) ─────────────────────────────────────────────
  // 320x320 PNG, genuine alpha transparency, quantized to ~9KB. Same
  // mix-blend-mode:screen treatment as ITILChanges' gauge image so the
  // green ring glows against the dark quadrant background instead of
  // showing a hard edge.
  var MAGNIFIER_IMG_SRC = 'data:image/png;base64,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';
  function buildGaugeHTML() {
    return '<img src="'+MAGNIFIER_IMG_SRC+'" style="width:100%;height:auto;display:block;object-fit:contain;mix-blend-mode:screen;"/>';
  }

  // ── Donut / pie (generic N-segment) ─────────────────────────────────────────
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
  // Shared by Problem Status Dimension and Problem Category Dimension.
  function normalizeFieldExpr(raw) {
    var t = (raw||'').trim();
    if (!t) return '';
    var e = t.charAt(0)==='=' ? t.substring(1).trim() : t;
    return e.charAt(0)==='[' ? e : '['+e+']';
  }
  // Strip a leading "=" from a raw MEASURE expression (used verbatim as
  // qDef.qDef in a session cube — measures do NOT get bracket-wrapped).
  function normalizeMeasureExpr(raw) {
    var t = (raw||'').trim();
    if (!t) return '';
    return t.charAt(0)==='=' ? t.substring(1).trim() : t;
  }
  // Like normalizeFieldExpr, but for app.field(name) calls (Age Band
  // click-to-select) — strips a leading "=" AND any bracket wrapper,
  // since app.field() wants the bare field name, not a qFieldDefs ref.
  function plainFieldName(raw) {
    var t = (raw||'').trim();
    if (!t) return '';
    var e = t.charAt(0)==='=' ? t.substring(1).trim() : t;
    if (e.charAt(0)==='[' && e.charAt(e.length-1)===']') e = e.substring(1, e.length-1);
    return e;
  }

  // Age Band palette — fixed 4 bands (New/8-30/31-90/Over 90), matching
  // the ITILIncidents-style Priority Breakdown list layout. Colors per
  // Dalton's band spec: green -> amber -> orange -> red. Each band's count
  // comes from its own expression:'always' master-measure slot (props.age*),
  // not from a session cube — same pattern as ITILIncidents' P1-P5 rows.
  var AGE_BANDS = [
    {key:'ageNew',      label:'New (0-7 Days)', color:'#00E676', bg:'rgba(0,230,118,0.13)', border:'rgba(0,230,118,0.55)'},
    {key:'age8to30',    label:'8-30 Days',      color:'#ffd700', bg:'rgba(255,215,0,0.13)', border:'rgba(255,215,0,0.55)'},
    {key:'age31to90',   label:'31-90 Days',     color:'#ff8c00', bg:'rgba(255,140,0,0.13)', border:'rgba(255,140,0,0.55)'},
    {key:'ageOver90',   label:'Over 90 Days',   color:'#ff3b3b', bg:'rgba(255,59,59,0.13)', border:'rgba(255,59,59,0.55)'}
  ];

  // ── Icons ──────────────────────────────────────────────────────────────────
  var ITIL_ICON='<svg viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg" style="width:20px;height:20px;flex-shrink:0"><circle cx="11" cy="11" r="9" fill="none" stroke="'+C.core+'" stroke-width="1.4"/><circle cx="11" cy="11" r="5.8" fill="none" stroke="'+C.core+'" stroke-width="1.4"/><circle cx="11" cy="11" r="2.2" fill="none" stroke="'+C.core+'" stroke-width="1.4"/></svg>';
  var NAV_ARROW='<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width:10px;height:10px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round"><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/><polyline points="21 15 21 21 3 21 3 3 9 3"/></svg>';

  // ── Property panel ─────────────────────────────────────────────────────────
  var definition = {
    type:'items', component:'accordion',
    items:{
      panelConfig:{
        label:'Problem Panel', type:'items',
        items:{
          keyword  :{ref:'props.keyword',   label:'Keyword Badge',   type:'string',defaultValue:'ITIL',         expression:'none'},
          mainLabel:{ref:'props.mainLabel',  label:'KPI Sub-Label',   type:'string',defaultValue:'Open Problems',expression:'none'},
          openProblemCount:{
            ref:'props.openProblemCount', label:'Open Problem Count',
            type:'string', defaultValue:'', expression:'optional'
          }
        }
      },
      statusConfig:{
        label:'Status', type:'items',
        items:{
          statusDimension:{
            ref:'props.statusDimension', label:'Problem Status',
            type:'string', defaultValue:'', expression:'optional'
          }
        }
      },
      categoryConfig:{
        label:'Top Problem Categories', type:'items',
        items:{
          categoryDimension:{
            ref:'props.categoryDimension', label:'Problem Category Dimension',
            type:'string', defaultValue:'', expression:'optional'
          }
        }
      },
      ageBandConfig:{
        label:'Age Band', type:'items',
        items:{
          ageBandField:{
            ref:'props.ageBandField', label:'Problem Age Band Field',
            type:'string', defaultValue:'', expression:'optional'
          },
          ageNew:{
            ref:'props.ageNew', label:'New (0-7 Days)',
            type:'string', defaultValue:'', expression:'always'
          },
          age8to30:{
            ref:'props.age8to30', label:'8-30 Days',
            type:'string', defaultValue:'', expression:'always'
          },
          age31to90:{
            ref:'props.age31to90', label:'31-90 Days',
            type:'string', defaultValue:'', expression:'always'
          },
          ageOver90:{
            ref:'props.ageOver90', label:'Over 90 Days',
            type:'string', defaultValue:'', expression:'always'
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
                qInfo:{qId:'ITILPrbSheetPicker',qType:'SheetList'},
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
      keyword:'ITIL', mainLabel:'Open Problems', openProblemCount:'',
      statusDimension:'',
      categoryDimension:'',
      ageBandField:'', ageNew:'', age8to30:'', age31to90:'', ageOver90:'',
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

      // Open Problem Count / Problem Status / Problem Category Dimension /
      // Problem Age Band Field are all expression:'optional' (Rule 2/3) so
      // we need getProperties() to read the raw text back out.
      return self.backendApi.model.getProperties().then(function (rawProps) {
        var rp = rawProps.props || {};

        var qid       = layout.qInfo.qId;
        var mainVal   = parseVal(p.openProblemCount);
        var keyword     = p.keyword    || 'ITIL';
        var mainLabel   = p.mainLabel  || 'Open Problems';
        var targetSheet = p.targetSheet || '';

        var navHTML = targetSheet
          ? '<div class="prb-nav" id="qd-prb-nav-'+qid+'">'+NAV_ARROW+'<span>DETAILS</span></div>'
          : '';

        $element.html([
          '<div class="prb-ext">',
          '<div class="prb-header">',
          '  <div class="prb-header-left">'+ITIL_ICON+'<span class="prb-keyword">'+keyword+'</span></div>',
          '  <span class="prb-title">PROBLEMS'+navHTML+'</span>',
          '</div>',
          '<div class="prb-grid">',

          /* Q1 — Problem Panel (magnifying-glass gauge) */
          '<div class="prb-q prb-q-gauge"><div class="prb-gauge-img-container">',
          '<div class="prb-gauge-svg-wrap">'+buildGaugeHTML()+'</div>',
          '<div class="prb-kpi-overlay">',
          '<div class="prb-main-number">'+mainVal+'</div>',
          '<div class="prb-main-label">'+mainLabel+'</div>',
          '</div></div></div>',

          /* Q2 — Status bar chart */
          '<div class="prb-q prb-q-status">',
          '<div class="prb-section-label">Status</div>',
          '<div class="prb-bars" id="qd-prb-status-'+qid+'"><div class="prb-status-placeholder">Loading…</div></div>',
          '</div>',

          /* Q3 — Top Problem Categories donut */
          '<div class="prb-q prb-q-category">',
          '<div class="prb-section-label">Top Problem Categories</div>',
          '<div class="prb-cat-inner" id="qd-prb-cat-'+qid+'"><div class="prb-cat-placeholder">Loading…</div></div>',
          '</div>',

          /* Q4 — Age Band grid */
          '<div class="prb-q prb-q-ageband">',
          '<div class="prb-section-label">Age Band</div>',
          '<div class="prb-ageband-rows" id="qd-prb-ageband-'+qid+'"><div class="prb-ageband-placeholder">Loading…</div></div>',
          '</div>',

          '</div></div>'
        ].join('\n'));

        if (targetSheet) {
          $element.find('#qd-prb-nav-'+qid).on('click',function(){qlik.navigation.gotoSheet(targetSheet);});
        }

        // ── Age Band grid — fixed 4 rows, each its own master-measure slot
        // (no session cube needed, same as ITILIncidents' Priority
        // Breakdown). Field is only used for click-to-select filtering.
        var ageBandField = plainFieldName(extractExpressionText(rp.ageBandField));
        var ageVals = [numVal(p.ageNew), numVal(p.age8to30), numVal(p.age31to90), numVal(p.ageOver90)];
        var ageRowsHTML = AGE_BANDS.map(function (b, i) {
          return '<div class="prb-ageband-row'+(ageBandField?' prb-clickable':'')+'" data-band-label="'+b.label+'">'+
                   '<span class="prb-ageband-badge" style="background:'+b.bg+';border-color:'+b.border+';color:'+b.color+'">'+b.label+'</span>'+
                   '<span class="prb-ageband-count" style="color:'+b.color+'">'+parseVal(ageVals[i])+'</span>'+
                 '</div>';
        }).join('');
        $element.find('#qd-prb-ageband-'+qid).html(ageRowsHTML);

        if (ageBandField) {
          $element.find('#qd-prb-ageband-'+qid+' .prb-ageband-row').on('click', function () {
            var bandLabel = $(this).attr('data-band-label');
            try { appRef.field(ageBandField).selectMatch(bandLabel, false); } catch (e) {}
          });
        }

        // Open Problem Count's raw expression (Rule 2/3) is reused as the
        // measure for BOTH the Status bars and the Category donut below —
        // neither section takes its own measure input, only a dimension.
        var mainMeasRaw = normalizeMeasureExpr(extractExpressionText(rp.openProblemCount));

        // ── Status bar chart — session cube, debounced 400ms (Rule 5/8) ────
        var statusDim  = normalizeFieldExpr(extractExpressionText(rp.statusDimension));
        var statusMeas = mainMeasRaw;
        var $status = $element.find('#qd-prb-status-'+qid);

        if (!statusDim || !statusMeas) {
          $status.html('<div class="prb-status-placeholder">Configure Problem Status &amp; Open Problem Count expression</div>');
        } else {
          var statusKey = statusDim + '|' + statusMeas;
          if (self._statusExprKey !== statusKey && self._statusCubeObj) {
            try { appRef.model.enigmaModel.destroySessionObject(self._statusCubeObj.id); } catch (e) {}
            self._statusCubeObj = null;
          }
          self._statusExprKey = statusKey;

          if (self._statusTimer) clearTimeout(self._statusTimer);
          self._statusTimer = setTimeout((function (dim, meas, $st, app) {
            return function () {
              var cubePromise = self._statusCubeObj
                ? Promise.resolve(self._statusCubeObj)
                : app.model.enigmaModel.createSessionObject({
                    qInfo: { qType: 'ITILPrbStatusCube' },
                    qHyperCubeDef: {
                      qDimensions: [{ qDef: { qFieldDefs: [dim] } }],
                      qMeasures:   [{ qDef: { qDef: meas } }],
                      qInitialDataFetch: [{ qWidth: 2, qHeight: 50 }],
                      qInterColumnSortOrder: [1, 0],
                      qSuppressMissing: true,
                      qSuppressZero: true
                    }
                  }).then(function (obj) { self._statusCubeObj = obj; return obj; });

              cubePromise.then(function (cubeObj) {
                return cubeObj.getLayout().then(function (cubeLayout) {
                  var pages  = (cubeLayout.qHyperCube && cubeLayout.qHyperCube.qDataPages) || [];
                  var matrix = (pages[0] && pages[0].qMatrix) || [];
                  var rows = matrix.map(function (row) {
                    var label = (row[0] && row[0].qText) || '';
                    var val   = (row[1] && row[1].qNum !== undefined && row[1].qNum !== 1e308) ? row[1].qNum : 0;
                    return { label: label, value: val };
                  }).filter(function (r) { return r.label; });
                  rows.sort(function (a, b) { return b.value - a.value; });

                  var maxVal = rows.reduce(function (m, r) { return Math.max(m, r.value); }, 0) || 1;
                  var html = rows.length
                    ? rows.map(function (r, i) {
                        var pct = Math.max(2, Math.round((r.value / maxVal) * 100));
                        return '<div class="prb-bar-row">'+
                                 '<span class="prb-bar-label">'+r.label+'</span>'+
                                 '<div class="prb-bar-track"><div class="prb-bar-fill" style="width:'+pct+'%;background:'+paletteColor(i)+'"></div></div>'+
                                 '<span class="prb-bar-value">'+parseVal(r.value)+'</span>'+
                               '</div>';
                      }).join('')
                    : '<div class="prb-status-placeholder">No problem status data</div>';
                  $st.html(html);
                });
              }).catch(function () {
                $st.html('<div class="prb-status-placeholder">Unable to load Problem Status data</div>');
              });
            };
          })(statusDim, statusMeas, $status, appRef), 400);
        }

        // ── Top Problem Categories donut — session cube, debounced 400ms ───
        // Reuses the Q1 Open Problem Count raw expression as its measure
        // (Dalton's call: "the first measure" — no separate expression
        // input for this section).
        var catDim      = normalizeFieldExpr(extractExpressionText(rp.categoryDimension));
        var catMeasRaw  = mainMeasRaw;
        var $cat = $element.find('#qd-prb-cat-'+qid);

        if (!catDim || !catMeasRaw) {
          $cat.html('<div class="prb-cat-placeholder">Configure Problem Category Dimension &amp; Open Problem Count expression</div>');
        } else {
          var catKey = catDim + '|' + catMeasRaw;
          if (self._catExprKey !== catKey && self._catCubeObj) {
            try { appRef.model.enigmaModel.destroySessionObject(self._catCubeObj.id); } catch (e) {}
            self._catCubeObj = null;
          }
          self._catExprKey = catKey;

          if (self._catTimer) clearTimeout(self._catTimer);
          self._catTimer = setTimeout((function (dim, meas, $ct, app) {
            return function () {
              var cubePromise = self._catCubeObj
                ? Promise.resolve(self._catCubeObj)
                : app.model.enigmaModel.createSessionObject({
                    qInfo: { qType: 'ITILPrbCategoryCube' },
                    qHyperCubeDef: {
                      qDimensions: [{ qDef: { qFieldDefs: [dim] } }],
                      qMeasures:   [{ qDef: { qDef: meas } }],
                      qInitialDataFetch: [{ qWidth: 2, qHeight: 50 }],
                      qInterColumnSortOrder: [1, 0],
                      qSuppressMissing: true,
                      qSuppressZero: true
                    }
                  }).then(function (obj) { self._catCubeObj = obj; return obj; });

              cubePromise.then(function (cubeObj) {
                return cubeObj.getLayout().then(function (cubeLayout) {
                  var pages  = (cubeLayout.qHyperCube && cubeLayout.qHyperCube.qDataPages) || [];
                  var matrix = (pages[0] && pages[0].qMatrix) || [];
                  var rows = matrix.map(function (row) {
                    var label = (row[0] && row[0].qText) || '';
                    var val   = (row[1] && row[1].qNum !== undefined && row[1].qNum !== 1e308) ? row[1].qNum : 0;
                    return { label: label, value: val };
                  }).filter(function (r) { return r.label; });
                  rows.sort(function (a, b) { return b.value - a.value; });

                  if (!rows.length) {
                    $ct.html('<div class="prb-cat-placeholder">No problem category data</div>');
                    return;
                  }

                  var segs = rows.map(function (r, i) { return { value: r.value, color: paletteColor(i) }; });
                  var legendHTML = rows.map(function (r, i) {
                    return '<div class="prb-legend-row"><span class="prb-legend-dot" style="background:'+paletteColor(i)+'"></span>'+
                           '<span class="prb-legend-label">'+r.label+'</span>'+
                           '<span class="prb-legend-count" style="color:'+paletteColor(i)+'">'+parseVal(r.value)+'</span></div>';
                  }).join('');

                  $ct.html(
                    '<div class="prb-donut-wrap">'+buildDonutSVG(segs)+'</div>'+
                    '<div class="prb-legend">'+legendHTML+'</div>'
                  );
                });
              }).catch(function () {
                $ct.html('<div class="prb-cat-placeholder">Unable to load Problem Category data</div>');
              });
            };
          })(catDim, catMeasRaw, $cat, appRef), 400);
        }
      }); // end getProperties().then()
    }
  };
});
