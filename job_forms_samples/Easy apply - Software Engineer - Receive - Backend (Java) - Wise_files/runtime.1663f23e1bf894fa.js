(() => {
  'use strict';
  var e,
    v = {},
    m = {};
  function r(e) {
    var n = m[e];
    if (void 0 !== n) return n.exports;
    var t = (m[e] = { id: e, loaded: !1, exports: {} });
    return v[e].call(t.exports, t, t.exports, r), (t.loaded = !0), t.exports;
  }
  (r.m = v),
    (e = []),
    (r.O = (n, t, c, i) => {
      if (!t) {
        var a = 1 / 0;
        for (f = 0; f < e.length; f++) {
          for (var [t, c, i] = e[f], u = !0, d = 0; d < t.length; d++)
            (!1 & i || a >= i) && Object.keys(r.O).every(p => r.O[p](t[d]))
              ? t.splice(d--, 1)
              : ((u = !1), i < a && (a = i));
          if (u) {
            e.splice(f--, 1);
            var l = c();
            void 0 !== l && (n = l);
          }
        }
        return n;
      }
      i = i || 0;
      for (var f = e.length; f > 0 && e[f - 1][2] > i; f--) e[f] = e[f - 1];
      e[f] = [t, c, i];
    }),
    (r.n = e => {
      var n = e && e.__esModule ? () => e.default : () => e;
      return r.d(n, { a: n }), n;
    }),
    (r.d = (e, n) => {
      for (var t in n) r.o(n, t) && !r.o(e, t) && Object.defineProperty(e, t, { enumerable: !0, get: n[t] });
    }),
    (r.f = {}),
    (r.e = e => Promise.all(Object.keys(r.f).reduce((n, t) => (r.f[t](e, n), n), []))),
    (r.u = e =>
      (76 === e ? 'common' : e) +
      '.' +
      {
        76: '729e45c79874a4a2',
        85: '0ed3649a617028e7',
        100: 'e7593f3f02ef1ab0',
        109: '4f9b7f1fd7bae613',
        314: 'f1f370c053ca98aa',
        372: 'fd477460e2d5fde6',
        399: 'a8e615f8efb79409',
        426: '50e092e08c9960e5',
        432: '5f572c59ce419e93',
        472: '6bebfa6d1efcf767',
        481: '69798fe68492280e',
        511: '5c49e3fa0238d130',
        558: 'efdb93f382a2bb6e',
        632: '3aebaa267412f5be',
        726: '059af8e9ec7e7117',
        775: 'ee7d58452d086cd3',
        795: 'e30b0f2a3c92e8fb',
        866: 'f83a86e105b4ec3e',
        898: 'ca1e4bd430b0d1fe',
        979: '20d497d03566790a',
      }[e] +
      '.js'),
    (r.miniCssF = e => {}),
    (r.o = (e, n) => Object.prototype.hasOwnProperty.call(e, n)),
    (() => {
      var e = {},
        n = 'oneclick-ui:';
      r.l = (t, c, i, f) => {
        if (e[t]) e[t].push(c);
        else {
          var a, u;
          if (void 0 !== i)
            for (var d = document.getElementsByTagName('script'), l = 0; l < d.length; l++) {
              var o = d[l];
              if (o.getAttribute('src') == t || o.getAttribute('data-webpack') == n + i) {
                a = o;
                break;
              }
            }
          a ||
            ((u = !0),
            ((a = document.createElement('script')).type = 'module'),
            (a.charset = 'utf-8'),
            (a.timeout = 120),
            r.nc && a.setAttribute('nonce', r.nc),
            a.setAttribute('data-webpack', n + i),
            (a.src = r.tu(t))),
            (e[t] = [c]);
          var b = (g, p) => {
              (a.onerror = a.onload = null), clearTimeout(s);
              var _ = e[t];
              if ((delete e[t], a.parentNode && a.parentNode.removeChild(a), _ && _.forEach(h => h(p)), g)) return g(p);
            },
            s = setTimeout(b.bind(null, void 0, { type: 'timeout', target: a }), 12e4);
          (a.onerror = b.bind(null, a.onerror)), (a.onload = b.bind(null, a.onload)), u && document.head.appendChild(a);
        }
      };
    })(),
    (r.r = e => {
      typeof Symbol < 'u' && Symbol.toStringTag && Object.defineProperty(e, Symbol.toStringTag, { value: 'Module' }),
        Object.defineProperty(e, '__esModule', { value: !0 });
    }),
    (r.nmd = e => ((e.paths = []), e.children || (e.children = []), e)),
    (() => {
      var e;
      r.tt = () => (
        void 0 === e &&
          ((e = { createScriptURL: n => n }),
          typeof trustedTypes < 'u' &&
            trustedTypes.createPolicy &&
            (e = trustedTypes.createPolicy('angular#bundler', e))),
        e
      );
    })(),
    (r.tu = e => r.tt().createScriptURL(e)),
    (r.p = ''),
    (() => {
      var e = { 121: 0 };
      (r.f.j = (c, i) => {
        var f = r.o(e, c) ? e[c] : void 0;
        if (0 !== f)
          if (f) i.push(f[2]);
          else if (121 != c) {
            var a = new Promise((o, b) => (f = e[c] = [o, b]));
            i.push((f[2] = a));
            var u = r.p + r.u(c),
              d = new Error();
            r.l(
              u,
              o => {
                if (r.o(e, c) && (0 !== (f = e[c]) && (e[c] = void 0), f)) {
                  var b = o && ('load' === o.type ? 'missing' : o.type),
                    s = o && o.target && o.target.src;
                  (d.message = 'Loading chunk ' + c + ' failed.\n(' + b + ': ' + s + ')'),
                    (d.name = 'ChunkLoadError'),
                    (d.type = b),
                    (d.request = s),
                    f[1](d);
                }
              },
              'chunk-' + c,
              c,
            );
          } else e[c] = 0;
      }),
        (r.O.j = c => 0 === e[c]);
      var n = (c, i) => {
          var d,
            l,
            [f, a, u] = i,
            o = 0;
          if (f.some(s => 0 !== e[s])) {
            for (d in a) r.o(a, d) && (r.m[d] = a[d]);
            if (u) var b = u(r);
          }
          for (c && c(i); o < f.length; o++) r.o(e, (l = f[o])) && e[l] && e[l][0](), (e[l] = 0);
          return r.O(b);
        },
        t = (self.webpackChunkoneclick_ui = self.webpackChunkoneclick_ui || []);
      t.forEach(n.bind(null, 0)), (t.push = n.bind(null, t.push.bind(t)));
    })();
})();
