/* Can voice track Parkinson's disease? — chapters, charts and interactions.
   Every chart and every number bound with data-n comes from window.PD_DATA,
   which scripts/export.R writes to docs/data/data.js.

   The page opens on a click-through story (#story), then a set of chapters. One is on screen
   at a time; the URL hash names it. Four chapters start on a transition page (.cover).
   The Aims chapter holds four tabs (#aim1 to #aim4), and "Road not taken" is a drawer.
   Charts are drawn when their chapter opens and play a short entrance when they
   scroll into view. With "reduce motion" on, everything appears in its final state. */
(function () {
  'use strict';

  var D = window.PD_DATA;
  if (!D || !window.d3) { return; }
  document.documentElement.classList.add('js');

  var C = {
    bg: '#F7F5F0', panel: '#ECE8DF', ink: '#1C2430', soft: '#3F4856', muted: '#636B78',
    grid: '#E6E2D9', axis: '#C9C4B8', blue: '#2A78D6', orange: '#E5622D', red: '#D6453D',
    grey: '#B3AFA6', teal: '#1F8A7E', amber: '#D99A1E', paleBlue: '#9DBDE6', train: '#D3CFC5'
  };
  var PROG = { Worsened: C.red, Stable: C.grey, Improved: C.blue };
  var SEX = { Male: C.teal, Female: C.amber };
  var SCHEME = { 'Random rows': C.blue, 'New person': C.orange };
  var GROUP = { Healthy: C.blue, PD: C.orange };

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DUR = reduceMotion ? 0 : 550;
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var narrow = function () { return window.innerWidth < 640; };

  var comma = d3.format(',');
  var fx = function (v, d) { return Math.abs(v).toFixed(d); };
  var sgn = function (v, d) { return (v < 0 ? '−' : '+') + Math.abs(v).toFixed(d); };
  var num = function (v, d) { return (v < 0 ? '−' : '') + Math.abs(v).toFixed(d); };
  var cap = function (s) { return s.charAt(0).toUpperCase() + s.slice(1); };

  /* ------------------------------------------------------------------ tooltip */
  var tipEl = $('#tooltip');
  var tip = {
    show: function (html, ev) {
      tipEl.innerHTML = html;
      tipEl.classList.add('show');
      var r = tipEl.getBoundingClientRect();
      var x = ev.clientX + 14, y = ev.clientY + 14;
      if (x + r.width > window.innerWidth - 8) { x = ev.clientX - r.width - 14; }
      if (y + r.height > window.innerHeight - 8) { y = ev.clientY - r.height - 14; }
      tipEl.style.left = Math.max(8, x) + 'px';
      tipEl.style.top = Math.max(8, y) + 'px';
    },
    hide: function () { tipEl.classList.remove('show'); }
  };
  function hover(sel, html) {
    sel.on('pointerenter pointermove', function (ev, d) { this.classList.add('hot'); tip.show(html(d), ev); })
       .on('pointerleave pointercancel', function () { this.classList.remove('hot'); tip.hide(); });
  }
  window.addEventListener('scroll', tip.hide, { passive: true });

  /* ------------------------------------------------------------------ lookups */
  var W = D.wrangling, A1 = D.aim1, A2 = D.aim2, A3 = D.aim3, A4 = D.aim4, P = D.people;
  var byId = new Map(P.map(function (p) { return [p.subject, p]; }));

  function eff(outcome, score, part) {
    return A1.effects.find(function (e) { return e.outcome === outcome && e.score === score && e.part === part; });
  }
  function coef(model, term) {
    return A2[model].coefficients.find(function (c) { return c.term === term; });
  }
  function mae(outcome, scheme, model) {
    return A3.errors.find(function (e) { return e.outcome === outcome && e.scheme === scheme && e.model === model; });
  }
  function a4(score) { return A4.tests.find(function (t) { return t.score === score + '_score'; }); }
  function a4o(score) { return A4.overlap.find(function (t) { return t.score === score + '_score'; }); }
  function prog(name) { return A2.progression.find(function (g) { return g.progression === name; }); }
  function sexRow(s) { return A2.sex_means.find(function (g) { return g.sex === s; }); }

  /* ------------------------------------------------------------------ numbers in the text */
  var N = {}, EG = 15;   // EG: the person used as the example in the opening story
  (function buildNumbers() {
    var q = W.quality, red = q.redundancy_max_abs_diff;
    N['pad.people'] = A1.n_people; N['pad.rows'] = comma(W.checks.pad.rows); N['pad.cols'] = W.checks.pad.cols;
    N['pad.rec_mean'] = Math.round(q.recordings_per_person.mean);
    N['pad.rec_min'] = q.recordings_per_person.min; N['pad.rec_max'] = q.recordings_per_person.max;
    N['pad.sessions'] = comma(q.home_sessions);
    N['puc.people'] = q.puc_file.people; N['puc.pd'] = q.puc_file.pd; N['puc.healthy'] = q.puc_file.healthy;
    N['puc.rows'] = W.checks.puc.rows; N['puc.cols'] = W.checks.puc.cols; N['puc.doc_people'] = q.puc_documentation.people;
    N['wr.missing'] = W.checks.pad.missing + W.checks.pad.duplicates + W.checks.puc.missing + W.checks.puc.duplicates;
    N['wr.neg'] = q.negative_time_rows;
    N['wr.redundancy'] = Math.max(red.pad_ddp_vs_3rap, red.pad_dda_vs_3apq3, red.puc_ddp_vs_3rap, red.puc_dda_vs_3apq3).toFixed(5);
    N['wr.dfa_pad'] = q.dfa_median.pad_pd.toFixed(3); N['wr.dfa_puc'] = q.dfa_median.puc_pd.toFixed(3);

    [['motor', 'Motor UPDRS'], ['total', 'Total UPDRS']].forEach(function (o) {
      var b = [], w = [];
      ['Jitter', 'Shimmer', 'Noise'].forEach(function (s) {
        var eb = eff(o[1], s, 'Between people'), ew = eff(o[1], s, 'Within a person');
        b.push(eb.estimate); w.push(Math.abs(ew.estimate));
        N['a1.' + o[0] + '.' + s.toLowerCase() + '.w_padj'] = ew.p_adj.toFixed(3);
      });
      N['a1.' + o[0] + '.b_min'] = d3.min(b).toFixed(1); N['a1.' + o[0] + '.b_max'] = d3.max(b).toFixed(1);
      N['a1.' + o[0] + '.w_min'] = d3.min(w).toFixed(2); N['a1.' + o[0] + '.w_max'] = d3.max(w).toFixed(2);
    });
    N['a1.nsig'] = A1.n_significant_after_bh;
    N['a1.icc_motor'] = Math.round(100 * A1.icc.motor) + '%';

    ['motor', 'total'].forEach(function (m) {
      var age = coef(m, 'age'), sex = coef(m, 'sexMale');
      N['a2.' + m + '.age10'] = sgn(10 * age.estimate, 1);
      N['a2.' + m + '.sex'] = sgn(sex.estimate, 1);
      N['a2.' + m + '.sex_p'] = sex.p.toFixed(2);
      N['a2.' + m + '.r2'] = A2[m].r_squared.toFixed(2);
    });
    N['a2.motor.age_p'] = coef('motor', 'age').p.toFixed(2);   // as on the slides
    N['a2.total.age_p'] = coef('total', 'age').p.toFixed(3);
    N['a2.n_worsened'] = prog('Worsened').n; N['a2.n_stable'] = prog('Stable').n; N['a2.n_improved'] = prog('Improved').n;
    N['a2.med_worsened'] = prog('Worsened').median_age; N['a2.med_stable'] = prog('Stable').median_age;
    N['a2.med_improved'] = prog('Improved').median_age;
    N['a2.n_men'] = sexRow('Male').n; N['a2.n_women'] = sexRow('Female').n;
    N['a2.mean_men'] = sexRow('Male').motor.toFixed(1); N['a2.mean_women'] = sexRow('Female').motor.toFixed(1);
    N['a2.ttest_p'] = A2.sex_ttest_motor.p.toFixed(2);
    N['a2.kw_p'] = A2.progression_kruskal.p.toFixed(2);
    ['jitter', 'shimmer', 'noise'].forEach(function (s) { N['a2.r_' + s] = A2.voice_age_r[s].toFixed(2); });

    [['motor', 'Motor UPDRS'], ['total', 'Total UPDRS']].forEach(function (o) {
      [['rand', 'Random rows'], ['new', 'New person']].forEach(function (s) {
        [['base', 'Mean baseline'], ['lm', 'Linear regression'], ['rf', 'Random forest']].forEach(function (m) {
          N['a3.' + o[0] + '.' + s[0] + '.' + m[0]] = mae(o[1], s[1], m[1]).mae.toFixed(2);
        });
      });
    });
    N['a3.min_share'] = Math.round(100 * A3.design.random_rows_min_share_of_person_in_training) + '%';

    ['jitter', 'shimmer', 'noise'].forEach(function (s) {
      N['a4.p_' + s] = a4(s).p_adjusted.toFixed(3);
      N['a4.overlap_' + s] = a4o(s).n_pd_within_healthy_range;
    });

    N['wr.n_measures'] = W.measures.length;
    N['story.eg_person'] = EG; N['story.eg_n'] = byId.get(EG).n_recordings;
    N['story.eg_sessions'] = D.sessions.subject.filter(function (v) { return v === EG; }).length;

    var check = [];
    $$('[data-n]').forEach(function (el) {
      var k = el.getAttribute('data-n');
      if (!(k in N)) { check.push({ key: k, fallback: el.textContent, value: null }); return; }
      check.push({ key: k, fallback: el.textContent, value: String(N[k]) });
      el.textContent = N[k];
    });
    window.PD_CHECK = check;   // used by the number check in the README
  })();

  /* ------------------------------------------------------------------ small builders */
  function makeTable(caption, cols, rows) {
    var wrap = document.createElement('div'); wrap.className = 'tablewrap';
    var t = document.createElement('table');
    var c = document.createElement('caption'); c.textContent = caption; t.appendChild(c);
    var thead = document.createElement('thead'), tr = document.createElement('tr');
    cols.forEach(function (col) { var th = document.createElement('th'); th.textContent = col.h; if (col.l) { th.className = 'l'; } tr.appendChild(th); });
    thead.appendChild(tr); t.appendChild(thead);
    var tb = document.createElement('tbody');
    rows.forEach(function (r) {
      var row = document.createElement('tr');
      cols.forEach(function (col) { var td = document.createElement('td'); td.textContent = col.f(r); if (col.l) { td.className = 'l'; } row.appendChild(td); });
      tb.appendChild(row);
    });
    t.appendChild(tb); wrap.appendChild(t); return wrap;
  }
  var pfmt = function (p) { return p < 0.001 ? '<0.001' : p.toFixed(3); };

  (function tables() {
    var t1 = $('[data-table="aim1"]');
    if (t1) {
      t1.appendChild(makeTable('Aim 1: UPDRS points per 1 SD worse voice score', [
        { h: 'Outcome', l: 1, f: function (r) { return r.outcome; } },
        { h: 'Score', l: 1, f: function (r) { return r.score; } },
        { h: 'Part', l: 1, f: function (r) { return r.part; } },
        { h: 'Estimate', f: function (r) { return num(r.estimate, 2); } },
        { h: '95% CI', f: function (r) { return num(r.lower, 2) + ' to ' + num(r.upper, 2); } },
        { h: 'df', f: function (r) { return r.df.toFixed(0); } },
        { h: 'p', f: function (r) { return pfmt(r.p); } },
        { h: 'BH-adjusted p', f: function (r) { return pfmt(r.p_adj); } }
      ], A1.effects));
    }
    var t2 = $('[data-table="aim2"]');
    if (t2) {
      var rows = [];
      ['motor', 'total'].forEach(function (m) {
        A2[m].coefficients.forEach(function (c) { rows.push(Object.assign({ model: 'Mean ' + m + ' UPDRS' }, c)); });
      });
      var termName = { '(Intercept)': 'Intercept', age: 'Age, per year', sexMale: 'Men vs women' };
      t2.appendChild(makeTable('Aim 2: linear regression, one row per person', [
        { h: 'Outcome', l: 1, f: function (r) { return r.model; } },
        { h: 'Term', l: 1, f: function (r) { return termName[r.term] || r.term; } },
        { h: 'Estimate', f: function (r) { return num(r.estimate, 3); } },
        { h: '95% CI', f: function (r) { return num(r.lower, 2) + ' to ' + num(r.upper, 2); } },
        { h: 't', f: function (r) { return num(r.t, 2); } },
        { h: 'p', f: function (r) { return pfmt(r.p); } }
      ], rows));
      t2.appendChild(makeTable('Between-person voice effect on mean motor UPDRS, before and after age and sex', [
        { h: 'Score', l: 1, f: function (r) { return cap(r.score); } },
        { h: 'Voice alone', f: function (r) { return num(r.crude, 2); } },
        { h: 'p', f: function (r) { return pfmt(r.crude_p); } },
        { h: 'With age and sex', f: function (r) { return num(r.adjusted, 2); } },
        { h: 'p', f: function (r) { return pfmt(r.adjusted_p); } }
      ], A2.voice_adjusted));
    }
    var t3 = $('[data-table="aim3"]');
    if (t3) {
      var order = ['Mean baseline', 'Linear regression', 'Random forest'];
      var r3 = A3.errors.slice().sort(function (a, b) {
        return d3.ascending(a.outcome, b.outcome) || d3.descending(a.scheme, b.scheme) || (order.indexOf(a.model) - order.indexOf(b.model));
      });
      t3.appendChild(makeTable('Aim 3: mean absolute error, UPDRS points', [
        { h: 'Outcome', l: 1, f: function (r) { return r.outcome; } },
        { h: 'Test design', l: 1, f: function (r) { return r.scheme; } },
        { h: 'Model', l: 1, f: function (r) { return r.model; } },
        { h: 'MAE', f: function (r) { return r.mae.toFixed(2); } },
        { h: 'Equal-person MAE', f: function (r) { return r.equal_person_mae.toFixed(2); } }
      ], r3));
    }
    var t4 = $('[data-table="aim4"]');
    if (t4) {
      t4.appendChild(makeTable('Aim 4: PD (n = 24) versus healthy (n = 8)', [
        { h: 'Score', l: 1, f: function (r) { return cap(r.score.replace('_score', '')); } },
        { h: 'Healthy median', f: function (r) { return num(r.healthy_median, 3); } },
        { h: 'PD median', f: function (r) { return num(r.pd_median, 3); } },
        { h: 'U', f: function (r) { return r.U; } },
        { h: 'p', f: function (r) { return r.p.toFixed(4); } },
        { h: 'BH-adjusted p', f: function (r) { return r.p_adjusted.toFixed(3); } },
        { h: 'Rank-biserial', f: function (r) { return num(r.rank_biserial, 3); } }
      ], A4.tests));
    }
  })();

  (function snippets() {
    $$('details.code[data-snippet]').forEach(function (el) {
      var s = D.snippets[el.getAttribute('data-snippet')];
      if (!s) { return; }
      var div = document.createElement('div');
      var pre = document.createElement('pre'), code = document.createElement('code');
      code.textContent = s.code; pre.appendChild(code); pre.tabIndex = 0;
      var p = document.createElement('p'); p.className = 'code-link';
      var a = document.createElement('a');
      a.href = D.meta.repo + '/blob/' + D.meta.branch + '/' + s.file + '?plain=1#L' + s.from + '-L' + s.to;
      a.textContent = s.file + ', lines ' + s.from + '–' + s.to + ', on GitHub';
      p.appendChild(a); div.appendChild(pre); div.appendChild(p); el.appendChild(div);
    });
    var bi = $('#build-info');
    if (bi) {
      bi.textContent = 'Data on this page was exported on ' + D.meta.generated + ' with ' + D.meta.r_version +
        ', lme4 ' + D.meta.packages.lme4 + ', lmerTest ' + D.meta.packages.lmerTest + ' and ranger ' + D.meta.packages.ranger + '.';
    }
  })();

  /* ------------------------------------------------------------------ state and segmented controls */
  var S = { outcome1: 'Motor UPDRS', ptscore: 'shimmer', outcome2: 'motor', cv: 'New person', outcome3: 'Motor UPDRS', forestStep: 0, maeStep: 0 };
  var listeners = {};
  function on(key, fn) { (listeners[key] = listeners[key] || []).push(fn); }
  function set(key, v) { if (S[key] === v) { return; } S[key] = v; (listeners[key] || []).forEach(function (fn) { fn(v); }); }
  $$('[data-seg]').forEach(function (seg) {
    var key = seg.getAttribute('data-seg'), btns = $$('button', seg);
    function paint() { btns.forEach(function (b) { var is = b.getAttribute('data-v') === S[key]; b.classList.toggle('on', is); b.setAttribute('aria-pressed', is); }); }
    btns.forEach(function (b) { b.addEventListener('click', function () { set(key, b.getAttribute('data-v')); paint(); }); });
    on(key, paint); paint();
  });

  /* ------------------------------------------------------------------ things that play when scrolled into view
     Each item belongs to a chapter. When the chapter opens, pre() puts it in its starting
     state; play() runs once it is on screen. final() is the no-motion version. */
  var items = [], chapterHooks = [];
  function onView(el, o) {
    var ch = el.closest('.chapter'), panel = el.closest('[role="tabpanel"]');
    var it = { el: el, ch: ch ? ch.id : null, panel: panel ? panel.id : null, drawer: el.closest('details.feature'),
               cover: !!el.closest('.cover'), pre: o.pre, play: o.play, final: o.final, resize: o.resize, entered: false };
    items.push(it); return it;
  }
  var INTRO = null;   // set while an entrance is playing, so transitions stagger
  function T(sel, anim) {
    if (!(anim && DUR)) { return sel; }
    var t = sel.transition().duration(INTRO ? INTRO.dur : DUR);
    if (INTRO) {
      var I = INTRO;
      t.delay(function (d, i) { var k = I.order ? I.order(d, i) : i; if (k == null || isNaN(k)) { k = i; } return Math.min(k * I.stagger, 1500); }).ease(d3.easeCubicOut);
    }
    return t;
  }
  // A chart whose render(anim) reads a "pre" flag for its starting state
  function chart(el, o) {
    var fin = function () { if (o.setPre) { o.setPre(false); } o.render(false); };
    return onView(el, {
      final: fin, resize: fin,
      pre: o.pre || function () { o.setPre(true); o.render(false); },
      play: o.play || function () { o.setPre(false); INTRO = { stagger: o.stagger || 40, dur: o.dur || 700, order: o.order }; o.render(true); INTRO = null; }
    });
  }
  function svgIn(el) { return d3.select(el).append('svg').attr('aria-hidden', 'true'); }
  function size(svg, w, h) { svg.attr('viewBox', '0 0 ' + w + ' ' + h).attr('width', w).attr('height', h); }
  function axisStyle(g) {
    g.select('.domain').remove();
    g.selectAll('line').attr('stroke', C.axis);
    g.selectAll('text').attr('fill', C.soft).attr('font-size', 12.5).attr('font-family', null);
  }
  function hashJitter(i, salt) { var x = Math.sin((i + 1) * 12.9898 + salt * 78.233) * 43758.5453; return (x - Math.floor(x)) - 0.5; }
  // marks tagged .mk fade in one after another
  function fadeMarks(svg, step) {
    return {
      pre: function () { svg.selectAll('.mk').attr('opacity', 0); },
      play: function () { svg.selectAll('.mk').transition().duration(450).delay(function (d, i) { return Math.min(i * step, 1400); }).attr('opacity', 1); }
    };
  }

  /* ------------------------------------------------------------------ count-up numbers and pull-quotes */
  $$('.count').forEach(function (el) {
    var finalText = el.textContent, m = /^(\D*?)(\d[\d,]*)(\.\d+)?(\D*)$/.exec(finalText.trim());
    if (!m) { return; }
    var target = parseFloat((m[2] + (m[3] || '')).replace(/,/g, '')), dec = m[3] ? m[3].length - 1 : 0, useComma = m[2].indexOf(',') >= 0;
    var fmt = function (v) { var s = v.toFixed(dec); if (useComma) { s = comma(+s); } return m[1] + s + m[4]; };
    var sr = document.createElement('span'); sr.className = 'sr-only'; sr.textContent = finalText;
    el.setAttribute('aria-hidden', 'true'); el.parentNode.insertBefore(sr, el.nextSibling);
    var timer = null;
    onView(el, {
      final: function () { el.textContent = finalText; },
      pre: function () { if (timer) { timer.stop(); } el.textContent = fmt(0); },
      play: function () {
        var dur = 1100;
        timer = d3.timer(function (e) {
          var t = Math.min(1, e / dur), k = d3.easeCubicOut(t);
          el.textContent = t < 1 ? fmt(target * k) : finalText;
          if (t >= 1) { timer.stop(); }
        });
      }
    });
  });
  (function aimMap() {
    var el = $('#aimmap'); if (!el) { return; }
    onView(el, { final: function () { el.classList.add('in'); }, pre: function () { el.classList.remove('in'); }, play: function () { el.classList.add('in'); } });
  })();
  $$('.pull').forEach(function (el) {
    onView(el, {
      final: function () { el.classList.add('in'); },
      pre: function () { el.classList.remove('in'); },
      play: function () { el.classList.add('in'); }
    });
  });

  /* ================================================================== 1. the "ahhh" */
  var guess = null;
  (function voice() {
    var holder = $('#voice-wave'); if (!holder) { return; }
    function rng(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
    function randn(r) { var u = 0; while (u === 0) { u = r(); } return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }
    // A vowel-like tone built one vocal-fold cycle at a time. Jitter changes each
    // cycle's length, shimmer its loudness, noise adds breath. Exaggerated on purpose.
    function synth(sr, dur, o) {
      var f0 = 118, n = Math.floor(sr * dur), out = new Float32Array(n), cycles = [];
      var rj = rng(11), rs = rng(23), rn = rng(47);
      var H = Math.min(26, Math.floor(sr / 2 / f0) - 1), amp = [], h, norm = 0;
      for (h = 1; h <= H; h++) {
        var f = h * f0;
        var a = Math.exp(-0.5 * Math.pow((f - 730) / 140, 2)) + 0.55 * Math.exp(-0.5 * Math.pow((f - 1090) / 170, 2)) +
                0.2 * Math.exp(-0.5 * Math.pow((f - 2440) / 240, 2)) + 0.3 / h;
        amp.push(a); norm += a;
      }
      norm *= 0.62;
      var i = 0;
      while (i < n) {
        var len = Math.max(8, Math.round((sr / f0) * (1 + (o.jitter ? 0.075 * randn(rj) : 0))));
        var A = Math.max(0.18, 1 + (o.shimmer ? 0.36 * randn(rs) : 0));
        cycles.push(i);
        for (var k = 0; k < len && i < n; k++, i++) {
          var ph = k / len, s = 0;
          for (h = 0; h < H; h++) { s += amp[h] * Math.sin(2 * Math.PI * (h + 1) * ph); }
          out[i] = A * s / norm;
        }
      }
      if (o.noise) { for (i = 0; i < n; i++) { out[i] += 0.2 * randn(rn); } }
      return { samples: out, cycles: cycles, n: n };
    }
    var opts = function () { return { jitter: $('#v-jitter').checked, shimmer: $('#v-shimmer').checked, noise: $('#v-noise').checked }; };

    // The picture: a window onto the signal that drifts along it, so the wave is always moving
    var cv = document.createElement('canvas'); holder.appendChild(cv);
    var SR = 9000, BUF = 3, SPEED = 0.0085;   // signal seconds shown per real second
    var cur = synth(SR, BUF, opts()), old = null, blend = 1, t0 = 0, last = null, raf = null, active = false;
    function at(buf, x) { var i = Math.floor(x), f = x - i, s = buf.samples; return i + 1 < buf.n ? s[i] * (1 - f) + s[i + 1] * f : s[buf.n - 1]; }
    function paint() {
      var w = holder.clientWidth, h = holder.clientHeight || 170, dpr = window.devicePixelRatio || 1;
      if (!w) { return; }
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      var c = cv.getContext('2d'), win = narrow() ? 0.075 : 0.15, mid = (h - 14) / 2 + 2, scale = (h - 22) / 4.3;
      c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
      c.beginPath();
      for (var px = 0; px <= w; px += 1) {
        var x = (t0 + px / w * win) * SR, v = at(cur, x);
        if (old && blend < 1) { v = v * blend + at(old, x) * (1 - blend); }
        var y = mid - v * scale;
        if (px === 0) { c.moveTo(px, y); } else { c.lineTo(px, y); }
      }
      c.lineWidth = 2; c.lineJoin = 'round'; c.strokeStyle = C.bg; c.stroke();
      c.fillStyle = C.orange;
      var a = t0 * SR, b = (t0 + win) * SR;
      for (var i = 0; i < cur.cycles.length; i++) {
        var s = cur.cycles[i]; if (s < a) { continue; } if (s > b) { break; }
        c.fillRect((s - a) / (b - a) * w - 1, h - 10, 2.5, 10);
      }
    }
    function frame(now) {
      raf = null;
      if (!active) { return; }
      var dt = last == null ? 0 : Math.min(0.05, (now - last) / 1000); last = now;
      t0 += dt * SPEED; if (t0 > BUF - 0.2) { t0 = 0; }
      if (blend < 1) { blend = Math.min(1, blend + dt / 0.45); if (blend >= 1) { old = null; } }
      paint();
      raf = requestAnimationFrame(frame);
    }
    function run(on) {
      active = on && !reduceMotion && !document.hidden;
      if (active && !raf) { last = null; raf = requestAnimationFrame(frame); }
      if (!active) { paint(); }
    }
    chapterHooks.push(function (id) { run(id === 'question'); });
    document.addEventListener('visibilitychange', function () { run(current && current.id === 'question'); });
    window.addEventListener('resize', paint);

    // The sound
    var ctx = null, src = null, btn = $('#voice-play');
    function stop() { if (src) { try { src.onended = null; src.stop(); } catch (e) { /* already stopped */ } src = null; } btn.setAttribute('aria-pressed', 'false'); btn.textContent = 'Play the “ahhh”'; }
    function play() {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { btn.disabled = true; btn.textContent = 'Sound not supported'; return; }
      try {
        ctx = ctx || new AC(); if (ctx.state === 'suspended') { ctx.resume(); }
        var dur = 1.7, v = synth(ctx.sampleRate, dur, opts()), buf = ctx.createBuffer(1, v.n, ctx.sampleRate), ch = buf.getChannelData(0);
        var fade = Math.floor(0.07 * ctx.sampleRate);
        for (var i = 0; i < v.n; i++) { var g = Math.min(1, i / fade, (v.n - 1 - i) / fade); ch[i] = 0.22 * g * v.samples[i]; }
        if (src) { src.onended = null; try { src.stop(); } catch (e) { /* ignore */ } }
        src = ctx.createBufferSource(); src.buffer = buf; src.connect(ctx.destination); src.onended = stop; src.start();
        btn.setAttribute('aria-pressed', 'true'); btn.textContent = 'Stop';
      } catch (e) { btn.disabled = true; btn.textContent = 'Sound not available'; }
    }
    btn.addEventListener('click', function () { if (btn.getAttribute('aria-pressed') === 'true') { stop(); } else { play(); } });
    ['#v-jitter', '#v-shimmer', '#v-noise'].forEach(function (id) {
      $(id).addEventListener('change', function () {
        old = reduceMotion ? null : cur; cur = synth(SR, BUF, opts()); blend = reduceMotion ? 1 : 0;
        if (!active) { paint(); }
        if (btn.getAttribute('aria-pressed') === 'true') { play(); }
      });
    });
    chapterHooks.push(function (id) { if (id !== 'question') { stop(); } });

    // The guess: kept in a variable (and for this visit, in the browser) and paid off in the last chapter
    var btns = $$('#guess [data-guess]'), note = $('#guess-note');
    function paintGuess(say) {
      btns.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-guess') === guess); });
      if (guess && note && say) { note.textContent = 'Locked in: ' + guess + '. We will come back to it at the end.'; }
    }
    try { var saved = window.sessionStorage.getItem('pd-guess'); if (saved === 'Yes' || saved === 'No' || saved === 'Partly') { guess = saved; } } catch (e) { /* storage not available */ }
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        guess = b.getAttribute('data-guess');
        try { window.sessionStorage.setItem('pd-guess', guess); } catch (e) { /* fine without it */ }
        paintGuess(true);
      });
    });
    paintGuess(true);
    var you = $('#payoff-you');
    var lines = {
      Yes: 'You guessed <b>Yes</b><br>The data was less kind than that.',
      No: 'You guessed <b>No</b><br>For replacing the exam, this data is on your side, but voice is not empty.',
      Partly: 'You guessed <b>Partly</b><br>That is close to what this data shows.'
    };
    var noGuess = you ? you.innerHTML : '';
    chapterHooks.push(function (id) { if (id === 'conclusion' && you) { you.innerHTML = guess ? lines[guess] : noGuess; } });
  })();

  /* ================================================================== 2. the two studies */
  (function studies() {
    var elA = $('#fig-pad-people'), elB = $('#fig-puc-people'); if (!elA || !elB) { return; }
    var pad = P.map(function (p) { return { id: 'Person ' + p.subject, n: p.n_recordings, group: 'PD' }; });
    var puc = A4.people.slice().sort(function (a, b) { return d3.descending(a.group, b.group) || d3.ascending(a.subject, b.subject); })
      .map(function (p) { return { id: 'Oxford ' + p.subject, n: p.n_recordings, group: p.group }; });
    var svgA = svgIn(elA), svgB = svgIn(elB), cols = 14, maxN = d3.max(pad, function (d) { return d.n; }), r = null;
    function draw() {
      var w = Math.min(elA.clientWidth, elB.clientWidth), cell = Math.min(31, w / cols), R = cell / 2 - 1.2;
      r = d3.scaleSqrt([0, maxN], [0, R]);
      [[svgA, pad], [svgB, puc]].forEach(function (pair) {
        var svg = pair[0], data = pair[1];
        size(svg, cols * cell, 3 * cell);
        var g = svg.selectAll('g.p').data(data).join(function (en) {
          var e = en.append('g').attr('class', 'p'); e.append('rect').attr('fill', 'transparent'); e.append('circle'); return e;
        }).attr('transform', function (d, i) { return 'translate(' + ((i % cols) * cell) + ',' + (Math.floor(i / cols) * cell) + ')'; });
        g.select('rect').attr('width', cell).attr('height', cell);
        g.select('circle').interrupt().attr('cx', cell / 2).attr('cy', cell / 2).attr('r', function (d) { return r(d.n); })
          .attr('fill', function (d) { return GROUP[d.group]; });
        hover(g, function (d) { return '<b>' + d.id + '</b><br>' + d.n + ' recordings<br><span class="dim">' + (d.group === 'PD' ? 'Has Parkinson’s' : 'Healthy') + '</span>'; });
      });
    }
    function both() { return d3.selectAll([svgA.node(), svgB.node()]).selectAll('circle'); }
    onView(elA, {
      final: draw, resize: draw,
      pre: function () { draw(); both().attr('r', 0); },
      play: function () { both().transition().duration(520).delay(function (d, i) { return i * 16; }).ease(d3.easeBackOut.overshoot(1.6)).attr('r', function (d) { return r(d.n); }); }
    });
  })();

  /* ================================================================== 2b. road not taken: the reveal */
  (function race() {
    var root = $('#race'); if (!root) { return; }
    var lanes = $$('.lane', root).map(function (el) {
      var b = $('.val b', el); return { el: el, bar: $('.bar', el), num: b, text: b.textContent, v: +el.getAttribute('data-v') };
    });
    var scale = 10, win = d3.min(lanes, function (l) { return l.v; }), timers = [];
    $('.misses', root).style.setProperty('--mark', (win / scale * 100) + '%');
    lanes.forEach(function (l) { l.bar.style.setProperty('--over', (l.v > win ? (l.v - win) / l.v * 100 : 0) + '%'); });
    function clear() { timers.forEach(function (t) { if (t.stop) { t.stop(); } else { clearTimeout(t); } }); timers = []; }
    function finalState() { clear(); lanes.forEach(function (l) { l.bar.style.width = (l.v / scale * 100) + '%'; l.num.textContent = l.text; }); root.classList.add('done'); }
    function reset() { clear(); root.classList.remove('done'); lanes.forEach(function (l) { l.bar.style.width = '0%'; l.num.textContent = (0).toFixed(1); }); }
    function grow(l, done) {
      var dur = l.v * 115;   // every bar grows at the same speed, so a smaller miss stops sooner
      var tm = d3.timer(function (e) {
        var k = Math.min(1, e / dur);
        l.bar.style.width = (l.v * k / scale * 100) + '%';
        l.num.textContent = k < 1 ? (l.v * k).toFixed(1) : l.text;
        if (k >= 1) { tm.stop(); if (done) { done(); } }
      });
      timers.push(tm);
    }
    function play() {
      reset();
      grow(lanes[0]);
      timers.push(setTimeout(function () { grow(lanes[1]); }, 550));
      timers.push(setTimeout(function () { grow(lanes[2], function () { timers.push(setTimeout(function () { root.classList.add('done'); }, 250)); }); }, 2100));
    }
    $('#race-replay').addEventListener('click', function () { if (reduceMotion) { finalState(); } else { play(); } });
    onView(root, { final: finalState, pre: reset, play: play });
  })();

  /* ================================================================== 3. wrangling stepper */
  (function wrangle() {
    var root = $('#wrangle'); if (!root) { return; }
    var titles = ['Check', 'Rename', 'Drop', 'Keep', 'Scores', 'Split', 'People'];
    var famName = { id: 'Who', context: 'Context', outcome: 'UPDRS', jitter: 'Jitter', shimmer: 'Shimmer', noise: 'Noise', other: 'Other', scores: 'New scores', split: 'Usual / today', derived: 'New' };
    var famOrder = ['id', 'context', 'jitter', 'shimmer', 'noise', 'outcome', 'other', 'scores', 'split', 'derived'];
    var voiceFam = { jitter: 1, shimmer: 1, noise: 1 };
    var shapeKey = ['raw', 'raw', 'cleaned', 'cleaned', 'scored', 'split', 'people'];
    var step = 0, prevShape = {};

    function state(which, st) {
      var cols = W[which + '_columns'], chips = [], reasons = null, note = '', code, shape;
      var label = which === 'pad' ? 'Home study' : 'Oxford study';
      if (st <= 5) {
        cols.forEach(function (c) {
          var kept = c.action === 'keep';
          if (!kept && st >= 3) { return; }
          var cls = '';
          if (!kept && st === 2) { cls = 'dropped'; }
          else if (kept && st === 1 && c.new !== c.raw) { cls = 'renamed'; }
          else if (kept && st === 3 && voiceFam[c.family]) { cls = 'hl'; }
          chips.push({ text: (st >= 1 && kept) ? c.new : c.raw, family: c.family, cls: cls, title: kept ? 'Raw name: ' + c.raw : (c.reason || '') });
        });
        if (st >= 4) { W.new_columns.scores.forEach(function (s) { chips.push({ text: s, family: 'scores', cls: st === 4 ? 'new' : '' }); }); }
        if (st >= 5 && which === 'pad') { W.new_columns.split.forEach(function (s) { chips.push({ text: s, family: 'split', cls: 'new' }); }); }
        if (st === 2) {
          var groups = d3.group(cols.filter(function (c) { return c.action === 'drop'; }), function (c) { return c.reason; });
          reasons = Array.from(groups, function (kv) { return { reason: kv[0], n: kv[1].length }; });
        }
        if (st === 5 && which === 'puc') { note = 'Unchanged. The split is only needed for the home study, which follows people over time.'; }
        if (st === 1) { note = 'Tinted columns were renamed.'; }
        if (st === 3) { note = 'Dark columns are the 11 shared voice measures.'; }
        code = which + (st <= 1 ? '.df' : '_clean');
        shape = W.shapes[shapeKey[st]][which];
      } else {
        if (which === 'pad') {
          var fam = { subject: 'id', age: 'context', sex: 'context', progression: 'derived' };
          W.new_columns.people.forEach(function (s) { chips.push({ text: s, family: fam[s] || 'outcome', cls: (s === 'progression' || s === 'motor_change') ? 'new' : '' }); });
          code = 'pad_people'; shape = W.shapes.people.pad_people; note = 'One row per person, for Aim 2.';
        } else {
          chips = [{ text: 'subject', family: 'id', cls: '' }, { text: 'group', family: 'context', cls: '' }]
            .concat(W.new_columns.scores.map(function (s) { return { text: s, family: 'scores', cls: '' }; }));
          code = 'puc_people'; shape = W.shapes.people.puc_people; note = 'One row per person, for Aim 4. Built in the Aims 3 and 4 script by averaging each person’s recordings.';
        }
      }
      return { label: label, code: code, shape: shape, chips: chips, reasons: reasons, note: note };
    }

    function tableEl(which, st) {
      var s = state(which, st), box = document.createElement('div'); box.className = 'tbl';
      var prev = prevShape[which] || s.shape, before = st > 0 ? state(which, st - 1).shape : s.shape;   // change since the step before, wherever the reader came from
      var dc = s.shape[1] - before[1], dr = s.shape[0] - before[0];
      var delta = dr !== 0 ? 'one row per person' : (dc !== 0 ? (dc > 0 ? '+' : '−') + Math.abs(dc) + ' columns' : '');
      box.innerHTML = '<div class="tbl-head"><span class="tbl-name">' + s.label + '<code>' + s.code + '</code></span>' +
        '<span class="tbl-shape"><b class="r">' + comma(prev[0]) + '</b> rows × <b class="c">' + prev[1] + '</b> columns<span class="delta">' + delta + '</span></span></div>';
      var k = 0;
      famOrder.forEach(function (f) {
        var cs = s.chips.filter(function (c) { return c.family === f; }); if (!cs.length) { return; }
        var row = document.createElement('div'); row.className = 'fam';
        var nm = document.createElement('span'); nm.className = 'fam-name'; nm.textContent = famName[f]; row.appendChild(nm);
        var wrap = document.createElement('span'); wrap.className = 'chips';
        cs.forEach(function (c) {
          var ch = document.createElement('span'); ch.className = 'chip ' + c.cls; ch.textContent = c.text; if (c.title) { ch.title = c.title; }
          if (c.cls) { ch.style.animationDelay = (k++ * 35) + 'ms'; }
          wrap.appendChild(ch);
        });
        row.appendChild(wrap); box.appendChild(row);
      });
      if (s.reasons) {
        var ul = document.createElement('ul'); ul.className = 'reasons';
        s.reasons.forEach(function (r) { var li = document.createElement('li'); li.innerHTML = '<b>' + r.n + ' dropped.</b> ' + r.reason + '.'; ul.appendChild(li); });
        box.appendChild(ul);
      }
      var np = document.createElement('p'); np.className = 'tbl-note'; np.textContent = s.note; box.appendChild(np);
      // count the shape up or down
      [['.r', 0], ['.c', 1]].forEach(function (q) {
        var node = box.querySelector(q[0]), a = prev[q[1]], b = s.shape[q[1]];
        if (a === b || !DUR) { node.textContent = comma(b); return; }
        d3.select(node).transition().duration(800).tween('text', function () { var it = d3.interpolateRound(a, b); return function (t) { node.textContent = comma(it(t)); }; });
      });
      prevShape[which] = s.shape;
      return box;
    }

    function peopleDots() {
      var el = $('#wr-people'); if (!el) { return; }
      el.innerHTML = '';
      var w = el.clientWidth || 600, groups = ['Worsened', 'Stable', 'Improved'], r = 6, gap = 16, rowH = 26, labW = 118;
      var svg = svgIn(el); size(svg, w, rowH * 3 + 6);
      groups.forEach(function (gname, gi) {
        var ppl = P.filter(function (p) { return p.progression === gname; }).sort(function (a, b) { return d3.descending(a.motor_change, b.motor_change); });
        var g = svg.append('g').attr('transform', 'translate(0,' + (gi * rowH + 16) + ')');
        g.append('text').attr('x', 0).attr('y', 4.5).attr('font-size', 13.5).style('fill', C.ink).text(ppl.length + ' ' + gname.toLowerCase());
        var step2 = Math.min(gap, (w - labW - r) / Math.max(1, ppl.length - 1));
        var dots = g.selectAll('circle').data(ppl).join('circle').attr('cx', function (d, i) { return labW + i * step2; }).attr('cy', 0)
          .attr('fill', PROG[gname]).attr('stroke', C.bg).attr('stroke-width', 1.5);
        if (DUR) { dots.attr('r', 0).transition().duration(380).delay(function (d, i) { return gi * 120 + i * 22; }).ease(d3.easeBackOut).attr('r', r); } else { dots.attr('r', r); }
        hover(dots, function (d) { return '<b>Person ' + d.subject + '</b><br>Motor UPDRS ' + sgn(d.motor_change, 1) + ' points'; });
      });
    }

    var dots = $('#wr-dots'), prevBtn = $('#wr-prev'), nextBtn = $('#wr-next'), tables = $('#wr-tables');
    titles.forEach(function (t, i) {
      var li = document.createElement('li'), b = document.createElement('button');
      b.type = 'button'; b.innerHTML = (i + 1) + '<span class="t">' + t + '</span>'; b.setAttribute('aria-label', 'Step ' + (i + 1) + ': ' + t);
      b.addEventListener('click', function () { go(i); }); li.appendChild(b); dots.appendChild(li);
    });
    function go(i) {
      step = Math.max(0, Math.min(titles.length - 1, i));
      $$('.wr-step', root).forEach(function (el) { el.classList.toggle('on', +el.getAttribute('data-step') === step); });
      $$('button', dots).forEach(function (b, j) { b.classList.toggle('on', j === step); b.classList.toggle('done', j < step); if (j === step) { b.setAttribute('aria-current', 'step'); } else { b.removeAttribute('aria-current'); } });
      prevBtn.disabled = step === 0; nextBtn.disabled = step === titles.length - 1;
      nextBtn.textContent = step === titles.length - 1 ? 'Done' : (narrow() ? 'Next' : 'Next: ' + titles[step + 1]);
      tables.innerHTML = ''; tables.appendChild(tableEl('pad', step)); tables.appendChild(tableEl('puc', step));
      if (step === 6) { peopleDots(); }
    }
    prevBtn.addEventListener('click', function () { go(step - 1); });
    nextBtn.addEventListener('click', function () { go(step + 1); });
    root.addEventListener('keydown', function (ev) {
      if (ev.target.closest('details')) { return; }
      if (ev.key === 'ArrowRight') { go(step + 1); ev.preventDefault(); }
      if (ev.key === 'ArrowLeft') { go(step - 1); ev.preventDefault(); }
    });
    go(0);
    onView(root, { final: function () {}, pre: function () {}, play: function () {}, resize: function () { if (step === 6) { peopleDots(); } } });
  })();

  /* ================================================================== 4. Aim 1 forest plot */
  var forestRender = (function forest() {
    var el = $('#fig-forest'); if (!el) { return function () {}; }
    var svg = svgIn(el), gGrid = svg.append('g'), gAxis = svg.append('g'), gZero = svg.append('line'), gY = svg.append('g');
    var clipId = 'forest-clip', clip = svg.append('clipPath').attr('id', clipId).append('rect');
    var gMarks = svg.append('g').attr('clip-path', 'url(#' + clipId + ')'), gLab = svg.append('g'), note = svg.append('text');
    var scores = ['Jitter', 'Shimmer', 'Noise'], parts = ['Between people', 'Within a person'];
    var all = A1.effects, col = { 'Between people': C.blue, 'Within a person': C.orange }, PRE = false;
    var wide = [Math.min(-2, d3.min(all, function (d) { return d.lower; }) - 0.4), d3.max(all, function (d) { return d.upper; }) + 0.4];
    var win = all.filter(function (d) { return d.part === 'Within a person'; });
    var zoom = [d3.min(win, function (d) { return d.lower; }) - 0.03, Math.max(0.06, d3.max(win, function (d) { return d.upper; }) + 0.03)];

    function render(anim) {
      var w = el.clientWidth, sm = narrow(), h = sm ? 250 : 344, m = { t: 24, r: sm ? 44 : 56, b: 30, l: sm ? 62 : 76 };
      size(svg, w, h);
      var iw = w - m.l - m.r, ih = h - m.t - m.b, st = S.forestStep;
      var x = d3.scaleLinear(st === 2 ? zoom : wide, [m.l, m.l + iw]);
      var xe = function (v) { return PRE ? x(0) : x(v); };
      var y = d3.scaleBand(scores, [m.t, m.t + ih]).paddingInner(0.1), off = y.bandwidth() * 0.19;
      var data = all.filter(function (d) { return d.outcome === S.outcome1; });
      clip.attr('x', m.l - 8).attr('y', 0).attr('width', iw + 16).attr('height', h);

      var ticks = x.ticks(sm ? 5 : 7);
      var gl = gGrid.selectAll('line').data(ticks, function (d) { return d; });
      gl.exit().remove();
      gl.enter().append('line').attr('stroke', C.grid).attr('x1', x).attr('x2', x).merge(gl)
        .transition().duration(anim && DUR && !INTRO ? DUR : 0).attr('x1', x).attr('x2', x).attr('y1', m.t).attr('y2', m.t + ih);
      gAxis.attr('transform', 'translate(0,' + (m.t + ih) + ')').transition().duration(anim && DUR && !INTRO ? DUR : 0)
        .call(d3.axisBottom(x).tickValues(ticks).tickSize(0).tickPadding(9).tickFormat(function (v) { return v === 0 ? '0' : sgn(v, st === 2 ? 2 : 0); }))
        .call(axisStyle);
      gZero.attr('stroke', C.muted).attr('stroke-width', 1.4).transition().duration(anim && DUR && !INTRO ? DUR : 0)
        .attr('x1', x(0)).attr('x2', x(0)).attr('y1', m.t).attr('y2', m.t + ih);

      gY.selectAll('text').data(scores).join('text').attr('x', 0).attr('y', function (d) { return y(d) + y.bandwidth() / 2; })
        .attr('dy', '0.35em').attr('font-size', sm ? 14 : 15.5).attr('font-weight', 600).style('fill', C.ink).text(function (d) { return d; });

      var yy = function (d) { return y(d.score) + y.bandwidth() / 2 + (d.part === parts[0] ? -off : off); };
      var vis = function (d) { if (PRE) { return 0; } return d.part === parts[1] ? (st === 0 ? 0 : 1) : (st === 2 ? 0.2 : 1); };
      var key = function (d) { return d.score + d.part; };

      var g = gMarks.selectAll('g.m').data(data, key).join(function (en) {
        var e = en.append('g').attr('class', 'm').attr('opacity', vis);
        e.append('line').attr('class', 'ci').attr('stroke-linecap', 'round');
        e.append('circle').attr('r', sm ? 6 : 7).attr('stroke', C.bg).attr('stroke-width', 2);
        e.append('line').attr('class', 'hit').attr('stroke', 'transparent').attr('stroke-width', 26);
        return e;
      });
      T(g, anim).attr('opacity', vis);
      g.style('pointer-events', function (d) { return vis(d) ? null : 'none'; });
      T(g.select('.ci').attr('stroke', function (d) { return col[d.part]; }).attr('stroke-width', sm ? 3 : 3.5), anim)
        .attr('x1', function (d) { return xe(d.lower); }).attr('x2', function (d) { return xe(d.upper); }).attr('y1', yy).attr('y2', yy);
      T(g.select('circle').attr('fill', function (d) { return col[d.part]; }), anim).attr('cx', function (d) { return xe(d.estimate); }).attr('cy', yy);
      g.select('.hit').attr('x1', function (d) { return x(d.lower) - 6; }).attr('x2', function (d) { return x(d.upper) + 6; }).attr('y1', yy).attr('y2', yy);
      hover(g, function (d) {
        return '<b>' + d.score + ', ' + d.part.toLowerCase() + '</b><br>' + sgn(d.estimate, 2) + ' ' + d.outcome.split(' ')[0].toLowerCase() +
          ' points per SD<br><span class="dim">95% CI ' + num(d.lower, 2) + ' to ' + num(d.upper, 2) + '<br>p = ' + pfmt(d.p) + ', adjusted p = ' + pfmt(d.p_adj) + '</span>';
      });

      var lab = gLab.selectAll('text').data(data, key).join(function (en) { return en.append('text').attr('font-size', sm ? 12.5 : 13.5).attr('dy', '0.35em').attr('opacity', 0); });
      lab.text(function (d) { return sgn(d.estimate, d.part === parts[0] ? 1 : 2); });
      T(lab, anim).attr('x', function (d) { return Math.min(xe(d.upper) + 9, w - 2); }).attr('y', yy)
        .attr('text-anchor', function (d) { return x(d.upper) + 9 > w - 34 ? 'end' : 'start'; })
        .attr('opacity', function (d) { return (st === 2 && d.part === parts[0]) ? 0 : vis(d); });

      note.attr('x', m.l + iw).attr('y', 13).attr('text-anchor', 'end').attr('font-size', 12.5).style('fill', C.muted)
        .text(sm ? 'Blue dots are off the chart →' : 'Zoomed in. The blue dots are off the chart to the right →');
      note.transition().duration(anim && DUR ? DUR : 0).attr('opacity', st === 2 ? 1 : 0);
    }
    on('outcome1', function () { PRE = false; render(true); });
    chart(el, { render: render, setPre: function (v) { PRE = v; }, stagger: 110, dur: 800 });
    return render;
  })();

  /* ================================================================== 4b. patient picker */
  (function patient() {
    var el = $('#fig-patient'); if (!el) { return; }
    var R = D.recordings, SS = D.sessions, recIdx = new Map(), sesIdx = new Map();
    R.subject.forEach(function (s, i) { if (!recIdx.has(s)) { recIdx.set(s, []); } recIdx.get(s).push(i); });
    SS.subject.forEach(function (s, i) { if (!sesIdx.has(s)) { sesIdx.set(s, []); } sesIdx.get(s).push(i); });
    var rho = new Map(A1.within_rho.map(function (r) { return [r.subject + '|' + r.score.toLowerCase(), r.rho]; }));
    var ids = P.map(function (p) { return p.subject; });
    var medRho = {}; A1.within_rho_median.forEach(function (r) { medRho[r.score.toLowerCase()] = r.median; });
    // Same example person as the slides: the middle of the "worsened" group
    var worse = P.filter(function (p) { return p.progression === 'Worsened'; }).sort(function (a, b) { return d3.ascending(a.motor_change, b.motor_change); });
    var current1 = worse[Math.ceil(worse.length / 2) - 1].subject;

    var sel = $('#pt-select');
    P.forEach(function (p) { var o = document.createElement('option'); o.value = p.subject; o.textContent = 'Person ' + p.subject; sel.appendChild(o); });
    sel.value = current1;
    sel.addEventListener('change', function () { current1 = +sel.value; render(true); sweep(700); });
    function shift(k) { var i = (ids.indexOf(current1) + k + ids.length) % ids.length; current1 = ids[i]; sel.value = current1; render(true); sweep(700); }
    $('#pt-prev').addEventListener('click', function () { shift(-1); });
    $('#pt-next').addEventListener('click', function () { shift(1); });

    var months = R.test_time.map(function (t) { return t / 30.4; });
    var xDom = [Math.min(-0.25, d3.min(months) - 0.1), d3.max(months) + 0.15];
    var uDom = [Math.floor(d3.min(R.motor_updrs)) - 1, Math.ceil(d3.max(R.motor_updrs)) + 1];

    var svg = svgIn(el), reveal = svg.append('clipPath').attr('id', 'pt-reveal').append('rect').attr('x', 0).attr('y', 0);
    var top = svg.append('g'), bot = svg.append('g'), L = {};
    ['bands', 'grid', 'axis', 'usual'].forEach(function (k) { L['t' + k] = top.append('g'); });
    var topData = top.append('g').attr('clip-path', 'url(#pt-reveal)');
    L.trecs = topData.append('g'); L.tline = topData.append('path'); L.tdots = topData.append('g');
    ['bands', 'grid', 'axis', 'xaxis'].forEach(function (k) { L['b' + k] = bot.append('g'); });
    L.bline = bot.append('g').attr('clip-path', 'url(#pt-reveal)').append('path'); L.bdots = bot.append('g');
    var tTitle = svg.append('text'), bTitle = svg.append('text'), usualLab = top.append('text'), lastW = 0, lastH = 0;

    function sweep(dur) {
      reveal.interrupt().attr('height', lastH);
      if (!DUR) { reveal.attr('width', lastW); return; }
      reveal.attr('width', 0).transition().duration(dur).ease(d3.easeCubicInOut).attr('width', lastW);
    }
    function render(anim) {
      var w = el.clientWidth, sm = narrow(), m = { l: 38, r: 12 }, h1 = sm ? 150 : 190, h2 = sm ? 105 : 120, t1 = 26, gap = 44, t2 = t1 + h1 + gap, h = t2 + h2 + 30;
      size(svg, w, h); lastW = w; lastH = h; reveal.interrupt().attr('width', w).attr('height', h);
      var key = S.ptscore + '_score', vals = R[key];
      var x = d3.scaleLinear(xDom, [m.l, w - m.r]);
      var vext = d3.extent(vals), y1 = d3.scaleLinear([Math.floor(vext[0]), Math.ceil(vext[1])], [t1 + h1, t1]);
      var y2 = d3.scaleLinear(uDom, [t2 + h2, t2]);
      var person = byId.get(current1), ri = recIdx.get(current1), si = sesIdx.get(current1);
      var ses = si.map(function (i) { return { m: SS.months[i], v: SS[key][i], u: SS.motor_updrs[i], day: SS.session[i] }; }).sort(function (a, b) { return a.m - b.m; });
      var recs = ri.map(function (i) { return { m: months[i], v: vals[i] }; });
      var usual = person[S.ptscore + '_person'];

      tTitle.attr('x', 0).attr('y', 13).attr('font-size', 14).attr('font-weight', 600).style('fill', C.ink)
        .text(sm ? cap(S.ptscore) + ' score (higher = worse)' : 'Voice: ' + S.ptscore + ' score. Grey = every recording, blue = each session’s average');
      bTitle.attr('x', 0).attr('y', t2 - 13).attr('font-size', 14).attr('font-weight', 600).style('fill', C.ink)
        .text(sm ? 'Motor UPDRS' : 'Motor UPDRS: scored at the clinic visits, straight lines in between');

      // planned clinic visits at about 0, 3 and 6 months
      [[L.tbands, t1, h1], [L.bbands, t2, h2]].forEach(function (b) {
        b[0].selectAll('rect').data([0, 3, 6]).join('rect').attr('x', function (d) { return x(d - 0.13); }).attr('width', x(0.26) - x(0))
          .attr('y', b[1]).attr('height', b[2]).attr('fill', C.panel);
      });
      L.bbands.selectAll('text').data([0, 3, 6]).join('text').attr('x', function (d) { return x(d); }).attr('y', t2 + h2 - 6).attr('text-anchor', function (d) { return d === 0 ? 'start' : 'middle'; })
        .attr('dx', function (d) { return d === 0 ? -6 : 0; }).attr('font-size', 11.5).style('fill', C.muted).text(sm ? 'visit' : 'clinic visit');

      L.tgrid.selectAll('line').data(y1.ticks(4)).join('line').attr('x1', m.l).attr('x2', w - m.r).attr('y1', y1).attr('y2', y1).attr('stroke', C.grid);
      L.bgrid.selectAll('line').data(y2.ticks(4)).join('line').attr('x1', m.l).attr('x2', w - m.r).attr('y1', y2).attr('y2', y2).attr('stroke', C.grid);
      L.taxis.attr('transform', 'translate(' + m.l + ',0)').call(d3.axisLeft(y1).ticks(4).tickSize(0).tickPadding(7).tickFormat(function (v) { return v === 0 ? '0' : sgn(v, 0); })).call(axisStyle);
      L.baxis.attr('transform', 'translate(' + m.l + ',0)').call(d3.axisLeft(y2).ticks(4).tickSize(0).tickPadding(7)).call(axisStyle);
      L.bxaxis.attr('transform', 'translate(0,' + (t2 + h2) + ')').call(d3.axisBottom(x).tickValues([0, 1, 2, 3, 4, 5, 6, 7]).tickSize(0).tickPadding(9)
        .tickFormat(function (v) { return v === 7 ? (sm ? '7 mo' : '7 months') : v; })).call(axisStyle);

      var ul = L.tusual.selectAll('line').data([usual]).join('line').attr('x1', m.l).attr('x2', w - m.r).attr('stroke', C.ink).attr('stroke-width', 1.2);
      T(ul, anim).attr('y1', y1).attr('y2', y1);
      T(usualLab.attr('x', w - m.r).attr('text-anchor', 'end').attr('font-size', 12).style('fill', C.ink).text('usual level'), anim).attr('y', y1(usual) - 6);

      L.trecs.selectAll('circle').data(recs).join('circle').attr('r', sm ? 1.8 : 2.2).attr('fill', C.grey).attr('opacity', 0.75)
        .attr('cx', function (d) { return x(d.m); }).attr('cy', function (d) { return y1(d.v); });
      var line1 = d3.line().x(function (d) { return x(d.m); }).y(function (d) { return y1(d.v); });
      L.tline.attr('fill', 'none').attr('stroke', C.blue).attr('stroke-width', 2).attr('stroke-linejoin', 'round').attr('d', line1(ses));
      var sd = L.tdots.selectAll('circle').data(ses).join('circle').attr('r', sm ? 3.4 : 4).attr('fill', C.blue).attr('stroke', C.bg).attr('stroke-width', 1.5)
        .attr('cx', function (d) { return x(d.m); }).attr('cy', function (d) { return y1(d.v); });
      hover(sd, function (d) { return '<b>Day ' + d.day + '</b><br>' + cap(S.ptscore) + ' score ' + sgn(d.v, 2) + '<br><span class="dim">Motor UPDRS ' + d.u.toFixed(1) + ' (filled in)</span>'; });

      var line2 = d3.line().x(function (d) { return x(d.m); }).y(function (d) { return y2(d.u); });
      L.bline.attr('fill', 'none').attr('stroke', C.ink).attr('stroke-width', 2.6).attr('stroke-linejoin', 'round').attr('d', line2(ses));
      var bd = L.bdots.selectAll('circle').data(ses).join('circle').attr('r', 9).attr('fill', 'transparent').attr('cx', function (d) { return x(d.m); }).attr('cy', function (d) { return y2(d.u); });
      hover(bd, function (d) { return '<b>Day ' + d.day + '</b><br>Motor UPDRS ' + d.u.toFixed(1) + '<br><span class="dim">filled in between clinic visits</span>'; });

      var r = rho.get(current1 + '|' + S.ptscore);
      $('#pt-caption').innerHTML = '<b>Person ' + current1 + '</b>, age ' + person.age + ', ' + (person.sex === 'Male' ? 'man' : 'woman') + '. Their ' + S.ptscore +
        ' score wobbles around a usual level of <b>' + sgn(usual, 2) + '</b>. Motor UPDRS went from ' + person.first_motor.toFixed(1) + ' to ' + person.last_motor.toFixed(1) +
        ' (<b>' + sgn(person.motor_change, 1) + '</b> points, ' + person.progression.toLowerCase() + '). Across ' + ses.length +
        ' home sessions, the correlation between the two is <b>' + num(r, 2) + '</b>. Across all ' + P.length +
        ' people these correlations scatter around zero, with a median of ' + num(medRho[S.ptscore], 2) + '. Shaded bands mark the planned clinic visits at about 0, 3 and 6 months.';
    }
    on('ptscore', function () { render(true); sweep(700); });
    onView(el, {
      final: function () { render(false); }, resize: function () { render(false); },
      pre: function () { render(false); reveal.attr('width', 0); },
      play: function () { sweep(1500); }
    });
  })();

  /* ================================================================== 5. Aim 2: age and sex */
  (function ageScatter() {
    var el = $('#fig-age'); if (!el) { return; }
    var svg = svgIn(el), gGrid = svg.append('g'), base = svg.append('line'), gX = svg.append('g'), gY = svg.append('g'), gLines = svg.append('g'), gPts = svg.append('g'), gLab = svg.append('g');
    var yTitle = svg.append('text'), xTitle = svg.append('text'), PRE = false;
    var diamond = d3.symbol().type(d3.symbolDiamond);
    var rank = new Map(P.slice().sort(function (a, b) { return a.age - b.age; }).map(function (p, i) { return [p.subject, i]; }));
    function render(anim) {
      var w = el.clientWidth, sm = narrow(), h = sm ? 300 : 400, m = { t: 30, r: sm ? 52 : 64, b: 44, l: 34 };
      size(svg, w, h);
      var o = S.outcome2, yk = 'mean_' + o, lines = A2[o].line, show = PRE ? 0 : 1;
      var x = d3.scaleLinear([d3.min(P, function (p) { return p.age; }) - 2, d3.max(P, function (p) { return p.age; }) + 2], [m.l, w - m.r]);
      var ymax = d3.max(P, function (p) { return p[yk]; }), ymin = d3.min(P, function (p) { return p[yk]; });
      var y = d3.scaleLinear([Math.floor((ymin - 2) / 5) * 5, Math.ceil((ymax + 2) / 5) * 5], [h - m.b, m.t]);
      gGrid.selectAll('line').data(y.ticks(5)).join('line').attr('x1', m.l).attr('x2', w - m.r).attr('stroke', C.grid).attr('y1', y).attr('y2', y);
      gY.attr('transform', 'translate(' + m.l + ',0)').call(d3.axisLeft(y).ticks(5).tickSize(0).tickPadding(7)).call(axisStyle);
      gX.attr('transform', 'translate(0,' + (h - m.b) + ')').call(d3.axisBottom(x).ticks(sm ? 5 : 8).tickSize(0).tickPadding(9)).call(axisStyle);
      base.attr('x1', m.l).attr('x2', w - m.r).attr('y1', h - m.b).attr('y2', h - m.b).attr('stroke', C.axis);
      yTitle.attr('x', 0).attr('y', 13).attr('font-size', 13).style('fill', C.soft).text('Average ' + o + ' UPDRS');
      xTitle.attr('x', w - m.r).attr('y', h - 4).attr('text-anchor', 'end').attr('font-size', 13).style('fill', C.soft).text('Age (years)');

      var bySex = ['Male', 'Female'].map(function (s) { return { sex: s, pts: lines.filter(function (l) { return l.sex === s; }) }; });
      var ln = d3.line().x(function (d) { return x(d.age); }).y(function (d) { return y(d.fit); });
      var paths = gLines.selectAll('path').data(bySex, function (d) { return d.sex; }).join('path').attr('fill', 'none').attr('stroke-width', 2.4)
        .attr('stroke', function (d) { return SEX[d.sex]; });
      paths.transition().duration(anim && DUR ? (INTRO ? 900 : DUR) : 0).delay(INTRO ? 700 : 0).attr('d', function (d) { return ln(d.pts); }).attr('opacity', show);
      var ends = bySex.map(function (d) { var e = d.pts[d.pts.length - 1]; return { sex: d.sex, y: y(e.fit) }; });
      if (Math.abs(ends[0].y - ends[1].y) < 15) { var mid = (ends[0].y + ends[1].y) / 2, up = ends[0].y < ends[1].y ? 0 : 1; ends[up].y = mid - 8; ends[1 - up].y = mid + 8; }
      gLab.selectAll('text').data(ends, function (d) { return d.sex; }).join('text').attr('x', w - m.r + 7).attr('dy', '0.35em').attr('font-size', 13)
        .style('fill', C.ink).text(function (d) { return d.sex === 'Male' ? 'Men' : 'Women'; })
        .transition().duration(anim && DUR ? DUR : 0).delay(INTRO ? 1100 : 0).attr('y', function (d) { return d.y; }).attr('opacity', show);

      var pts = gPts.selectAll('path').data(P, function (d) { return d.subject; }).join('path')
        .attr('d', function (d) { return d.sex === 'Male' ? d3.symbol().type(d3.symbolCircle).size(sm ? 95 : 130)() : diamond.size(sm ? 100 : 135)(); })
        .attr('fill', function (d) { return SEX[d.sex]; }).attr('stroke', C.bg).attr('stroke-width', 1.6);
      if (PRE || !anim) { pts.attr('transform', function (d) { return 'translate(' + x(d.age) + ',' + y(d[yk]) + ')'; }); }
      T(pts, anim).attr('transform', function (d) { return 'translate(' + x(d.age) + ',' + y(d[yk]) + ')'; }).attr('opacity', show);
      hover(pts, function (d) { return '<b>Person ' + d.subject + '</b><br>' + (d.sex === 'Male' ? 'Man' : 'Woman') + ', age ' + d.age + '<br>Average ' + o + ' UPDRS ' + d[yk].toFixed(1); });

      var age = coef(o, 'age'), sex = coef(o, 'sexMale');
      $('#age-caption').innerHTML = 'One mark per person. The lines are the fitted model: each extra decade goes with <b>' + sgn(10 * age.estimate, 1) + '</b> ' + o +
        ' points (p = ' + (o === 'motor' ? age.p.toFixed(2) : age.p.toFixed(3)) + '), and the two lines sit <b>' + fx(sex.estimate, 1) + '</b> points apart, the gap between men and women of the same age (p = ' + sex.p.toFixed(2) + ').';
    }
    on('outcome2', function () { PRE = false; render(true); });
    chart(el, { render: render, setPre: function (v) { PRE = v; }, stagger: 22, dur: 500, order: function (d) { return d && d.subject != null ? rank.get(d.subject) : 0; } });
  })();

  /* ================================================================== 5b. progression and the cut-off slider */
  (function progression() {
    var el = $('#fig-prog'); if (!el) { return; }
    var slider = $('#mcid'), out = $('#mcid-out'), counts = $('#prog-counts'), PRE = false;
    var sorted = P.slice().sort(function (a, b) { return d3.ascending(a.motor_change, b.motor_change); });
    var order = new Map(sorted.map(function (p, i) { return [p.subject, i]; }));
    var groups = ['Worsened', 'Stable', 'Improved'];
    var svg = svgIn(el), band = svg.append('rect'), gGrid = svg.append('g'), gY = svg.append('g'), zero = svg.append('line'), gStem = svg.append('g'),
      bandLab = svg.append('text'), yTitle = svg.append('text'), gRows = svg.append('g'), gX = svg.append('g'), gAge = svg.append('g'), gMed = svg.append('g'), xTitle = svg.append('text');
    function groupOf(p, cut) { return p.motor_change >= cut ? 'Worsened' : (p.motor_change <= -cut ? 'Improved' : 'Stable'); }

    function render(anim) {
      var k = Math.round(+slider.value * 10), cut = k / 10, row = A2.mcid_grid.find(function (g) { return Math.round(g.cutoff * 10) === k; });
      out.textContent = cut.toFixed(1);
      var w = el.clientWidth, sm = narrow(), m = { l: sm ? 30 : 36, r: 8 }, h1 = sm ? 190 : 230, t1 = 26, rowH = sm ? 44 : 54, t2 = t1 + h1 + 56, h = t2 + rowH * 3 + 40;
      size(svg, w, h);
      var fly = anim === 'fly' && DUR, quick = anim && DUR && !INTRO ? 300 : 0;
      var x = d3.scaleBand(sorted.map(function (p) { return p.subject; }), [m.l + 4, w - m.r]).padding(0.2);
      var ext = d3.extent(sorted, function (p) { return p.motor_change; });
      var y = d3.scaleLinear([Math.floor(ext[0] / 2) * 2 - 1, Math.ceil(ext[1] / 2) * 2 + 1], [t1 + h1, t1]);
      band.attr('x', m.l).attr('width', w - m.r - m.l).attr('fill', C.panel).transition().duration(quick).attr('y', y(cut)).attr('height', y(-cut) - y(cut));
      gGrid.selectAll('line').data(y.ticks(6)).join('line').attr('x1', m.l).attr('x2', w - m.r).attr('y1', y).attr('y2', y).attr('stroke', C.grid);
      gY.attr('transform', 'translate(' + m.l + ',0)').call(d3.axisLeft(y).ticks(6).tickSize(0).tickPadding(6).tickFormat(function (v) { return v === 0 ? '0' : sgn(v, 0); })).call(axisStyle);
      zero.attr('x1', m.l).attr('x2', w - m.r).attr('y1', y(0)).attr('y2', y(0)).attr('stroke', C.muted).attr('stroke-width', 1.2);
      yTitle.attr('x', 0).attr('y', 12).attr('font-size', 13).style('fill', C.soft).text('Change in motor UPDRS, last recording minus first');
      bandLab.attr('x', w - m.r - 6).attr('text-anchor', 'end').attr('font-size', 12).style('fill', C.muted).text('within ±' + cut.toFixed(1) + ': no real change')
        .transition().duration(quick).attr('y', y(-cut) + 15);

      var col = function (p) { return PROG[groupOf(p, cut)]; };
      var cx = function (p) { return x(p.subject) + x.bandwidth() / 2; };
      var yv = function (p) { return y(PRE ? 0 : p.motor_change); };
      var st = gStem.selectAll('g').data(sorted, function (p) { return p.subject; }).join(function (en) {
        var e = en.append('g'); e.append('line').attr('stroke-width', 2).attr('stroke-linecap', 'round'); e.append('circle'); e.append('rect').attr('fill', 'transparent'); return e;
      });
      T(st.select('line').attr('x1', cx).attr('x2', cx).attr('y1', y(0)), anim).attr('y2', yv).attr('stroke', col);
      T(st.select('circle').attr('cx', cx).attr('r', sm ? 3.3 : 4.6), anim).attr('cy', yv).attr('fill', col);
      st.select('rect').attr('x', function (p) { return x(p.subject) - x.step() * 0.1; }).attr('width', x.step()).attr('y', t1).attr('height', h1);
      var tipHtml = function (p) { return '<b>Person ' + p.subject + '</b>, age ' + p.age + '<br>Motor UPDRS ' + p.first_motor.toFixed(1) + ' → ' + p.last_motor.toFixed(1) + ' (' + sgn(p.motor_change, 1) + ')<br><span class="dim">' + groupOf(p, cut) + ' at this cut-off</span>'; };
      hover(st, tipHtml);

      // ages by group: the same 42 people, who fly to a new row when their group changes
      var ax = d3.scaleLinear([d3.min(P, function (p) { return p.age; }) - 2, d3.max(P, function (p) { return p.age; }) + 2], [m.l + (sm ? 62 : 78), w - m.r - 6]);
      var ry = function (g) { return t2 + groups.indexOf(g) * rowH + rowH / 2; };
      gRows.selectAll('text').data(groups).join('text').attr('x', 0).attr('y', ry).attr('dy', '0.35em').attr('font-size', sm ? 13 : 14).attr('font-weight', 600).style('fill', C.ink).text(function (d) { return d; });
      gRows.selectAll('line').data(groups).join('line').attr('x1', ax.range()[0] - 8).attr('x2', w - m.r).attr('y1', ry).attr('y2', ry).attr('stroke', C.grid);
      gX.attr('transform', 'translate(0,' + (t2 + rowH * 3) + ')').call(d3.axisBottom(ax).ticks(sm ? 5 : 8).tickSize(0).tickPadding(8)).call(axisStyle);
      xTitle.attr('x', w - m.r).attr('y', h - 2).attr('text-anchor', 'end').attr('font-size', 13).style('fill', C.soft).text('Age (years)');
      var cyv = function (p) { return ry(groupOf(p, cut)) + hashJitter(p.subject, 3) * rowH * 0.5; };
      var ad = gAge.selectAll('circle').data(P, function (p) { return p.subject; }).join(function (en) { return en.append('circle').attr('cy', cyv).attr('opacity', 0); })
        .attr('r', sm ? 4.2 : 5.2).attr('stroke', C.bg).attr('stroke-width', 1.5).attr('cx', function (p) { return ax(p.age); });
      var tr = fly ? ad.transition().duration(760).delay(function (p) { return order.get(p.subject) * 5; }).ease(d3.easeBackOut.overshoot(1.5)) : T(ad, anim);
      tr.attr('cy', cyv).attr('fill', col).attr('opacity', PRE ? 0 : 1);
      hover(ad, tipHtml);
      var meds = groups.map(function (g) { return { g: g, med: row['median_age_' + g.toLowerCase()], n: row['n_' + g.toLowerCase()] }; }).filter(function (d) { return d.n > 0 && d.med != null; });
      var mg = gMed.selectAll('g').data(meds, function (d) { return d.g; }).join(function (en) {
        var e = en.append('g').attr('transform', function (d) { return 'translate(' + ax(d.med) + ',' + ry(d.g) + ')'; });
        e.append('line').attr('stroke', C.ink).attr('stroke-width', 2.6).attr('stroke-linecap', 'round');
        e.append('text').attr('font-size', 12).attr('text-anchor', 'middle').style('fill', C.ink).style('paint-order', 'stroke').attr('stroke', C.bg).attr('stroke-width', 3); return e;
      });
      mg.transition().duration(anim && DUR ? 500 : 0).delay(INTRO ? 900 : (fly ? 250 : 0)).attr('transform', function (d) { return 'translate(' + ax(d.med) + ',' + ry(d.g) + ')'; }).attr('opacity', PRE ? 0 : 1);
      mg.select('line').attr('y1', -rowH * 0.36).attr('y2', rowH * 0.36);
      mg.select('text').attr('y', -rowH * 0.36 - 4).text(function (d) { return 'median ' + d.med; });

      counts.innerHTML = groups.map(function (g) {
        return '<span><i class="sw" style="background:' + PROG[g] + '"></i><b>' + row['n_' + g.toLowerCase()] + '</b> ' + g.toLowerCase() + '</span>';
      }).join('') + '<span class="legend-note">' + (row.kw_p == null ? '' : 'Do ages differ between the groups? Kruskal–Wallis p = ' + row.kw_p.toFixed(2) + (row.kw_p >= 0.05 ? ', so no more than chance would produce' : '')) + '</span>';
      $('#mcid-reset').disabled = k === 25;
    }
    slider.addEventListener('input', function () { PRE = false; render('fly'); });
    $('#mcid-reset').addEventListener('click', function () { slider.value = 2.5; PRE = false; render('fly'); });
    chart(el, { render: render, setPre: function (v) { PRE = v; }, stagger: 20, dur: 650, order: function (d) { return d && d.subject != null ? order.get(d.subject) : 0; } });
  })();

  /* ================================================================== 5c. voice effect before and after age and sex */
  (function bridge() {
    var el = $('#fig-bridge'); if (!el) { return; }
    var svg = svgIn(el), data = A2.voice_adjusted, x = null, parts = {};
    function render() {
      var w = el.clientWidth, sm = narrow(), h = 190, m = { t: 22, r: 18, b: 30, l: sm ? 64 : 76 };
      size(svg, w, h); svg.selectAll('*').remove();
      x = d3.scaleLinear([0, Math.ceil(d3.max(data, function (d) { return d.crude; }) * 2 + 0.6) / 2], [m.l, w - m.r]);
      var y = d3.scalePoint(data.map(function (d) { return d.score; }), [m.t + 12, h - m.b - 16]);
      svg.append('g').selectAll('line').data(x.ticks(6)).join('line').attr('x1', x).attr('x2', x).attr('y1', m.t - 10).attr('y2', h - m.b).attr('stroke', C.grid);
      svg.append('line').attr('x1', x(0)).attr('x2', x(0)).attr('y1', m.t - 10).attr('y2', h - m.b).attr('stroke', C.muted).attr('stroke-width', 1.4);
      svg.append('g').attr('transform', 'translate(0,' + (h - m.b) + ')').call(d3.axisBottom(x).ticks(6).tickSize(0).tickPadding(8).tickFormat(function (v) { return v === 0 ? '0' : sgn(v, Number.isInteger(v) ? 0 : 1); })).call(axisStyle);
      var g = svg.append('g').selectAll('g').data(data).join('g').attr('transform', function (d) { return 'translate(0,' + y(d.score) + ')'; });
      g.append('text').attr('x', 0).attr('dy', '0.35em').attr('font-size', sm ? 14 : 15.5).attr('font-weight', 600).style('fill', C.ink).text(function (d) { return cap(d.score); });
      parts.link = g.append('line').attr('x1', function (d) { return x(d.adjusted); }).attr('x2', function (d) { return x(d.crude); }).attr('stroke', C.axis).attr('stroke-width', 4).attr('stroke-linecap', 'round');
      parts.adjC = g.append('circle').attr('cx', function (d) { return x(d.adjusted); }).attr('r', 7.5).attr('fill', C.paleBlue).attr('stroke', C.bg).attr('stroke-width', 2);
      parts.adjT = g.append('text').attr('x', function (d) { return x(d.adjusted); }).attr('y', -13).attr('text-anchor', 'middle').attr('font-size', 13).text(function (d) { return sgn(d.adjusted, 1); });
      g.append('circle').attr('cx', function (d) { return x(d.crude); }).attr('r', 7.5).attr('fill', C.blue).attr('stroke', C.bg).attr('stroke-width', 2);
      g.append('text').attr('x', function (d) { return x(d.crude); }).attr('y', -13).attr('text-anchor', 'middle').attr('font-size', 13).text(function (d) { return sgn(d.crude, 1); });
      var hit = g.append('rect').attr('x', m.l).attr('width', w - m.l - m.r).attr('y', -18).attr('height', 36).attr('fill', 'transparent');
      hover(hit, function (d) { return '<b>' + cap(d.score) + '</b><br>Voice alone: ' + sgn(d.crude, 2) + ' (p = ' + pfmt(d.crude_p) + ')<br>With age and sex: ' + sgn(d.adjusted, 2) + ' (p = ' + pfmt(d.adjusted_p) + ')'; });
    }
    onView(el, {
      final: render, resize: render,
      pre: function () {   // the pale dot starts on top of the blue one, then slides back to show the shrink
        render();
        var xc = function (d) { return x(d.crude); };
        parts.link.attr('x1', xc); parts.adjC.attr('cx', xc).attr('opacity', 0); parts.adjT.attr('x', xc).attr('opacity', 0);
      },
      play: function () {
        var xa = function (d) { return x(d.adjusted); }, dl = function (d, i) { return 350 + i * 220; };
        parts.link.transition().duration(950).delay(dl).ease(d3.easeCubicInOut).attr('x1', xa);
        parts.adjC.attr('opacity', 1).transition().duration(950).delay(dl).ease(d3.easeCubicInOut).attr('cx', xa);
        parts.adjT.transition().duration(950).delay(dl).ease(d3.easeCubicInOut).attr('x', xa).attr('opacity', 1);
      }
    });
  })();

  /* ================================================================== 6. two ways to test (canvas) */
  (function crossValidation() {
    var cv = $('#fig-cv'); if (!cv) { return; }
    var R = D.recordings, folds = A3.random_fold, ids = P.map(function (p) { return p.subject; });
    var per = new Map(ids.map(function (id) { return [id, []]; }));
    R.subject.forEach(function (s, i) { per.get(s).push(folds[i]); });
    var maxN = d3.max(ids, function (id) { return per.get(id).length; }), total = R.subject.length;
    var foldSize = d3.rollup(folds, function (v) { return v.length; }, function (f) { return f; });
    var round = 1, playing = !reduceMotion, timer = null, visible = false, grown = 1, growTimer = null;
    var playBtn = $('#cv-play'), stepBtn = $('#cv-step'), capEl = $('#cv-caption');
    var nRounds = function () { return S.cv === 'Random rows' ? A3.design.random_folds : A3.design.new_person_folds; };

    function draw() {
      var w = cv.clientWidth, sm = narrow(), cell = sm ? 1 : 1.5, pad = 16, h = Math.ceil(maxN * cell) + pad, dpr = window.devicePixelRatio || 1;
      if (!w) { return; }
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.height = h + 'px';
      var c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
      var colW = w / ids.length, gap = sm ? 1.5 : 3, base = h - pad, random = S.cv === 'Random rows', color = SCHEME[S.cv];
      ids.forEach(function (id, j) {
        var f = per.get(id), x0 = j * colW + gap / 2, bw = colW - gap, whole = !random && j + 1 === round;
        // columns rise left to right while the chart makes its entrance
        var up = Math.max(0, Math.min(1, grown * 1.6 - j / ids.length * 0.6)), n = Math.round(f.length * d3.easeCubicOut(up));
        for (var r = 0; r < n; r++) {
          c.fillStyle = (whole || (random && f[r] === round)) ? color : C.train;
          c.fillRect(x0, base - (r + 1) * cell, bw, cell + 0.05);
        }
        if (whole && grown >= 1) { c.fillStyle = C.ink; c.beginPath(); c.moveTo(x0 + bw / 2, base + 4); c.lineTo(x0 + bw / 2 - 5, base + 12); c.lineTo(x0 + bw / 2 + 5, base + 12); c.closePath(); c.fill(); }
      });
      c.fillStyle = C.axis; c.fillRect(0, base, w, 1);
      if (random) {
        var nTest = foldSize.get(round);
        capEl.innerHTML = '<b>Round ' + round + ' of ' + nRounds() + '.</b> Blue: ' + comma(nTest) + ' recordings held back for testing, scattered across all ' + ids.length +
          ' people. Grey: the other ' + comma(total - nTest) + ', used for training. Every person is on both sides, so the model has already heard everyone it is tested on.';
      } else {
        var id = ids[round - 1];
        capEl.innerHTML = '<b>Round ' + round + ' of ' + nRounds() + '.</b> Orange: all ' + per.get(id).length + ' recordings from person ' + id +
          ', kept out of the model. Grey: the other ' + (ids.length - 1) + ' people, used for training the model.';
      }
    }
    function advance() { round = round % nRounds() + 1; draw(); }
    function schedule() {
      clearInterval(timer); timer = null;
      if (playing && visible && grown >= 1) { timer = setInterval(advance, S.cv === 'Random rows' ? 1500 : 520); }
      playBtn.textContent = playing ? 'Pause' : 'Play'; playBtn.setAttribute('aria-pressed', playing);
    }
    playBtn.addEventListener('click', function () { playing = !playing; schedule(); });
    stepBtn.addEventListener('click', function () { playing = false; schedule(); advance(); });
    on('cv', function () { round = 1; draw(); schedule(); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; schedule(); }, { threshold: 0.3 }).observe(cv);
    } else { visible = true; }
    function settle() { if (growTimer) { growTimer.stop(); growTimer = null; } grown = 1; draw(); schedule(); }
    onView(cv, {
      final: settle, resize: settle,
      pre: function () { if (growTimer) { growTimer.stop(); } grown = 0; round = 1; draw(); schedule(); },
      play: function () {
        growTimer = d3.timer(function (e) { grown = Math.min(1, e / 1100); draw(); if (grown >= 1) { growTimer.stop(); growTimer = null; schedule(); } });
      }
    });
  })();

  /* ================================================================== 6b. prediction error bars */
  var maeRender = (function maeBars() {
    var el = $('#fig-mae'); if (!el) { return function () {}; }
    var models = ['Mean baseline', 'Linear regression', 'Random forest'], schemes = ['Random rows', 'New person'], PRE = false;
    var svg = svgIn(el), gGrid = svg.append('g'), gY = svg.append('g'), gX = svg.append('g'), gBars = svg.append('g'), baseLine = svg.append('line'), ref = svg.append('g').attr('opacity', 0);
    ref.append('line').attr('stroke', C.ink).attr('stroke-width', 1.4); ref.append('text').attr('font-size', 12.5).style('fill', C.ink);
    var yMax = Math.ceil(d3.max(A3.errors, function (e) { return e.mae; }) + 0.6);
    function bar(x, y, w, h) { var r = Math.min(4, w / 2, h); return 'M' + x + ',' + (y + h) + 'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) + 'V' + (y + h) + 'Z'; }
    function render(anim) {
      var w = el.clientWidth, sm = narrow(), h = sm ? 240 : 350, m = { t: 26, r: 6, b: sm ? 44 : 34, l: 28 }, st = S.maeStep;
      size(svg, w, h);
      var data = A3.errors.filter(function (e) { return e.outcome === S.outcome3; });
      var x0 = d3.scaleBand(models, [m.l, w - m.r]).paddingInner(0.18).paddingOuter(0.08);
      var bw = Math.min(sm ? 30 : 44, x0.bandwidth() / 2 - 3), y = d3.scaleLinear([0, yMax], [h - m.b, m.t]);
      var bx = function (d) { return x0(d.model) + x0.bandwidth() / 2 + (d.scheme === schemes[0] ? -bw - 1.5 : 1.5); };
      var shown = function (d) { return !PRE && (d.scheme === schemes[0] || st >= 1); };
      gGrid.selectAll('line').data(y.ticks(5)).join('line').attr('x1', m.l).attr('x2', w - m.r).attr('y1', y).attr('y2', y).attr('stroke', C.grid);
      gY.attr('transform', 'translate(' + m.l + ',0)').call(d3.axisLeft(y).ticks(5).tickSize(0).tickPadding(6)).call(axisStyle);
      gX.attr('transform', 'translate(0,' + (h - m.b) + ')').call(d3.axisBottom(x0).tickSize(0).tickPadding(9)).call(axisStyle);
      gX.selectAll('text').attr('font-size', sm ? 12.5 : 14).style('fill', C.ink);
      if (sm) { gX.selectAll('.tick text').each(function (d) { var p = d.split(' '), t = d3.select(this).text(null); t.append('tspan').attr('x', 0).text(p[0]); t.append('tspan').attr('x', 0).attr('dy', '1.15em').text(p[1]); }); }
      baseLine.attr('x1', m.l).attr('x2', w - m.r).attr('y1', h - m.b).attr('y2', h - m.b).attr('stroke', C.axis);

      var g = gBars.selectAll('g').data(data, function (d) { return d.scheme + d.model; }).join(function (en) {
        var e = en.append('g'); e.append('path').attr('d', function (d) { return bar(bx(d), y(0), bw, 0); }); e.append('text').attr('text-anchor', 'middle').attr('opacity', 0); return e;
      });
      T(g.select('path').attr('fill', function (d) { return SCHEME[d.scheme]; }), anim)
        .attr('d', function (d) { var v = shown(d) ? d.mae : 0; return bar(bx(d), y(v), bw, y(0) - y(v)); })
        .attr('opacity', function (d) { return st === 2 && d.scheme === schemes[0] ? 0.3 : 1; });
      g.select('text').text(function (d) { return d.mae.toFixed(2); }).attr('font-size', sm ? 11.5 : 13.5).attr('font-weight', 600).attr('x', function (d) { return bx(d) + bw / 2; });
      T(g.select('text'), anim).attr('y', function (d) { return y(shown(d) ? d.mae : 0) - 6; })
        .attr('opacity', function (d) { return !shown(d) ? 0 : (st === 2 && d.scheme === schemes[0] ? 0.35 : 1); });
      g.style('pointer-events', function (d) { return shown(d) ? null : 'none'; });
      hover(g, function (d) { return '<b>' + d.model + '</b><br>' + d.scheme + ': misses by ' + d.mae.toFixed(2) + ' points<br><span class="dim">' + d.outcome + '. Equal-person MAE ' + d.equal_person_mae.toFixed(2) + '</span>'; });

      var base = data.find(function (d) { return d.scheme === schemes[1] && d.model === models[0]; });
      ref.select('line').attr('x1', m.l).attr('x2', w - m.r);
      ref.select('text').attr('x', w - m.r).attr('y', 13).attr('text-anchor', 'end')
        .text((sm ? 'Line: guess the average, new person (' : 'Line: guessing the average for a new person (') + base.mae.toFixed(2) + ')');
      ref.select('line').transition().duration(anim && DUR ? DUR : 0).attr('y1', y(base.mae)).attr('y2', y(base.mae));
      ref.transition().duration(anim && DUR ? DUR : 0).attr('opacity', st === 2 && !PRE ? 1 : 0);
    }
    on('outcome3', function () { PRE = false; render(true); });
    chart(el, { render: render, setPre: function (v) { PRE = v; }, stagger: 90, dur: 800 });
    return render;
  })();

  /* ================================================================== 6c. predicted vs actual */
  (function predScatter() {
    var el = $('#fig-pred'); if (!el) { return; }
    var svg = svgIn(el), schemes = ['Random rows', 'New person'];
    function render() {
      var w = el.clientWidth, sm = narrow(), gap = sm ? 14 : 44, m = { t: 30, b: 40, l: 34, r: 6 };
      var side = Math.min(380, (w - gap - m.l - m.r) / 2), h = m.t + side + m.b;
      size(svg, w, h); svg.selectAll('*').remove();
      var data = A3.people.filter(function (d) { return d.outcome === S.outcome3 && d.model === 'Random forest'; });
      var lo = Math.floor(d3.min(data, function (d) { return Math.min(d.actual, d.predicted); }) / 5) * 5, hi = Math.ceil(d3.max(data, function (d) { return Math.max(d.actual, d.predicted); }) / 5) * 5;
      var totalW = m.l + side * 2 + gap, x0 = Math.max(0, (w - totalW - m.r) / 2);
      schemes.forEach(function (sc, i) {
        var g = svg.append('g').attr('transform', 'translate(' + (x0 + m.l + i * (side + gap)) + ',' + m.t + ')');
        var x = d3.scaleLinear([lo, hi], [0, side]), y = d3.scaleLinear([lo, hi], [side, 0]), tk = x.ticks(sm ? 4 : 6);
        g.append('g').selectAll('line').data(tk).join('line').attr('x1', 0).attr('x2', side).attr('y1', y).attr('y2', y).attr('stroke', C.grid);
        g.append('g').selectAll('line').data(tk).join('line').attr('y1', 0).attr('y2', side).attr('x1', x).attr('x2', x).attr('stroke', C.grid);
        g.append('line').attr('x1', 0).attr('y1', side).attr('x2', side).attr('y2', 0).attr('stroke', C.muted).attr('stroke-width', 1.4);
        g.append('g').attr('transform', 'translate(0,' + side + ')').call(d3.axisBottom(x).tickValues(tk).tickSize(0).tickPadding(8)).call(axisStyle);
        if (i === 0) { g.append('g').call(d3.axisLeft(y).tickValues(tk).tickSize(0).tickPadding(6)).call(axisStyle); }
        g.append('text').attr('x', 0).attr('y', -12).attr('font-size', 14.5).attr('font-weight', 600).style('fill', C.ink).text(sc);
        g.append('text').attr('x', side).attr('y', side + 34).attr('text-anchor', 'end').attr('font-size', 12.5).text(sm ? 'Actual' : 'Actual ' + S.outcome3.toLowerCase().replace('updrs', 'UPDRS'));
        if (i === 0) { g.append('text').attr('x', 6).attr('y', 14).attr('font-size', 12.5).text('Predicted'); }
        var pts = g.append('g').selectAll('circle').data(data.filter(function (d) { return d.scheme === sc; }).sort(function (a, b) { return a.actual - b.actual; })).join('circle').attr('class', 'mk')
          .attr('cx', function (d) { return x(d.actual); }).attr('cy', function (d) { return y(d.predicted); }).attr('r', sm ? 4 : 5.5)
          .attr('fill', SCHEME[sc]).attr('stroke', C.bg).attr('stroke-width', 1.6);
        hover(pts, function (d) { return '<b>Person ' + d.subject + '</b><br>Actual ' + d.actual.toFixed(1) + ', predicted ' + d.predicted.toFixed(1) + '<br><span class="dim">' + sc + ', average miss ' + d.person_mae.toFixed(1) + '</span>'; });
      });
    }
    var fm = fadeMarks(svg, 18);
    on('outcome3', render);
    onView(el, { final: render, resize: render, pre: function () { render(); fm.pre(); }, play: fm.play });
  })();

  /* ================================================================== 7. Aim 4 */
  (function aim4() {
    var el = $('#fig-aim4'); if (!el) { return; }
    var svg = svgIn(el), scores = ['jitter', 'shimmer', 'noise'], groups = ['Healthy', 'PD'];
    var allVals = []; A4.people.forEach(function (p) { scores.forEach(function (s) { allVals.push(p[s + '_score']); }); });
    var yDom = [Math.floor(d3.min(allVals) * 2) / 2 - 0.2, Math.ceil(d3.max(allVals) * 2) / 2 + 0.2];
    function render() {
      var w = el.clientWidth, sm = narrow(), h = sm ? 300 : 400, m = { t: 46, b: 32, l: 34, r: 4 }, gap = sm ? 8 : 26;
      size(svg, w, h); svg.selectAll('*').remove();
      var pw = (w - m.l - m.r - gap * 2) / 3, y = d3.scaleLinear(yDom, [h - m.b, m.t]), tk = y.ticks(6);
      svg.append('g').attr('transform', 'translate(' + m.l + ',0)').call(d3.axisLeft(y).tickValues(tk).tickSize(0).tickPadding(6).tickFormat(function (v) { return v === 0 ? '0' : sgn(v, 0); })).call(axisStyle);
      scores.forEach(function (s, i) {
        var key = s + '_score', g = svg.append('g').attr('transform', 'translate(' + (m.l + i * (pw + gap)) + ',0)');
        var test = a4(s), x = d3.scalePoint(groups, [0, pw]).padding(0.5), bwid = Math.min(54, pw * 0.3), jit = Math.min(15, pw * 0.11);
        var hv = A4.people.filter(function (p) { return p.group === 'Healthy'; }).map(function (p) { return p[key]; });
        g.append('rect').attr('class', 'bandmk').attr('x', 0).attr('width', pw).attr('y', y(d3.max(hv))).attr('height', y(d3.min(hv)) - y(d3.max(hv))).attr('fill', C.blue).attr('opacity', 0.1);
        g.append('g').selectAll('line').data(tk).join('line').attr('x1', 0).attr('x2', pw).attr('y1', y).attr('y2', y).attr('stroke', function (d) { return d === 0 ? C.axis : C.grid; });
        g.append('text').attr('x', 0).attr('y', 15).attr('font-size', sm ? 14 : 16).attr('font-weight', 600).style('fill', C.ink).text(cap(s));
        g.append('text').attr('x', 0).attr('y', 33).attr('font-size', sm ? 11.5 : 13).text((sm ? 'adj. p = ' : 'adjusted p = ') + test.p_adjusted.toFixed(3));
        groups.forEach(function (gr) {
          var b = A4.boxes.find(function (r) { return r.score === key && r.group === gr; });
          var vals = A4.people.filter(function (p) { return p.group === gr; }).map(function (p) { return p[key]; });
          var iqr = b.q3 - b.q1, lo = d3.min(vals.filter(function (v) { return v >= b.q1 - 1.5 * iqr; })), hi = d3.max(vals.filter(function (v) { return v <= b.q3 + 1.5 * iqr; }));
          var cx = x(gr), bg = g.append('g').attr('class', 'boxmk');
          bg.append('line').attr('x1', cx).attr('x2', cx).attr('y1', y(lo)).attr('y2', y(hi)).attr('stroke', C.soft).attr('stroke-width', 1.3);
          bg.append('rect').attr('x', cx - bwid / 2).attr('width', bwid).attr('y', y(b.q3)).attr('height', Math.max(1, y(b.q1) - y(b.q3))).attr('fill', C.bg).attr('fill-opacity', 0.55).attr('stroke', C.soft).attr('stroke-width', 1.3).attr('rx', 2);
          bg.append('line').attr('x1', cx - bwid / 2).attr('x2', cx + bwid / 2).attr('y1', y(b.median)).attr('y2', y(b.median)).attr('stroke', C.ink).attr('stroke-width', 2.6);
          g.append('text').attr('x', cx).attr('y', h - 10).attr('text-anchor', 'middle').attr('font-size', sm ? 12 : 13.5).style('fill', C.ink).text(gr === 'PD' ? (sm ? 'PD' : 'Parkinson’s') : 'Healthy');
        });
        var pts = g.append('g').selectAll('circle').data(A4.people).join('circle').attr('class', 'mk')
          .attr('cx', function (p, j) { return x(p.group) + hashJitter(j, i + 5) * 2 * jit; }).attr('cy', function (p) { return y(p[key]); })
          .attr('r', sm ? 3.6 : 5).attr('fill', function (p) { return GROUP[p.group]; }).attr('stroke', C.bg).attr('stroke-width', 1.5);
        hover(pts, function (p) { return '<b>' + p.subject + '</b>, ' + (p.group === 'PD' ? 'Parkinson’s' : 'healthy') + '<br>' + cap(s) + ' score ' + sgn(p[key], 2) + '<br><span class="dim">mean of ' + p.n_recordings + ' recordings</span>'; });
      });
    }
    onView(el, {
      final: render, resize: render,
      pre: function () { render(); svg.selectAll('.mk, .boxmk').attr('opacity', 0); svg.selectAll('.bandmk').attr('opacity', 0); },
      play: function () {   // dots first, then the boxes that summarise them, then the healthy range
        svg.selectAll('.mk').transition().duration(420).delay(function (d, i) { return Math.min(i * 11, 1100); }).attr('opacity', 1);
        svg.selectAll('.boxmk').transition().duration(500).delay(1150).attr('opacity', 1);
        svg.selectAll('.bandmk').transition().duration(700).delay(1650).attr('opacity', 0.1);
      }
    });
  })();

  /* ================================================================== small drawings on the dark pages
     Used by the opening story and by the transition page at the start of a chapter.
     build(svg, w, h) draws the finished picture; marks tagged with mark() make an entrance. */
  var DK = { text: '#F7F5F0', soft: '#B9C0CA', line: '#5A6474', ink: C.ink || '#1C2430', orange: C.orange, blue: '#6AA9F5' };
  function mark(sel, kind, delay, ms) { return sel.classed('a', true).attr('data-a', kind).attr('data-d', delay || 0).attr('data-ms', ms || 500); }
  function Stage(el, build) {
    var svg = null;
    function draw() {
      el.innerHTML = '';
      var w = el.clientWidth, h = el.clientHeight; if (!w || !h) { return false; }
      svg = svgIn(el); size(svg, w, h); build(svg, w, h); return true;
    }
    function start() {
      svg.selectAll('.a').each(function () {
        var m = d3.select(this), k = this.getAttribute('data-a');
        if (k === 'pop') { m.attr('data-r', m.attr('r')).attr('r', 0); }
        else if (k === 'draw') { var L = this.getTotalLength(); m.attr('stroke-dasharray', L + ' ' + L).attr('stroke-dashoffset', L); }
        else if (k === 'rise') { m.attr('opacity', 0).attr('transform', 'translate(0,12)'); }
        else { m.attr('opacity', 0); }
      });
    }
    function run() {
      if (!svg) { return; }
      svg.selectAll('.a').each(function () {
        var m = d3.select(this), k = this.getAttribute('data-a');
        var t = m.transition().delay(+this.getAttribute('data-d')).duration(+this.getAttribute('data-ms')).ease(d3.easeCubicOut);
        if (k === 'pop') { t.attr('r', m.attr('data-r')); }
        else if (k === 'draw') { t.attr('stroke-dashoffset', 0).on('end', function () { d3.select(this).attr('stroke-dasharray', null).attr('stroke-dashoffset', null); }); }
        else if (k === 'rise') { t.attr('opacity', 1).attr('transform', 'translate(0,0)'); }
        else { t.attr('opacity', 1); }
      });
    }
    return { final: draw, resize: draw, pre: function () { if (draw()) { start(); } }, play: run };
  }
  function label(svg, x, y, text, o) {
    o = o || {};
    return svg.append('text').attr('x', x).attr('y', y).attr('text-anchor', o.anchor || 'middle').attr('fill', o.fill || DK.soft)
      .attr('font-size', o.size || 13).attr('font-weight', o.weight || 400).text(text);
  }
  function wobble(x0, x1, level, amp, salt) {
    var pts = [], n = Math.max(6, Math.round((x1 - x0) / 16));
    for (var i = 0; i <= n; i++) { pts.push([x0 + (x1 - x0) * i / n, level + amp * (0.55 * Math.sin(i * 1.1 + salt) + 0.9 * hashJitter(i, salt))]); }
    return d3.line().curve(d3.curveCatmullRom)(pts);
  }
  var FIG = {};
  // six months, three clinic exams; with home = true, one person's home sessions fill the gaps
  function timeline(svg, w, h, home) {
    var mo = [];
    D.sessions.subject.forEach(function (sub, i) { if (sub === EG) { mo.push(D.sessions.months[i]); } });
    var end = Math.max(6.6, d3.max(mo) + 0.3), slim = w < 420;   // the same axis on both slides
    var x = d3.scaleLinear().domain([0, end]).range([26, w - 14]), y = Math.round(h * 0.66), stem = Math.min(86, h * 0.34);
    svg.append('line').attr('x1', x(0) - 14).attr('x2', x(end)).attr('y1', y).attr('y2', y).attr('stroke', DK.line).attr('stroke-width', 2);
    d3.range(0, Math.floor(end) + 1).forEach(function (m) {
      svg.append('line').attr('x1', x(m)).attr('x2', x(m)).attr('y1', y).attr('y2', y + 6).attr('stroke', DK.line).attr('stroke-width', 2);
      label(svg, x(m), y + 23, m);
    });
    label(svg, x(0) - 14, y + 44, 'Months in the study', { anchor: 'start', size: 12.5 });
    if (home) {
      mo.forEach(function (m, i) {
        mark(svg.append('line').attr('x1', x(m)).attr('x2', x(m)).attr('y1', y - 7).attr('y2', y - 29)
          .attr('stroke', DK.text).attr('stroke-width', 2.5).attr('stroke-linecap', 'round'), 'fade', 500 + i * 55, 260);
      });
      mark(label(svg, x(1.5), y - 42, 'Home recordings', { fill: DK.text, weight: 600, size: slim ? 11.5 : 13 }), 'fade', 500);
      if (!slim) { mark(label(svg, x(4.5), y - 42, 'Home recordings', { fill: DK.text, weight: 600 }), 'fade', 1200); }
    } else {
      [1.5, 4.5].forEach(function (m, i) { mark(label(svg, x(m), y - 16, 'about 3 months', { size: slim ? 11.5 : 13 }), 'fade', 1650 + i * 220); });
    }
    [0, 3, 6].forEach(function (m, i) {
      var g = svg.append('g');
      g.append('line').attr('x1', x(m)).attr('x2', x(m)).attr('y1', y).attr('y2', y - stem).attr('stroke', DK.orange).attr('stroke-width', 3.5).attr('stroke-linecap', 'round');
      g.append('circle').attr('cx', x(m)).attr('cy', y - stem).attr('r', 9).attr('fill', DK.orange);
      label(g, x(m) + (m === 0 ? -9 : 0), y - stem - 18, 'Clinic exam', { fill: DK.text, weight: 600, size: w < 300 ? 11 : slim ? 12 : 14, anchor: m === 0 ? 'start' : 'middle' });
      if (!home) { mark(g, 'rise', 250 + i * 450); }
    });
  }
  FIG.clinic = function (svg, w, h) { timeline(svg, w, h, false); };
  FIG.gaps = function (svg, w, h) { timeline(svg, w, h, true); };
  // an "ahhh", and the three things measured from it
  FIG.wave = function (svg, w, h) {
    var mid = h * 0.36, amp = Math.min(h * 0.27, 74), pts = [], x0 = 8, x1 = w - 8;
    for (var x = x0; x <= x1; x += 1.5) {
      var t = (x - x0) / (x1 - x0), env = Math.pow(Math.sin(Math.PI * t), 0.55);
      pts.push([x, mid - amp * env * (0.78 + 0.22 * Math.sin(2 * Math.PI * 4 * t + 1)) * Math.sin(2 * Math.PI * (w < 420 ? 13 : 22) * t + 0.9 * Math.sin(2 * Math.PI * 2.5 * t))]);
    }
    mark(svg.append('path').attr('d', d3.line()(pts)).attr('fill', 'none').attr('stroke', DK.text).attr('stroke-width', 2.5).attr('stroke-linejoin', 'round'), 'draw', 250, 1500);
    var yb = h - 30;
    [['Jitter', 'wobble in pitch'], ['Shimmer', 'wobble in loudness'], ['Noise', 'breathiness']].forEach(function (d, i) {
      var g = mark(svg.append('g'), 'rise', 1500 + i * 260), cx = w * (2 * i + 1) / 6;
      g.append('line').attr('x1', cx - 18).attr('x2', cx + 18).attr('y1', yb - 26).attr('y2', yb - 26).attr('stroke', DK.orange).attr('stroke-width', 3).attr('stroke-linecap', 'round');
      label(g, cx, yb, d[0], { fill: DK.text, weight: 700, size: 17 });
      label(g, cx, yb + 19, d[1], { size: w < 420 ? 11.5 : 13 });
    });
  };
  // one dot per person: the home study and the Oxford study, side by side and apart
  FIG.people = function (svg, w, h) {
    var nHome = A1.n_people, ox = A4.people.slice().sort(function (a, b) { return d3.descending(a.group, b.group); });
    var nPD = ox.filter(function (p) { return p.group === 'PD'; }).length, nH = ox.length - nPD;
    var ca = 7, cb = 8, ra = Math.ceil(nHome / ca), rb = Math.ceil(ox.length / cb);
    var g = Math.min(28, (w - 56) / (ca + cb), (h - 58) / ra), gap = Math.max(40, g * 2), r = g * 0.34;
    var onCover = svg.node().parentNode.classList.contains('cover-fig');   // the transition pages are set flush left
    var left = (onCover ? 0 : (w - ((ca + cb) * g + gap)) / 2) + g / 2, top = g / 2 + 2, bx = left + ca * g + gap;
    d3.range(nHome).forEach(function (i) {
      mark(svg.append('circle').attr('cx', left + (i % ca) * g).attr('cy', top + Math.floor(i / ca) * g).attr('r', r).attr('fill', DK.orange), 'pop', i * 16, 380);
    });
    ox.forEach(function (p, i) {
      mark(svg.append('circle').attr('cx', bx + (i % cb) * g).attr('cy', top + (ra - rb) * g / 2 + Math.floor(i / cb) * g).attr('r', r)
        .attr('fill', p.group === 'PD' ? DK.orange : DK.blue), 'pop', 750 + i * 16, 380);
    });
    var dx = left + (ca - 0.5) * g + gap / 2;
    mark(svg.append('line').attr('x1', dx).attr('x2', dx).attr('y1', 0).attr('y2', top + ra * g + 30).attr('stroke', DK.line).attr('stroke-width', 2).attr('stroke-dasharray', '3 6'), 'fade', 600);
    var ly = top + (ra - 0.5) * g + 22, small = w < 420 ? 11.5 : 13;
    var a = mark(svg.append('g'), 'fade', 300), b = mark(svg.append('g'), 'fade', 1050);
    label(a, left + (ca - 1) * g / 2, ly, 'Home study', { fill: DK.text, weight: 700, size: 15 });
    label(a, left + (ca - 1) * g / 2, ly + 18, N['pad.people'] + ' people with PD', { size: small });
    label(b, bx + (cb - 1) * g / 2, ly, 'Oxford study', { fill: DK.text, weight: 700, size: 15 });
    var t = label(b, bx + (cb - 1) * g / 2, ly + 18, '', { size: small });
    t.append('tspan').attr('fill', DK.orange).text('● '); t.append('tspan').text(nPD + ' with PD  ');
    t.append('tspan').attr('fill', DK.blue).text('● '); t.append('tspan').text(nH + ' healthy');
  };
  // the voice measures, grouped into three scores (tags: and each score split in two)
  function scores(svg, w, h, tags) {
    var groups = [['Jitter', []], ['Shimmer', []], ['Noise', []]];
    W.measures.forEach(function (m) { groups[/^jitter/.test(m) ? 0 : /^shimmer/.test(m) ? 1 : 2][1].push(m); });
    var rows = d3.max(groups, function (g) { return g[1].length; }), colW = w / 3, below = tags ? 92 : 48;
    var rowH = Math.max(13, Math.min(24, (h - below) / rows)), chipH = rowH - 4, fs = Math.min(colW < 104 ? 9.5 : 11.5, chipH - 3.5);
    var chipW = Math.min(colW - 8, fs * 9.2), pillY = rows * rowH + 14, k = 0;
    groups.forEach(function (g, i) {
      var cx = colW * (i + 0.5);
      g[1].forEach(function (m, j) {
        var c = mark(svg.append('g'), 'fade', 60 * k++, 320), y = j * rowH;
        c.append('rect').attr('x', cx - chipW / 2).attr('y', y).attr('width', chipW).attr('height', chipH).attr('rx', 4).attr('fill', 'none').attr('stroke', DK.line).attr('stroke-width', 1.5);
        c.append('text').attr('x', cx).attr('y', y + chipH / 2).attr('dy', '0.35em').attr('text-anchor', 'middle').attr('fill', DK.soft)
          .attr('font-size', fs).attr('font-family', 'ui-monospace, "SF Mono", Menlo, Consolas, monospace').text(m);
      });
      mark(svg.append('line').attr('x1', cx).attr('x2', cx).attr('y1', g[1].length * rowH - 2).attr('y2', pillY).attr('stroke', DK.orange).attr('stroke-width', 2.5).attr('stroke-linecap', 'round'), 'fade', 800 + i * 160, 300);
      var p = mark(svg.append('g'), 'rise', 950 + i * 160), pw = Math.min(colW - 10, 132);
      p.append('rect').attr('x', cx - pw / 2).attr('y', pillY).attr('width', pw).attr('height', 32).attr('rx', 16).attr('fill', DK.text);
      label(p, cx, pillY + 21, g[0], { fill: DK.ink, weight: 700, size: 15.5 });
      if (tags) {
        var tg = mark(svg.append('g'), 'fade', 1750 + i * 160), ts = colW < 120 ? 10.5 : 12.5;
        label(tg, cx, pillY + 52, 'usual voice', { size: ts });
        label(tg, cx, pillY + 69, '+ day-to-day wobble', { size: ts });
      }
    });
  }
  FIG.scores = function (svg, w, h) { scores(svg, w, h, svg.node().parentNode.classList.contains('slide-plot')); };
  // the two questions: tell people apart, or follow one person
  FIG.two = function (svg, w, h) {
    var half = w / 2, pad = 14, top = 34, bot = h - 26, ph = bot - top;
    svg.append('line').attr('x1', half).attr('x2', half).attr('y1', 4).attr('y2', h - 4).attr('stroke', DK.line).attr('stroke-width', 2).attr('stroke-dasharray', '3 6');
    var a = svg.append('g'), b = svg.append('g');
    a.append('circle').attr('cx', pad + 5).attr('cy', 13).attr('r', 5).attr('fill', DK.blue);
    label(a, pad + 17, 18, 'Between people', { anchor: 'start', fill: DK.text, weight: 700, size: 15 });
    [0.16, 0.5, 0.84].forEach(function (f, i) {
      mark(a.append('path').attr('d', wobble(pad, half - pad - 6, top + ph * f, ph * 0.05, i * 3 + 1)).attr('fill', 'none').attr('stroke', DK.blue).attr('stroke-width', 2.8).attr('stroke-linecap', 'round'), 'draw', 200 + i * 280, 800);
    });
    mark(label(a, pad, h - 6, w < 420 ? 'three people' : 'three people, three usual levels', { anchor: 'start', size: 12.5 }), 'fade', 1100);
    b.append('circle').attr('cx', half + pad + 11).attr('cy', 13).attr('r', 5).attr('fill', DK.orange);
    label(b, half + pad + 23, 18, 'Within a person', { anchor: 'start', fill: DK.text, weight: 700, size: 15 });
    var lvl = top + ph * 0.5;
    b.append('line').attr('x1', half + pad + 6).attr('x2', w - pad).attr('y1', lvl).attr('y2', lvl).attr('stroke', DK.soft).attr('stroke-width', 1.5).attr('stroke-dasharray', '5 5');
    mark(b.append('path').attr('d', wobble(half + pad + 6, w - pad, lvl, ph * 0.3, 7)).attr('fill', 'none').attr('stroke', DK.orange).attr('stroke-width', 2.8).attr('stroke-linecap', 'round'), 'draw', 1200, 1100);
    mark(label(b, half + pad + 6, h - 6, w < 420 ? 'one person' : 'one person, day to day', { anchor: 'start', size: 12.5 }), 'fade', 1900);
  };
  // aims 1 to 3 on the home study, then aim 4 on the Oxford study
  FIG.aims = function (svg, w, h) {
    var xs = [0.11, 0.37, 0.63, 0.89].map(function (f) { return f * w; }), r = Math.min(30, w * 0.075, h * 0.2), cy = 34 + r;
    var names = [['Voice and', 'UPDRS'], ['Age and', 'sex'], ['Prediction'], ['PD vs', 'healthy']], fs = w < 420 ? 11.5 : 14;
    var br = mark(svg.append('g'), 'fade', 1500);
    [[0, 2, 'Home study'], [3, 3, 'Oxford study']].forEach(function (d) {
      var xa = xs[d[0]] - r - 4, xb = xs[d[1]] + r + 4;
      br.append('line').attr('x1', xa).attr('x2', xb).attr('y1', 20).attr('y2', 20).attr('stroke', DK.line).attr('stroke-width', 2);
      label(br, (xa + xb) / 2, 12, d[2], { size: w < 420 ? 11.5 : 13 });
    });
    xs.forEach(function (x, i) {
      if (i) {
        var ar = mark(svg.append('g'), 'fade', i * 320 - 60, 300), x0 = xs[i - 1] + r + 8, x1 = x - r - 10;
        ar.append('line').attr('x1', x0).attr('x2', x1).attr('y1', cy).attr('y2', cy).attr('stroke', DK.soft).attr('stroke-width', 2.5).attr('stroke-dasharray', i === 3 ? '2 7' : null).attr('stroke-linecap', 'round');
        ar.append('path').attr('d', 'M' + (x1 - 7) + ' ' + (cy - 6) + 'L' + (x1 + 1) + ' ' + cy + 'L' + (x1 - 7) + ' ' + (cy + 6)).attr('fill', 'none').attr('stroke', DK.soft).attr('stroke-width', 2.5).attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round');
      }
      var g = mark(svg.append('g'), 'rise', i * 320);
      g.append('circle').attr('cx', x).attr('cy', cy).attr('r', r).attr('fill', i === 3 ? DK.blue : DK.orange);
      label(g, x, cy + r * 0.27, i + 1, { fill: DK.ink, weight: 700, size: r * 0.85 });
      names[i].forEach(function (line, j) { label(g, x, cy + r + 22 + j * (fs + 3), line, { fill: DK.text, weight: 600, size: fs }); });
    });
  };
  $$('.cover-fig[data-fig]').forEach(function (el) { var f = FIG[el.getAttribute('data-fig')]; if (f) { onView(el, Stage(el, f)); } });


  /* ---- the landing page's brain: a cloud of dots on a brain-like surface, turning slowly.
     An illustration drawn by the page, not anatomy. Voice-wave rings pulse out behind it. ---- */
  function Brain(canvas) {
    var rand = (function (seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; })(2026);
    var pts = [];
    function add(x, y, z, kind, g) { pts.push({ x: x, y: y, z: z, k: kind, g: g == null ? 1 : g, sx: (rand() - 0.5) * 5, sy: (rand() - 0.5) * 3.2, sz: (rand() - 0.5) * 2.4, d: rand() * 0.55, ph: rand() * 6.28 }); }
    // two hemispheres. Each point sits on a brain-shaped surface and is kept only on a "ridge" of a
    // wandering fold pattern, so the dots trace gyri with darker grooves between them.
    function ridge(x, y, z) {
      // wavy up-and-down folds over most of the surface, running lengthwise low on the side (temporal lobe)
      var up = Math.cos(23 * z + 5 * Math.sin(3.3 * y + 1.2 * x + 1.2) + 3 * Math.sin(6.1 * y + 2.7 * z));
      var low = Math.cos(26 * y + 3.6 * Math.sin(4.4 * z + 0.6));
      var m = Math.max(0, Math.min(1, (-y - 0.05) / 0.25));
      return up * (1 - m) + low * m;
    }
    for (var h = -1; h <= 1; h += 2) {
      var kept = 0, tries = 0;
      while (kept < 3600 && tries < 80000) {
        tries++;
        var u = rand() * 2 - 1, th = rand() * Math.PI * 2, r0 = Math.sqrt(1 - u * u);
        var dx = r0 * Math.cos(th), dy = u, dz = r0 * Math.sin(th);
        if (h * dx < -0.35) { continue; }                               // the inner face stays empty: the gap between hemispheres
        var g = ridge(dx, dy, dz);
        if (g < 0.1 && rand() < 0.7) { continue; }   // grooves keep a few dots, so the outline stays whole
        var bump = 1 + 0.025 * g;
        var x = dx * 0.44 * bump, y = dy * 0.56 * bump, z = dz * 0.98 * bump;
        if (h * x < 0) { x *= 0.3; }
        x += h * 0.47;
        if (z < -0.45) { y = y * (1 - 0.35 * (-0.45 - z)) + 0.06 * (-0.45 - z); }    // occipital end tapers
        if (y < -0.12) { y = -0.12 + (y + 0.12) * 0.6; }                             // flatter underside
        if (z > -0.35 && z < 0.5 && dy < -0.15) { y -= 0.16 * Math.sin(Math.PI * (z + 0.35) / 0.85); x += h * 0.04; }   // temporal lobe
        if (z > 0.18 && z < 0.62 && dy > -0.42 && dy < -0.1 && h * dx > 0.3) { continue; }  // the lateral fissure
        add(x, y, z, g > 0.1 && rand() < 0.035 ? 'hot' : 'dot', Math.max(0, g)); kept++;
      }
    }
    // cerebellum, finely striped, tucked under the back; then the brain stem
    for (var c = 0, ct0 = 0; c < 480 && ct0 < 6000; ct0++) {
      var cu = rand() * 2 - 1, ct = rand() * Math.PI * 2, cr = Math.sqrt(1 - cu * cu);
      if (Math.sin(34 * cu) < 0.1) { continue; }
      add(cr * Math.cos(ct) * 0.58, -0.43 + cu * 0.19, -0.62 + cr * Math.sin(ct) * 0.27, 'dot'); c++;
    }
    for (var b = 0; b < 140; b++) {
      var bt = rand() * Math.PI * 2, by = rand();
      add(Math.cos(bt) * 0.12, -0.3 - by * 0.48, -0.28 + Math.sin(bt) * 0.12 - by * 0.1, 'dot');
    }
    var ctx = canvas.getContext('2d'), w = 0, h2 = 0, dpr = 1, raf = null, t0 = 0, running = false;
    var ease = function (t) { return 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3); };
    function size() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = canvas.clientWidth; h2 = canvas.clientHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h2 * dpr);
    }
    function frame(t, still) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h2);
      var cx = w / 2, cy = h2 * 0.47, sc = Math.min(w * 0.4, h2 * 0.47);
      // voice-wave rings
      var period = 2.6;
      for (var k = 0; k < 3; k++) {
        var f = still ? (k + 0.6) / 3 : ((t / period + k / 3) % 1);
        var rmax = Math.min((w / 2 - 6) / 1.12, (h2 / 2 - 6) / 0.82), rr = sc * 0.8 + (rmax - sc * 0.8) * f, al = still ? 0.18 : 0.42 * (1 - f) * Math.min(1, t / 1.4);
        if (rr < 0) { continue; }
        ctx.beginPath(); ctx.ellipse(cx, cy, rr * 1.12, rr * 0.82, 0, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(106,169,245,' + al.toFixed(3) + ')'; ctx.lineWidth = 1.6; ctx.stroke();
      }
      var a = still ? 0.75 : 0.75 + t * 0.32, ca = Math.cos(a), sa = Math.sin(a), tilt = -0.32, ct2 = Math.cos(tilt), st2 = Math.sin(tilt);
      var asm = still ? 1 : t / 1.9, out = [];
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i], e = ease((asm - p.d) / 0.45);
        var x = p.sx + (p.x - p.sx) * e, y = p.sy + (p.y - p.sy) * e, z = p.sz + (p.z - p.sz) * e;
        var X = x * ca + z * sa, Z = -x * sa + z * ca;               // turn about the vertical axis
        var Y = y * ct2 - Z * st2; Z = y * st2 + Z * ct2;            // tip it towards the viewer
        var per = 3.4 / Math.max(1.4, 3.4 + Z);
        out.push([cx + X * sc * per, cy - Y * sc * per, Z, p, e]);
      }
      out.sort(function (m, q) { return q[2] - m[2]; });            // far dots first
      for (var j = 0; j < out.length; j++) {
        var o = out[j], depth = Math.max(0, Math.min(1, (1.1 - o[2]) / 2.2)), pp = o[3];
        var lit = 0.16 + 0.84 * pp.g, rad = (0.5 + 0.95 * depth) * (0.7 + 0.4 * pp.g) * Math.max(1, sc / 230), alpha = (0.04 + 0.96 * Math.pow(depth, 2)) * lit * (0.25 + 0.75 * o[4]);
        if (pp.k === 'hot') {
          var tw = still ? 0.8 : 0.55 + 0.45 * Math.sin(t * 2.2 + pp.ph);
          ctx.fillStyle = 'rgba(240,128,74,' + (alpha * tw).toFixed(3) + ')'; rad *= 1.35;
        } else {
          ctx.fillStyle = 'rgba(214,229,250,' + alpha.toFixed(3) + ')';
        }
        ctx.beginPath(); ctx.arc(o[0], o[1], rad, 0, Math.PI * 2); ctx.fill();
      }
    }
    function loop(now) {
      if (!running) { return; }
      frame((now - t0) / 1000, false);
      raf = requestAnimationFrame(loop);
    }
    return {
      start: function () {
        size();
        if (reduceMotion) { frame(0, true); return; }
        if (running) { return; }
        running = true; t0 = performance.now(); raf = requestAnimationFrame(loop);
      },
      stop: function () { running = false; if (raf) { cancelAnimationFrame(raf); raf = null; } },
      resize: function () { size(); if (!running) { frame(0, true); } }
    };
  }

  /* ---- the opening story: the landing page, then one slide at a time ---- */
  var story = (function () {
    var root = $('#story'); if (!root) { return null; }
    var slides = $$('.slide', root), n = slides.length, i = 0, timer = null;
    var count = $('#story-count'), back = $('#story-back'), next = $('#story-next'), dotsEl = $('#story-dots'), say = $('#announce');
    var heads = slides.map(function (sl) { var hd = $('h2', sl); hd.tabIndex = -1; return hd; });
    var figs = slides.map(function (sl) { var el = $('.slide-plot', sl), f = el && FIG[el.getAttribute('data-fig')]; return f ? Stage(el, f) : null; });
    var dots = slides.map(function (sl, j) {
      var li = document.createElement('li'), b = document.createElement('button');
      b.type = 'button'; b.setAttribute('aria-label', 'Slide ' + (j + 1) + ' of ' + n + ': ' + heads[j].textContent);
      b.addEventListener('click', function () { to(j, true); });
      li.appendChild(b); dotsEl.appendChild(li); return b;
    });
    var intro = true, introHead = $('#intro-h'), brainEl = $('#intro-brain'), brain = brainEl ? Brain(brainEl) : null;
    if (introHead) { introHead.tabIndex = -1; }
    var api = { leave: function () {}, progress: function () { return intro ? 0 : (i + 1) / n; } };
    function showIntro(user) {
      intro = true; root.classList.add('intro-on'); clearTimeout(timer);
      slides.forEach(function (sl) { sl.hidden = true; sl.classList.remove('in'); });
      if (!reduceMotion) { root.classList.remove('intro-on'); void root.offsetWidth; root.classList.add('intro-on'); }   // replay the entrance
      if (brain) { brain.stop(); brain.start(); }
      var bar = $('#rail-bar'); if (bar) { bar.style.width = '0%'; }
      window.scrollTo(0, 0);
      if (user) { say.textContent = introHead.textContent; introHead.focus({ preventScroll: true }); }
    }
    function begin() {
      intro = false; root.classList.remove('intro-on'); if (brain) { brain.stop(); }
      i = 0; paint(true); window.scrollTo(0, 0);
      say.textContent = 'Slide 1 of ' + n + ': ' + heads[0].textContent; heads[0].focus({ preventScroll: true });
    }
    $('#intro-start').addEventListener('click', begin);
    function paint(anim) {
      slides.forEach(function (sl, j) { sl.hidden = j !== i; sl.classList.remove('in'); });
      count.textContent = (i + 1) + ' / ' + n;
      back.disabled = false; next.textContent = i === n - 1 ? 'Start reading' : 'Next';
      dots.forEach(function (b, j) { b.classList.toggle('done', j < i); if (j === i) { b.setAttribute('aria-current', 'step'); } else { b.removeAttribute('aria-current'); } });
      clearTimeout(timer);
      var f = figs[i];
      if (f) { if (anim && !reduceMotion) { f.pre(); timer = setTimeout(f.play, 380); } else { f.final(); } }
      if (anim && !reduceMotion) { void slides[i].offsetWidth; slides[i].classList.add('in'); }
      var bar = $('#rail-bar'); if (bar) { bar.style.width = (100 * (i + 1) / n) + '%'; }
    }
    function to(j, user) {
      if (j < 0) { showIntro(user); return; }
      if (j >= n) { api.leave(); return; }
      i = j; paint(true); window.scrollTo(0, 0);
      if (user) { say.textContent = 'Slide ' + (i + 1) + ' of ' + n + ': ' + heads[i].textContent; }
    }
    back.addEventListener('click', function () { to(i - 1, true); });
    next.addEventListener('click', function () { to(i + 1, true); });
    api.step = function (k) { if (intro) { if (k > 0) { begin(); } } else { to(i + k, true); } };
    api.enter = function (restart) { if (restart || intro) { i = 0; showIntro(false); } else { paint(true); } };
    api.replay = function () { i = 0; showIntro(true); };
    api.pause = function () { if (brain) { brain.stop(); } };
    api.resize = function () { if (intro) { if (brain) { brain.resize(); if (!reduceMotion) { brain.start(); } } } else { paint(false); } };
    api.head = function () { return intro ? introHead : heads[i]; };
    return api;
  })();

  /* ================================================================== chapters: one on screen at a time
     The site opens on the story (#story, or no hash), a click-through that sits outside the chapters.
     Data, Wrangling, Aims and Conclusion each start on a transition page (.cover) before their content.
     The Aims chapter holds four tab panels. The URL hash names the chapter (#aims) or the aim (#aim2);
     Back/Next and the arrow keys walk the same line: ... Wrangling, Aim 1, Aim 2, Aim 3, Aim 4, Conclusion ... */
  var current = null;
  (function chaptersNav() {
    var idOf = function (el) { return el.id; };
    var chapters = $$('.chapter:not(.story)'), ids = chapters.map(idOf);   // the opening story sits outside the numbered line
    var legacy = { hook: 'question' };
    var storyEl = $('#story'), home = $('.rail-home');
    var rail = $('#rail'), railItems = $$('#rail-list li'), bar = $('#rail-bar'), announce = $('#announce');
    var saved = {}, userNav = false, focusOnTab = false, busy = null;
    var numbered = chapters.filter(function (c) { return c.getAttribute('data-num'); }).length;
    var aims = $('#aims'), tabs = $$('#aimtabs [role="tab"]'), panels = $$('.aim-panel'), panelIds = panels.map(idOf);
    var tabsWrap = $('#aimtabs-wrap'), tabsAnchor = $('#aimtabs-anchor'), cards = $$('.aimcard');
    var activeTab = panelIds[0] || null;
    var scrollies = [
      { el: $('#forest-scrolly'), key: 'forestStep', render: forestRender },
      { el: $('#mae-scrolly'), key: 'maeStep', render: maeRender }
    ].filter(function (s) { return s.el; });
    scrollies.forEach(function (s) {
      s.steps = $$('.step', s.el); s.ch = s.el.closest('.chapter').id; s.steps[0].classList.add('on');
      var p = s.el.closest('[role="tabpanel"]'); s.panel = p ? p.id : null;
    });
    // on screen right now? (its tab is the open one, and its drawer, if any, is open)
    // (a chapter showing its transition page has only that page's drawing live)
    function hasCover(c) { return !!(c && $('.cover', c)); }
    function isCovered(c) { return !!c && c.classList.contains('covered'); }
    function setCover(c, on) { on = !!on && hasCover(c); var was = isCovered(c); c.classList.toggle('covered', on); return was !== on; }
    function headOf(c) { return c === storyEl && story ? story.head() : $('h1, .part h2', c); }
    function live(o) { return !!o.cover === isCovered(document.getElementById(o.ch)) && (!o.panel || o.panel === activeTab) && (!o.drawer || o.drawer.open); }

    // rail: number, short name, and a full label for screen readers
    chapters.forEach(function (c, i) {
      var a = $('a', railItems[i]), n = c.getAttribute('data-num'), title = c.getAttribute('data-title');
      a.innerHTML = '<span class="n">' + (n || '§') + '</span><span class="t">' + c.getAttribute('data-short') + '</span>';
      a.setAttribute('aria-label', (n ? 'Chapter ' + n + ': ' : '') + title); a.title = title;
      var h = headOf(c); if (h) { h.tabIndex = -1; }
    });
    panels.forEach(function (p) { var h = $('h2', p); if (h) { h.tabIndex = -1; } });

    // Back and Next at the foot of every chapter and every aim; Next teases what comes next
    var arrow = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M8 20h22M21 10l10 10-10 10" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    var stopOf = function (el) { return { href: '#' + el.id, title: el.getAttribute('data-title'), q: el.getAttribute('data-q') }; };
    function addNav(host, back, next, label) {
      var nav = document.createElement('nav'); nav.className = 'chapnav'; nav.setAttribute('aria-label', label);
      var html = back ? '<a class="back" data-body href="' + back.href + '"><span aria-hidden="true">‹</span> Back: ' + back.title + '</a>' : '<span></span>';
      if (next) { html += '<a class="next" href="' + next.href + '"><span class="next-k">Next: ' + next.title + '</span><span class="next-q">' + next.q + '</span>' + arrow + '</a>'; }
      else { html += '<a class="next" href="#' + ids[0] + '"><span class="next-k">Back to the start</span><span class="next-q">Can voice track Parkinson’s disease?</span>' + arrow + '</a>'; }
      html += '<p class="keys">You can also move between chapters with the <kbd>←</kbd> and <kbd>→</kbd> keys.</p>';
      nav.innerHTML = html; host.appendChild(nav);
    }
    chapters.forEach(function (c, i) {
      var before = chapters[i - 1], after = chapters[i + 1];
      if (c === aims) {
        panels.forEach(function (p, j) {
          addNav(p, j > 0 ? stopOf(panels[j - 1]) : (before ? stopOf(before) : null),
                 j < panels.length - 1 ? stopOf(panels[j + 1]) : (after ? stopOf(after) : null), 'Previous and next aim');
        });
        return;
      }
      addNav(c, before ? stopOf(before === aims && panels.length ? panels[panels.length - 1] : before) : null, after ? stopOf(after) : null, 'Previous and next chapter');
    });

    function resolve(hash) {
      var id = decodeURIComponent((hash || '').replace(/^#/, ''));
      if (!id || id === 'story') { return { ch: storyEl ? 'story' : ids[0] }; }
      if (legacy[id]) { id = legacy[id]; }
      if (ids.indexOf(id) >= 0) { return id === 'aims' ? { ch: id, tab: panelIds[0], top: true } : { ch: id }; }
      var el = /^[\w-]+$/.test(id) ? document.getElementById(id) : null, ch = el && el.closest('.chapter');
      if (!ch) { return null; }
      var p = el.closest('[role="tabpanel"]');
      if (p) { return { ch: ch.id, tab: p.id, sub: el === p ? null : el }; }
      return { ch: ch.id, sub: el };
    }

    /* ---- the aim tabs ---- */
    function setTab(id) {
      activeTab = id;
      tabs.forEach(function (t) { var on = t.getAttribute('aria-controls') === id; t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1; });
      panels.forEach(function (p) { p.hidden = p.id !== id; p.classList.remove('entering'); });
      cards.forEach(function (c) { c.classList.toggle('on', c.getAttribute('data-aim') === id); });
    }
    function measureTabs() { if (aims && tabsWrap) { aims.style.setProperty('--tabs', tabsWrap.offsetHeight + 'px'); } }
    function tabsTop() { return Math.max(0, tabsAnchor.getBoundingClientRect().top + window.scrollY - rail.offsetHeight + 1); }
    function goTab(id) {
      if (id === activeTab) { return; }
      focusOnTab = true; go(id);
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { goTab(t.getAttribute('aria-controls')); });
      t.addEventListener('keydown', function (ev) {
        var n = tabs.length, j = null;
        if (ev.key === 'ArrowRight') { j = (i + 1) % n; } else if (ev.key === 'ArrowLeft') { j = (i - 1 + n) % n; }
        else if (ev.key === 'Home') { j = 0; } else if (ev.key === 'End') { j = n - 1; }
        if (j == null) { return; }
        ev.preventDefault(); ev.stopPropagation();   // the arrows move between tabs here, not between chapters
        tabs[j].focus(); goTab(panelIds[j]);
      });
    });
    if (panels.length) { setTab(activeTab); }

    function ready(it) { if (reduceMotion) { it.final(); it.entered = true; } else { it.entered = false; it.pre(); } }
    function prepare(c, onlyPanel) {
      scrollies.forEach(function (s) {
        if (s.ch !== c.id || !live(s) || (onlyPanel && s.panel !== onlyPanel)) { return; }
        S[s.key] = 0; s.steps.forEach(function (el, i) { el.classList.toggle('on', i === 0); });
      });
      items.forEach(function (it) {
        if (it.ch !== c.id || !live(it) || (onlyPanel && it.panel !== onlyPanel)) { return; }
        ready(it);
      });
    }
    function checkView() {
      if (!current || busy) { return; }
      var vh = window.innerHeight;
      items.forEach(function (it) {
        if (it.entered || it.ch !== current.id || !live(it)) { return; }
        var r = it.el.getBoundingClientRect();
        if (r.width && r.top < vh * 0.86 && r.bottom > 0) { it.entered = true; it.play(); }
      });
    }
    // a drawer's contents make their entrance when it opens
    $$('details.feature').forEach(function (d) {
      d.addEventListener('toggle', function () {
        var mine = items.filter(function (it) { return it.drawer === d; });
        if (!d.open) { mine.forEach(function (it) { it.entered = false; }); return; }
        if (!current) { return; }
        mine.forEach(function (it) { if (it.ch === current.id && !it.entered) { ready(it); } });
        var top = d.getBoundingClientRect().top;   // opened low on the screen: bring it up so its contents show
        if (top > window.innerHeight * 0.3) { window.scrollTo({ top: window.scrollY + top - rail.offsetHeight - 16, behavior: reduceMotion ? 'auto' : 'smooth' }); }
        setTimeout(checkView, reduceMotion ? 0 : 160);
      });
    });
    function openDrawerFor(el) { var d = el && el.closest('details.feature'); if (d && !d.open) { d.open = true; } }
    function focusOn(h) { if (h) { try { h.focus({ preventScroll: true }); } catch (e) { /* older browsers */ } } }

    function show(id, o) {
      o = o || {};
      var next = document.getElementById(id), prev = current;
      if (!next) { return; }
      if (busy) { clearTimeout(busy.timer); busy.prev.classList.remove('leaving'); busy = null; }
      var smooth = reduceMotion ? 'auto' : 'smooth';
      if (next === prev) {
        if (next === storyEl && story && o.user) { story.replay(); return; }   // the top-left title replays from the landing page
        if (setCover(next, o.cover)) {   // same chapter: between its transition page and its content
          if (next === aims) { if (o.tab) { setTab(o.tab); } measureTabs(); }
          prepare(next);
          if (!reduceMotion) { next.style.setProperty('--dir', o.cover ? -1 : 1); next.classList.add('entering'); setTimeout(function () { next.classList.remove('entering'); }, 460); }
          if (o.cover || !(o.sub || (next === aims && o.tab && !o.top))) {
            window.scrollTo(0, 0);
            focusOn(o.cover ? $('.cover-go', next) : headOf(next));
            announce.textContent = next.getAttribute('data-title');
            update(); setTimeout(checkView, reduceMotion ? 0 : 260);
            return;
          }
        }
        if (next === aims && o.tab) {   // same chapter, another aim
          var changed = o.tab !== activeTab, panel = document.getElementById(o.tab);
          if (changed) {
            setTab(o.tab); measureTabs(); prepare(aims, o.tab);
            if (!reduceMotion) { panel.classList.add('entering'); setTimeout(function () { panel.classList.remove('entering'); }, 420); }
            announce.textContent = panel.getAttribute('data-title');
          }
          if (o.sub) { o.sub.scrollIntoView({ behavior: 'auto', block: 'start' }); }
          else if (o.top) { window.scrollTo({ top: 0, behavior: smooth }); }
          else { var tt = tabsTop(); window.scrollTo({ top: tt, behavior: window.scrollY < tt ? smooth : 'auto' }); }
          if (changed && !o.focusTab && !o.top) { focusOn($('h2', panel)); }
          update(); setTimeout(checkView, reduceMotion ? 0 : 260);
          return;
        }
        if (o.sub) { openDrawerFor(o.sub); o.sub.scrollIntoView({ behavior: smooth, block: 'start' }); }
        else if (o.user) { window.scrollTo({ top: 0, behavior: smooth }); }
        return;
      }
      if (prev) { saved[prev.id] = window.scrollY; }
      var dir = ids.indexOf(id) > (prev ? ids.indexOf(prev.id) : -1) ? 1 : -1;
      function swap() {
        busy = null;
        if (prev) { prev.classList.remove('active', 'leaving', 'entering'); }
        next.style.setProperty('--dir', dir);
        next.classList.add('active');
        current = next;
        setCover(next, o.cover);
        if (home) { home.classList.toggle('on', next === storyEl); }
        if (next === storyEl && story) { story.enter(o.user || o.instant); } else if (story) { story.pause(); }
        var i = ids.indexOf(id);
        railItems.forEach(function (li, j) { li.classList.toggle('on', j === i); li.classList.toggle('done', j < i); var a = $('a', li); if (j === i) { a.setAttribute('aria-current', 'step'); } else { a.removeAttribute('aria-current'); } });
        if (next === aims) { if (o.tab) { setTab(o.tab); } measureTabs(); }
        openDrawerFor(o.sub);
        prepare(next);
        chapterHooks.forEach(function (fn) { fn(id); });
        var top = 0, toTab = next === aims && o.tab && !o.top;
        if (isCovered(next)) { top = 0; toTab = false; }
        else if (o.sub) { top = o.sub.getBoundingClientRect().top + window.scrollY - 70 - (next === aims ? tabsWrap.offsetHeight : 0); }
        else if (toTab) { top = tabsTop(); }
        else if (!o.user && saved[id] != null) { top = saved[id]; }
        window.scrollTo(0, Math.max(0, top));
        if (prev && !o.instant && !reduceMotion) {
          next.classList.add('entering');
          setTimeout(function () { next.classList.remove('entering'); }, 460);
        }
        if (prev) {   // not on first load: move focus to the chapter and say where we are
          focusOn(isCovered(next) ? $('.cover-go', next) : toTab ? $('h2', document.getElementById(o.tab)) : headOf(next));
          var n = next.getAttribute('data-num');
          announce.textContent = (n ? 'Chapter ' + n + ' of ' + numbered + ': ' : '') + next.getAttribute('data-title') +
            (toTab ? '. ' + document.getElementById(o.tab).getAttribute('data-title') : '');
        }
        update();
        setTimeout(checkView, reduceMotion ? 0 : (prev ? 260 : 350));
      }
      if (prev && !o.instant && !reduceMotion) {
        prev.style.setProperty('--dir', dir);
        prev.classList.add('leaving');
        busy = { prev: prev, timer: setTimeout(swap, 170) };
      } else { swap(); }
    }

    // Chapters with a transition page open on it. history.state remembers which of the two is showing,
    // so the browser's Back button goes from a chapter's content to its transition page.
    var lastKey = null, coverPref = null;
    function stateCover() { var st = window.history.state; return !(st && st.cover === false); }
    function keyNow() { return window.location.hash + '|' + (stateCover() ? 'c' : 'b'); }
    function route(first) {
      var r = resolve(window.location.hash);
      if (!r) { if (first) { r = { ch: storyEl ? 'story' : ids[0] }; } else { return; } }
      var pref = coverPref; coverPref = null; lastKey = keyNow();
      var deep = r.sub || (r.tab && !r.top);
      var cover = hasCover(document.getElementById(r.ch)) && !deep && (pref != null ? pref : stateCover());
      show(r.ch, { sub: r.sub, tab: r.tab, top: r.top, cover: cover, user: userNav, focusTab: focusOnTab, instant: first });
      userNav = false; focusOnTab = false;
    }
    // Move to a chapter or an aim; cover === false goes straight to the chapter's content. pushState changes
    // the address without the browser's own jump-to-anchor, which would scroll the page and take keyboard
    // focus off the tab just pressed.
    function go(id, cover) {
      userNav = true;
      var want = cover !== false, same = window.location.hash === '#' + id;
      if (!same || stateCover() !== want) {
        try { window.history.pushState({ cover: want }, '', '#' + id); }
        catch (e) { coverPref = want; window.location.hash = id; if (same) { route(false); } return; }
      }
      coverPref = want;
      route(false);
    }
    function onAddressChange() { if (keyNow() !== lastKey) { route(false); } }   // back, forward, or a typed address
    // the line the arrow keys walk: chapters, with the four aims in place of their chapter;
    // a transition page is its own stop, just before its chapter
    var stops = [];
    chapters.forEach(function (c) { if (c === aims && panels.length) { stops = stops.concat(panelIds); } else { stops.push(c.id); } });
    function step(k) {
      if (current === storyEl) { story.step(k); return; }
      var first = current === aims ? panelIds[0] : current.id, here = current === aims ? activeTab : current.id;
      if (isCovered(current)) {
        if (k > 0) { go(current.id, false); } else if (stops.indexOf(first) > 0) { go(stops[stops.indexOf(first) - 1], false); }
        return;
      }
      if (k < 0 && hasCover(current) && here === first) { go(current.id, true); return; }
      var t = stops[stops.indexOf(here) + k];
      if (!t) { return; }
      if (k > 0) { go(t === panelIds[0] ? 'aims' : t); } else { go(t, false); }
    }
    if (story) { story.leave = function () { go(ids[0]); }; }
    $$('.cover .cover-go').forEach(function (b) { b.addEventListener('click', function () { go(b.closest('.chapter').id, false); }); });

    document.addEventListener('click', function (ev) {
      var a = ev.target.closest && ev.target.closest('a[href^="#"]'); if (!a) { return; }
      var href = a.getAttribute('href');
      if (href === '#main') { ev.preventDefault(); focusOn(isCovered(current) ? $('.cover-go', current) : headOf(current)); return; }
      if (!resolve(href)) { return; }
      ev.preventDefault(); go(href.slice(1), a.hasAttribute('data-body') ? false : undefined);
    });
    window.addEventListener('hashchange', onAddressChange);
    window.addEventListener('popstate', onAddressChange);
    document.addEventListener('keydown', function (ev) {
      if (ev.defaultPrevented || ev.altKey || ev.ctrlKey || ev.metaKey || ev.shiftKey) { return; }
      var t = ev.target, inStory = current === storyEl;
      if (inStory && ev.key === 'Escape') { ev.preventDefault(); story.leave(); return; }
      if (inStory && (ev.key === ' ' || ev.key === 'Enter' || ev.key === 'PageDown') && !(t && t.closest && t.closest('a, button'))) { ev.preventDefault(); step(1); return; }
      if (inStory && ev.key === 'PageUp') { ev.preventDefault(); step(-1); return; }
      if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') { return; }
      if (t && t.closest && t.closest('input, select, textarea, pre, [contenteditable], [role="tablist"], #wrangle')) { return; }
      ev.preventDefault(); step(ev.key === 'ArrowRight' ? 1 : -1);
    });
    try { window.history.scrollRestoration = 'manual'; } catch (e) { /* not supported */ }

    // scrolling inside a chapter: progress line, step-through figures, entrances
    var ticking = false;
    function update() {
      ticking = false;
      if (!current) { return; }
      var vh = window.innerHeight, max = document.documentElement.scrollHeight - vh;
      bar.style.width = (current === storyEl && story ? 100 * story.progress() : isCovered(current) ? 0 : max > 4 ? Math.min(100, window.scrollY / max * 100) : 100) + '%';
      var stacked = window.innerWidth < 896, trigger = vh * (stacked ? 0.86 : 0.6);
      scrollies.forEach(function (s) {
        if (s.ch !== current.id || !live(s)) { return; }
        var st = 0;
        s.steps.forEach(function (el, i) { if (el.getBoundingClientRect().top < trigger) { st = i; } });
        if (st !== S[s.key]) {
          S[s.key] = st;
          s.steps.forEach(function (el, i) { el.classList.toggle('on', i === st); });
          s.render(true);
        }
      });
      checkView();
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });

    var rt = null, lastW = window.innerWidth;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        if (window.innerWidth === lastW) { return; }   // ignore mobile address-bar resizes
        lastW = window.innerWidth;
        if (current === aims) { measureTabs(); }
        if (current === storyEl && story) { story.resize(); }
        items.forEach(function (it) { if (current && it.ch === current.id && live(it) && it.resize) { it.resize(); it.entered = true; } });
        update();
      }, 160);
    });

    route(true);
  })();
})();
