'use strict';
(self.webpackChunkoneclick_ui = self.webpackChunkoneclick_ui || []).push([
  [461],
  {
    74163: (de, fe, We) => {
      var re =
          (typeof globalThis < 'u' && globalThis) ||
          (typeof self < 'u' && self) ||
          (typeof global < 'u' && global) ||
          {},
        ne_searchParams = 'URLSearchParams' in re,
        ne_iterable = 'Symbol' in re && 'iterator' in Symbol,
        ne_blob =
          'FileReader' in re &&
          'Blob' in re &&
          (function () {
            try {
              return new Blob(), !0;
            } catch {
              return !1;
            }
          })(),
        ne_formData = 'FormData' in re,
        ne_arrayBuffer = 'ArrayBuffer' in re;
      if (ne_arrayBuffer)
        var Ve = [
            '[object Int8Array]',
            '[object Uint8Array]',
            '[object Uint8ClampedArray]',
            '[object Int16Array]',
            '[object Uint16Array]',
            '[object Int32Array]',
            '[object Uint32Array]',
            '[object Float32Array]',
            '[object Float64Array]',
          ],
          Ke =
            ArrayBuffer.isView ||
            function (s) {
              return s && Ve.indexOf(Object.prototype.toString.call(s)) > -1;
            };
      function Oe(s) {
        if (('string' != typeof s && (s = String(s)), /[^a-z0-9\-#$%&'*+.^_`|~!]/i.test(s) || '' === s))
          throw new TypeError('Invalid character in header field name: "' + s + '"');
        return s.toLowerCase();
      }
      function Ne(s) {
        return 'string' != typeof s && (s = String(s)), s;
      }
      function Ie(s) {
        var l = {
          next: function () {
            var N = s.shift();
            return { done: void 0 === N, value: N };
          },
        };
        return (
          ne_iterable &&
            (l[Symbol.iterator] = function () {
              return l;
            }),
          l
        );
      }
      function Q(s) {
        (this.map = {}),
          s instanceof Q
            ? s.forEach(function (l, N) {
                this.append(N, l);
              }, this)
            : Array.isArray(s)
              ? s.forEach(function (l) {
                  if (2 != l.length)
                    throw new TypeError(
                      'Headers constructor: expected name/value pair to be length 2, found' + l.length,
                    );
                  this.append(l[0], l[1]);
                }, this)
              : s &&
                Object.getOwnPropertyNames(s).forEach(function (l) {
                  this.append(l, s[l]);
                }, this);
      }
      function Le(s) {
        if (!s._noBody) {
          if (s.bodyUsed) return Promise.reject(new TypeError('Already read'));
          s.bodyUsed = !0;
        }
      }
      function _e(s) {
        return new Promise(function (l, N) {
          (s.onload = function () {
            l(s.result);
          }),
            (s.onerror = function () {
              N(s.error);
            });
        });
      }
      function me(s) {
        var l = new FileReader(),
          N = _e(l);
        return l.readAsArrayBuffer(s), N;
      }
      function Be(s) {
        if (s.slice) return s.slice(0);
        var l = new Uint8Array(s.byteLength);
        return l.set(new Uint8Array(s)), l.buffer;
      }
      function U() {
        return (
          (this.bodyUsed = !1),
          (this._initBody = function (s) {
            (this.bodyUsed = this.bodyUsed),
              (this._bodyInit = s),
              s
                ? 'string' == typeof s
                  ? (this._bodyText = s)
                  : ne_blob && Blob.prototype.isPrototypeOf(s)
                    ? (this._bodyBlob = s)
                    : ne_formData && FormData.prototype.isPrototypeOf(s)
                      ? (this._bodyFormData = s)
                      : ne_searchParams && URLSearchParams.prototype.isPrototypeOf(s)
                        ? (this._bodyText = s.toString())
                        : ne_arrayBuffer &&
                            ne_blob &&
                            (function Fe(s) {
                              return s && DataView.prototype.isPrototypeOf(s);
                            })(s)
                          ? ((this._bodyArrayBuffer = Be(s.buffer)),
                            (this._bodyInit = new Blob([this._bodyArrayBuffer])))
                          : ne_arrayBuffer && (ArrayBuffer.prototype.isPrototypeOf(s) || Ke(s))
                            ? (this._bodyArrayBuffer = Be(s))
                            : (this._bodyText = s = Object.prototype.toString.call(s))
                : ((this._noBody = !0), (this._bodyText = '')),
              this.headers.get('content-type') ||
                ('string' == typeof s
                  ? this.headers.set('content-type', 'text/plain;charset=UTF-8')
                  : this._bodyBlob && this._bodyBlob.type
                    ? this.headers.set('content-type', this._bodyBlob.type)
                    : ne_searchParams &&
                      URLSearchParams.prototype.isPrototypeOf(s) &&
                      this.headers.set('content-type', 'application/x-www-form-urlencoded;charset=UTF-8'));
          }),
          ne_blob &&
            (this.blob = function () {
              var s = Le(this);
              if (s) return s;
              if (this._bodyBlob) return Promise.resolve(this._bodyBlob);
              if (this._bodyArrayBuffer) return Promise.resolve(new Blob([this._bodyArrayBuffer]));
              if (this._bodyFormData) throw new Error('could not read FormData body as blob');
              return Promise.resolve(new Blob([this._bodyText]));
            }),
          (this.arrayBuffer = function () {
            if (this._bodyArrayBuffer)
              return (
                Le(this) ||
                (ArrayBuffer.isView(this._bodyArrayBuffer)
                  ? Promise.resolve(
                      this._bodyArrayBuffer.buffer.slice(
                        this._bodyArrayBuffer.byteOffset,
                        this._bodyArrayBuffer.byteOffset + this._bodyArrayBuffer.byteLength,
                      ),
                    )
                  : Promise.resolve(this._bodyArrayBuffer))
              );
            if (ne_blob) return this.blob().then(me);
            throw new Error('could not read as ArrayBuffer');
          }),
          (this.text = function () {
            var s = Le(this);
            if (s) return s;
            if (this._bodyBlob)
              return (function Me(s) {
                var l = new FileReader(),
                  N = _e(l),
                  F = /charset=([A-Za-z0-9_-]+)/.exec(s.type);
                return l.readAsText(s, F ? F[1] : 'utf-8'), N;
              })(this._bodyBlob);
            if (this._bodyArrayBuffer)
              return Promise.resolve(
                (function Ge(s) {
                  for (var l = new Uint8Array(s), N = new Array(l.length), F = 0; F < l.length; F++)
                    N[F] = String.fromCharCode(l[F]);
                  return N.join('');
                })(this._bodyArrayBuffer),
              );
            if (this._bodyFormData) throw new Error('could not read FormData body as text');
            return Promise.resolve(this._bodyText);
          }),
          ne_formData &&
            (this.formData = function () {
              return this.text().then(Qe);
            }),
          (this.json = function () {
            return this.text().then(JSON.parse);
          }),
          this
        );
      }
      (Q.prototype.append = function (s, l) {
        (s = Oe(s)), (l = Ne(l));
        var N = this.map[s];
        this.map[s] = N ? N + ', ' + l : l;
      }),
        (Q.prototype.delete = function (s) {
          delete this.map[Oe(s)];
        }),
        (Q.prototype.get = function (s) {
          return (s = Oe(s)), this.has(s) ? this.map[s] : null;
        }),
        (Q.prototype.has = function (s) {
          return this.map.hasOwnProperty(Oe(s));
        }),
        (Q.prototype.set = function (s, l) {
          this.map[Oe(s)] = Ne(l);
        }),
        (Q.prototype.forEach = function (s, l) {
          for (var N in this.map) this.map.hasOwnProperty(N) && s.call(l, this.map[N], N, this);
        }),
        (Q.prototype.keys = function () {
          var s = [];
          return (
            this.forEach(function (l, N) {
              s.push(N);
            }),
            Ie(s)
          );
        }),
        (Q.prototype.values = function () {
          var s = [];
          return (
            this.forEach(function (l) {
              s.push(l);
            }),
            Ie(s)
          );
        }),
        (Q.prototype.entries = function () {
          var s = [];
          return (
            this.forEach(function (l, N) {
              s.push([N, l]);
            }),
            Ie(s)
          );
        }),
        ne_iterable && (Q.prototype[Symbol.iterator] = Q.prototype.entries);
      var Ze = ['CONNECT', 'DELETE', 'GET', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT', 'TRACE'];
      function q(s, l) {
        if (!(this instanceof q))
          throw new TypeError(
            'Please use the "new" operator, this DOM object constructor cannot be called as a function.',
          );
        var N = (l = l || {}).body;
        if (s instanceof q) {
          if (s.bodyUsed) throw new TypeError('Already read');
          (this.url = s.url),
            (this.credentials = s.credentials),
            l.headers || (this.headers = new Q(s.headers)),
            (this.method = s.method),
            (this.mode = s.mode),
            (this.signal = s.signal),
            !N && null != s._bodyInit && ((N = s._bodyInit), (s.bodyUsed = !0));
        } else this.url = String(s);
        if (
          ((this.credentials = l.credentials || this.credentials || 'same-origin'),
          (l.headers || !this.headers) && (this.headers = new Q(l.headers)),
          (this.method = (function De(s) {
            var l = s.toUpperCase();
            return Ze.indexOf(l) > -1 ? l : s;
          })(l.method || this.method || 'GET')),
          (this.mode = l.mode || this.mode || null),
          (this.signal =
            l.signal ||
            this.signal ||
            (function () {
              if ('AbortController' in re) return new AbortController().signal;
            })()),
          (this.referrer = null),
          ('GET' === this.method || 'HEAD' === this.method) && N)
        )
          throw new TypeError('Body not allowed for GET or HEAD requests');
        if (
          (this._initBody(N),
          !(('GET' !== this.method && 'HEAD' !== this.method) || ('no-store' !== l.cache && 'no-cache' !== l.cache)))
        ) {
          var F = /([?&])_=[^&]*/;
          F.test(this.url)
            ? (this.url = this.url.replace(F, '$1_=' + new Date().getTime()))
            : (this.url += (/\?/.test(this.url) ? '&' : '?') + '_=' + new Date().getTime());
        }
      }
      function Qe(s) {
        var l = new FormData();
        return (
          s
            .trim()
            .split('&')
            .forEach(function (N) {
              if (N) {
                var F = N.split('='),
                  W = F.shift().replace(/\+/g, ' '),
                  x = F.join('=').replace(/\+/g, ' ');
                l.append(decodeURIComponent(W), decodeURIComponent(x));
              }
            }),
          l
        );
      }
      function ze(s) {
        var l = new Q();
        return (
          s
            .replace(/\r?\n[\t ]+/g, ' ')
            .split('\r')
            .map(function (F) {
              return 0 === F.indexOf('\n') ? F.substr(1, F.length) : F;
            })
            .forEach(function (F) {
              var W = F.split(':'),
                x = W.shift().trim();
              if (x) {
                var ce = W.join(':').trim();
                try {
                  l.append(x, ce);
                } catch (we) {
                  console.warn('Response ' + we.message);
                }
              }
            }),
          l
        );
      }
      function ye(s, l) {
        if (!(this instanceof ye))
          throw new TypeError(
            'Please use the "new" operator, this DOM object constructor cannot be called as a function.',
          );
        if (
          (l || (l = {}),
          (this.type = 'default'),
          (this.status = void 0 === l.status ? 200 : l.status),
          this.status < 200 || this.status > 599)
        )
          throw new RangeError(
            "Failed to construct 'Response': The status provided (0) is outside the range [200, 599].",
          );
        (this.ok = this.status >= 200 && this.status < 300),
          (this.statusText = void 0 === l.statusText ? '' : '' + l.statusText),
          (this.headers = new Q(l.headers)),
          (this.url = l.url || ''),
          this._initBody(s);
      }
      (q.prototype.clone = function () {
        return new q(this, { body: this._bodyInit });
      }),
        U.call(q.prototype),
        U.call(ye.prototype),
        (ye.prototype.clone = function () {
          return new ye(this._bodyInit, {
            status: this.status,
            statusText: this.statusText,
            headers: new Q(this.headers),
            url: this.url,
          });
        }),
        (ye.error = function () {
          var s = new ye(null, { status: 200, statusText: '' });
          return (s.ok = !1), (s.status = 0), (s.type = 'error'), s;
        });
      var Xe = [301, 302, 303, 307, 308];
      ye.redirect = function (s, l) {
        if (-1 === Xe.indexOf(l)) throw new RangeError('Invalid status code');
        return new ye(null, { status: l, headers: { location: s } });
      };
      var ke = re.DOMException;
      try {
        new ke();
      } catch {
        ((ke = function (l, N) {
          (this.message = l), (this.name = N);
          var F = Error(l);
          this.stack = F.stack;
        }).prototype = Object.create(Error.prototype)),
          (ke.prototype.constructor = ke);
      }
      function je(s, l) {
        return new Promise(function (N, F) {
          var W = new q(s, l);
          if (W.signal && W.signal.aborted) return F(new ke('Aborted', 'AbortError'));
          var x = new XMLHttpRequest();
          function ce() {
            x.abort();
          }
          if (
            ((x.onload = function () {
              var ie = { statusText: x.statusText, headers: ze(x.getAllResponseHeaders() || '') };
              (ie.status = 0 === W.url.indexOf('file://') && (x.status < 200 || x.status > 599) ? 200 : x.status),
                (ie.url = 'responseURL' in x ? x.responseURL : ie.headers.get('X-Request-URL'));
              var ae = 'response' in x ? x.response : x.responseText;
              setTimeout(function () {
                N(new ye(ae, ie));
              }, 0);
            }),
            (x.onerror = function () {
              setTimeout(function () {
                F(new TypeError('Network request failed'));
              }, 0);
            }),
            (x.ontimeout = function () {
              setTimeout(function () {
                F(new TypeError('Network request timed out'));
              }, 0);
            }),
            (x.onabort = function () {
              setTimeout(function () {
                F(new ke('Aborted', 'AbortError'));
              }, 0);
            }),
            x.open(
              W.method,
              (function we(ie) {
                try {
                  return '' === ie && re.location.href ? re.location.href : ie;
                } catch {
                  return ie;
                }
              })(W.url),
              !0,
            ),
            'include' === W.credentials
              ? (x.withCredentials = !0)
              : 'omit' === W.credentials && (x.withCredentials = !1),
            'responseType' in x &&
              (ne_blob ? (x.responseType = 'blob') : ne_arrayBuffer && (x.responseType = 'arraybuffer')),
            l &&
              'object' == typeof l.headers &&
              !(l.headers instanceof Q || (re.Headers && l.headers instanceof re.Headers)))
          ) {
            var pe = [];
            Object.getOwnPropertyNames(l.headers).forEach(function (ie) {
              pe.push(Oe(ie)), x.setRequestHeader(ie, Ne(l.headers[ie]));
            }),
              W.headers.forEach(function (ie, ae) {
                -1 === pe.indexOf(ae) && x.setRequestHeader(ae, ie);
              });
          } else
            W.headers.forEach(function (ie, ae) {
              x.setRequestHeader(ae, ie);
            });
          W.signal &&
            (W.signal.addEventListener('abort', ce),
            (x.onreadystatechange = function () {
              4 === x.readyState && W.signal.removeEventListener('abort', ce);
            })),
            x.send(typeof W._bodyInit > 'u' ? null : W._bodyInit);
        });
      }
      (je.polyfill = !0),
        re.fetch || ((re.fetch = je), (re.Headers = Q), (re.Request = q), (re.Response = ye)),
        We(96935);
    },
    96935: () => {
      const de = globalThis;
      function fe(e) {
        return (de.__Zone_symbol_prefix || '__zone_symbol__') + e;
      }
      const ne = Object.getOwnPropertyDescriptor,
        Fe = Object.defineProperty,
        Ve = Object.getPrototypeOf,
        Ke = Object.create,
        Oe = Array.prototype.slice,
        Ne = 'addEventListener',
        Ie = 'removeEventListener',
        Q = fe(Ne),
        Le = fe(Ie),
        _e = 'true',
        me = 'false',
        Me = fe('');
      function Ge(e, n) {
        return Zone.current.wrap(e, n);
      }
      function Be(e, n, c, t, a) {
        return Zone.current.scheduleMacroTask(e, n, c, t, a);
      }
      const U = fe,
        Ze = typeof window < 'u',
        De = Ze ? window : void 0,
        q = (Ze && De) || globalThis,
        Qe = 'removeAttribute';
      function ze(e, n) {
        for (let c = e.length - 1; c >= 0; c--) 'function' == typeof e[c] && (e[c] = Ge(e[c], n + '_' + c));
        return e;
      }
      function Xe(e) {
        return !e || (!1 !== e.writable && !('function' == typeof e.get && typeof e.set > 'u'));
      }
      const ke = typeof WorkerGlobalScope < 'u' && self instanceof WorkerGlobalScope,
        je = !('nw' in q) && typeof q.process < 'u' && '[object process]' === q.process.toString(),
        Ye = !je && !ke && !(!Ze || !De.HTMLElement),
        s = typeof q.process < 'u' && '[object process]' === q.process.toString() && !ke && !(!Ze || !De.HTMLElement),
        l = {},
        N = U('enable_beforeunload'),
        F = function (e) {
          if (!(e = e || q.event)) return;
          let n = l[e.type];
          n || (n = l[e.type] = U('ON_PROPERTY' + e.type));
          const c = this || e.target || q,
            t = c[n];
          let a;
          return (
            Ye && c === De && 'error' === e.type
              ? ((a = t && t.call(this, e.message, e.filename, e.lineno, e.colno, e.error)),
                !0 === a && e.preventDefault())
              : ((a = t && t.apply(this, arguments)),
                'beforeunload' === e.type && q[N] && 'string' == typeof a
                  ? (e.returnValue = a)
                  : null != a && !a && e.preventDefault()),
            a
          );
        };
      function W(e, n, c) {
        let t = ne(e, n);
        if ((!t && c && ne(c, n) && (t = { enumerable: !0, configurable: !0 }), !t || !t.configurable)) return;
        const a = U('on' + n + 'patched');
        if (e.hasOwnProperty(a) && e[a]) return;
        delete t.writable, delete t.value;
        const h = t.get,
          E = t.set,
          m = n.slice(2);
        let b = l[m];
        b || (b = l[m] = U('ON_PROPERTY' + m)),
          (t.set = function (S) {
            let y = this;
            !y && e === q && (y = q),
              y &&
                ('function' == typeof y[b] && y.removeEventListener(m, F),
                E && E.call(y, null),
                (y[b] = S),
                'function' == typeof S && y.addEventListener(m, F, !1));
          }),
          (t.get = function () {
            let S = this;
            if ((!S && e === q && (S = q), !S)) return null;
            const y = S[b];
            if (y) return y;
            if (h) {
              let D = h.call(this);
              if (D) return t.set.call(this, D), 'function' == typeof S[Qe] && S.removeAttribute(n), D;
            }
            return null;
          }),
          Fe(e, n, t),
          (e[a] = !0);
      }
      function x(e, n, c) {
        if (n) for (let t = 0; t < n.length; t++) W(e, 'on' + n[t], c);
        else {
          const t = [];
          for (const a in e) 'on' == a.slice(0, 2) && t.push(a);
          for (let a = 0; a < t.length; a++) W(e, t[a], c);
        }
      }
      const ce = U('originalInstance');
      function we(e) {
        const n = q[e];
        if (!n) return;
        (q[U(e)] = n),
          (q[e] = function () {
            const a = ze(arguments, e);
            switch (a.length) {
              case 0:
                this[ce] = new n();
                break;
              case 1:
                this[ce] = new n(a[0]);
                break;
              case 2:
                this[ce] = new n(a[0], a[1]);
                break;
              case 3:
                this[ce] = new n(a[0], a[1], a[2]);
                break;
              case 4:
                this[ce] = new n(a[0], a[1], a[2], a[3]);
                break;
              default:
                throw new Error('Arg list too long.');
            }
          }),
          ae(q[e], n);
        const c = new n(function () {});
        let t;
        for (t in c)
          ('XMLHttpRequest' === e && 'responseBlob' === t) ||
            (function (a) {
              'function' == typeof c[a]
                ? (q[e].prototype[a] = function () {
                    return this[ce][a].apply(this[ce], arguments);
                  })
                : Fe(q[e].prototype, a, {
                    set: function (h) {
                      'function' == typeof h
                        ? ((this[ce][a] = Ge(h, e + '.' + a)), ae(this[ce][a], h))
                        : (this[ce][a] = h);
                    },
                    get: function () {
                      return this[ce][a];
                    },
                  });
            })(t);
        for (t in n) 'prototype' !== t && n.hasOwnProperty(t) && (q[e][t] = n[t]);
      }
      function pe(e, n, c) {
        let t = e;
        for (; t && !t.hasOwnProperty(n); ) t = Ve(t);
        !t && e[n] && (t = e);
        const a = U(n);
        let h = null;
        if (t && (!(h = t[a]) || !t.hasOwnProperty(a)) && ((h = t[a] = t[n]), Xe(t && ne(t, n)))) {
          const m = c(h, a, n);
          (t[n] = function () {
            return m(this, arguments);
          }),
            ae(t[n], h);
        }
        return h;
      }
      function ie(e, n, c) {
        let t = null;
        function a(h) {
          const E = h.data;
          return (
            (E.args[E.cbIdx] = function () {
              h.invoke.apply(this, arguments);
            }),
            t.apply(E.target, E.args),
            h
          );
        }
        t = pe(
          e,
          n,
          h =>
            function (E, m) {
              const b = c(E, m);
              return b.cbIdx >= 0 && 'function' == typeof m[b.cbIdx] ? Be(b.name, m[b.cbIdx], b, a) : h.apply(E, m);
            },
        );
      }
      function ae(e, n) {
        e[U('OriginalDelegate')] = n;
      }
      let ot = !1,
        et = !1;
      function bt() {
        if (ot) return et;
        ot = !0;
        try {
          const e = De.navigator.userAgent;
          (-1 !== e.indexOf('MSIE ') || -1 !== e.indexOf('Trident/') || -1 !== e.indexOf('Edge/')) && (et = !0);
        } catch {}
        return et;
      }
      function st(e) {
        return 'function' == typeof e;
      }
      function it(e) {
        return 'number' == typeof e;
      }
      let xe = !1;
      if (typeof window < 'u')
        try {
          const e = Object.defineProperty({}, 'passive', {
            get: function () {
              xe = !0;
            },
          });
          window.addEventListener('test', e, e), window.removeEventListener('test', e, e);
        } catch {
          xe = !1;
        }
      const kt = { useG: !0 },
        Te = {},
        at = {},
        ct = new RegExp('^' + Me + '(\\w+)(true|false)$'),
        lt = U('propagationStopped');
      function ut(e, n) {
        const c = (n ? n(e) : e) + me,
          t = (n ? n(e) : e) + _e,
          a = Me + c,
          h = Me + t;
        (Te[e] = {}), (Te[e][me] = a), (Te[e][_e] = h);
      }
      function vt(e, n, c, t) {
        const a = (t && t.add) || Ne,
          h = (t && t.rm) || Ie,
          E = (t && t.listeners) || 'eventListeners',
          m = (t && t.rmAll) || 'removeAllListeners',
          b = U(a),
          S = '.' + a + ':',
          y = 'prependListener',
          D = '.' + y + ':',
          I = function (v, _, G) {
            if (v.isRemoved) return;
            const z = v.callback;
            let se;
            'object' == typeof z && z.handleEvent && ((v.callback = g => z.handleEvent(g)), (v.originalDelegate = z));
            try {
              v.invoke(v, _, [G]);
            } catch (g) {
              se = g;
            }
            const X = v.options;
            return (
              X &&
                'object' == typeof X &&
                X.once &&
                _[h].call(_, G.type, v.originalDelegate ? v.originalDelegate : v.callback, X),
              se
            );
          };
        function V(v, _, G) {
          if (!(_ = _ || e.event)) return;
          const z = v || _.target || e,
            se = z[Te[_.type][G ? _e : me]];
          if (se) {
            const X = [];
            if (1 === se.length) {
              const g = I(se[0], z, _);
              g && X.push(g);
            } else {
              const g = se.slice();
              for (let K = 0; K < g.length && (!_ || !0 !== _[lt]); K++) {
                const L = I(g[K], z, _);
                L && X.push(L);
              }
            }
            if (1 === X.length) throw X[0];
            for (let g = 0; g < X.length; g++) {
              const K = X[g];
              n.nativeScheduleMicroTask(() => {
                throw K;
              });
            }
          }
        }
        const J = function (v) {
            return V(this, v, !1);
          },
          le = function (v) {
            return V(this, v, !0);
          };
        function ue(v, _) {
          if (!v) return !1;
          let G = !0;
          _ && void 0 !== _.useG && (G = _.useG);
          const z = _ && _.vh;
          let se = !0;
          _ && void 0 !== _.chkDup && (se = _.chkDup);
          let X = !1;
          _ && void 0 !== _.rt && (X = _.rt);
          let g = v;
          for (; g && !g.hasOwnProperty(a); ) g = Ve(g);
          if ((!g && v[a] && (g = v), !g || g[b])) return !1;
          const K = _ && _.eventNameToString,
            L = {},
            C = (g[b] = g[a]),
            P = (g[U(h)] = g[h]),
            A = (g[U(E)] = g[E]),
            he = (g[U(m)] = g[m]);
          let ee;
          _ && _.prepend && (ee = g[U(_.prepend)] = g[_.prepend]);
          const te = G
              ? function (i) {
                  if (!L.isExisting) return C.call(L.target, L.eventName, L.capture ? le : J, L.options);
                }
              : function (i) {
                  return C.call(L.target, L.eventName, i.invoke, L.options);
                },
            H = G
              ? function (i) {
                  if (!i.isRemoved) {
                    const f = Te[i.eventName];
                    let w;
                    f && (w = f[i.capture ? _e : me]);
                    const R = w && i.target[w];
                    if (R)
                      for (let T = 0; T < R.length; T++)
                        if (R[T] === i) {
                          R.splice(T, 1),
                            (i.isRemoved = !0),
                            i.removeAbortListener && (i.removeAbortListener(), (i.removeAbortListener = null)),
                            0 === R.length && ((i.allRemoved = !0), (i.target[w] = null));
                          break;
                        }
                  }
                  if (i.allRemoved) return P.call(i.target, i.eventName, i.capture ? le : J, i.options);
                }
              : function (i) {
                  return P.call(i.target, i.eventName, i.invoke, i.options);
                },
            Pe =
              _ && _.diff
                ? _.diff
                : function (i, f) {
                    const w = typeof f;
                    return ('function' === w && i.callback === f) || ('object' === w && i.originalDelegate === f);
                  },
            Re = Zone[U('UNPATCHED_EVENTS')],
            ge = e[U('PASSIVE_EVENTS')],
            u = function (i, f, w, R, T = !1, j = !1) {
              return function () {
                const B = this || e;
                let Z = arguments[0];
                _ && _.transferEventName && (Z = _.transferEventName(Z));
                let Y = arguments[1];
                if (!Y) return i.apply(this, arguments);
                if (je && 'uncaughtException' === Z) return i.apply(this, arguments);
                let $ = !1;
                if ('function' != typeof Y) {
                  if (!Y.handleEvent) return i.apply(this, arguments);
                  $ = !0;
                }
                if (z && !z(i, Y, B, arguments)) return;
                const Se = xe && !!ge && -1 !== ge.indexOf(Z),
                  Ee = (function d(i) {
                    if ('object' == typeof i && null !== i) {
                      const f = { ...i };
                      return i.signal && (f.signal = i.signal), f;
                    }
                    return i;
                  })(
                    (function M(i, f) {
                      return !xe && 'object' == typeof i && i
                        ? !!i.capture
                        : xe && f
                          ? 'boolean' == typeof i
                            ? { capture: i, passive: !0 }
                            : i
                              ? 'object' == typeof i && !1 !== i.passive
                                ? { ...i, passive: !0 }
                                : i
                              : { passive: !0 }
                          : i;
                    })(arguments[2], Se),
                  ),
                  Ae = null == Ee ? void 0 : Ee.signal;
                if (null != Ae && Ae.aborted) return;
                if (Re)
                  for (let ve = 0; ve < Re.length; ve++)
                    if (Z === Re[ve]) return Se ? i.call(B, Z, Y, Ee) : i.apply(this, arguments);
                const rt = !!Ee && ('boolean' == typeof Ee || Ee.capture),
                  yt = !(!Ee || 'object' != typeof Ee) && Ee.once,
                  jt = Zone.current;
                let nt = Te[Z];
                nt || (ut(Z, K), (nt = Te[Z]));
                const pt = nt[rt ? _e : me];
                let Je,
                  Ue = B[pt],
                  Tt = !1;
                if (Ue) {
                  if (((Tt = !0), se)) for (let ve = 0; ve < Ue.length; ve++) if (Pe(Ue[ve], Y)) return;
                } else Ue = B[pt] = [];
                const Et = B.constructor.name,
                  mt = at[Et];
                mt && (Je = mt[Z]),
                  Je || (Je = Et + f + (K ? K(Z) : Z)),
                  (L.options = Ee),
                  yt && (L.options.once = !1),
                  (L.target = B),
                  (L.capture = rt),
                  (L.eventName = Z),
                  (L.isExisting = Tt);
                const qe = G ? kt : void 0;
                qe && (qe.taskData = L), Ae && (L.options.signal = void 0);
                const be = jt.scheduleEventTask(Je, Y, qe, w, R);
                if (Ae) {
                  L.options.signal = Ae;
                  const ve = () => be.zone.cancelTask(be);
                  i.call(Ae, 'abort', ve, { once: !0 }),
                    (be.removeAbortListener = () => Ae.removeEventListener('abort', ve));
                }
                return (
                  (L.target = null),
                  qe && (qe.taskData = null),
                  yt && (L.options.once = !0),
                  (!xe && 'boolean' == typeof be.options) || (be.options = Ee),
                  (be.target = B),
                  (be.capture = rt),
                  (be.eventName = Z),
                  $ && (be.originalDelegate = Y),
                  j ? Ue.unshift(be) : Ue.push(be),
                  T ? B : void 0
                );
              };
            };
          return (
            (g[a] = u(C, S, te, H, X)),
            ee &&
              (g[y] = u(
                ee,
                D,
                function (i) {
                  return ee.call(L.target, L.eventName, i.invoke, L.options);
                },
                H,
                X,
                !0,
              )),
            (g[h] = function () {
              const i = this || e;
              let f = arguments[0];
              _ && _.transferEventName && (f = _.transferEventName(f));
              const w = arguments[2],
                R = !!w && ('boolean' == typeof w || w.capture),
                T = arguments[1];
              if (!T) return P.apply(this, arguments);
              if (z && !z(P, T, i, arguments)) return;
              const j = Te[f];
              let B;
              j && (B = j[R ? _e : me]);
              const Z = B && i[B];
              if (Z)
                for (let Y = 0; Y < Z.length; Y++) {
                  const $ = Z[Y];
                  if (Pe($, T))
                    return (
                      Z.splice(Y, 1),
                      ($.isRemoved = !0),
                      0 !== Z.length ||
                        (($.allRemoved = !0), (i[B] = null), R || 'string' != typeof f) ||
                        (i[Me + 'ON_PROPERTY' + f] = null),
                      $.zone.cancelTask($),
                      X ? i : void 0
                    );
                }
              return P.apply(this, arguments);
            }),
            (g[E] = function () {
              const i = this || e;
              let f = arguments[0];
              _ && _.transferEventName && (f = _.transferEventName(f));
              const w = [],
                R = ft(i, K ? K(f) : f);
              for (let T = 0; T < R.length; T++) {
                const j = R[T];
                w.push(j.originalDelegate ? j.originalDelegate : j.callback);
              }
              return w;
            }),
            (g[m] = function () {
              const i = this || e;
              let f = arguments[0];
              if (f) {
                _ && _.transferEventName && (f = _.transferEventName(f));
                const w = Te[f];
                if (w) {
                  const j = i[w[me]],
                    B = i[w[_e]];
                  if (j) {
                    const Z = j.slice();
                    for (let Y = 0; Y < Z.length; Y++) {
                      const $ = Z[Y];
                      this[h].call(this, f, $.originalDelegate ? $.originalDelegate : $.callback, $.options);
                    }
                  }
                  if (B) {
                    const Z = B.slice();
                    for (let Y = 0; Y < Z.length; Y++) {
                      const $ = Z[Y];
                      this[h].call(this, f, $.originalDelegate ? $.originalDelegate : $.callback, $.options);
                    }
                  }
                }
              } else {
                const w = Object.keys(i);
                for (let R = 0; R < w.length; R++) {
                  const j = ct.exec(w[R]);
                  let B = j && j[1];
                  B && 'removeListener' !== B && this[m].call(this, B);
                }
                this[m].call(this, 'removeListener');
              }
              if (X) return this;
            }),
            ae(g[a], C),
            ae(g[h], P),
            he && ae(g[m], he),
            A && ae(g[E], A),
            !0
          );
        }
        let oe = [];
        for (let v = 0; v < c.length; v++) oe[v] = ue(c[v], t);
        return oe;
      }
      function ft(e, n) {
        if (!n) {
          const h = [];
          for (let E in e) {
            const m = ct.exec(E);
            let b = m && m[1];
            if (b && (!n || b === n)) {
              const S = e[E];
              if (S) for (let y = 0; y < S.length; y++) h.push(S[y]);
            }
          }
          return h;
        }
        let c = Te[n];
        c || (ut(n), (c = Te[n]));
        const t = e[c[me]],
          a = e[c[_e]];
        return t ? (a ? t.concat(a) : t.slice()) : a ? a.slice() : [];
      }
      function wt(e, n) {
        const c = e.Event;
        c &&
          c.prototype &&
          n.patchMethod(
            c.prototype,
            'stopImmediatePropagation',
            t =>
              function (a, h) {
                (a[lt] = !0), t && t.apply(a, h);
              },
          );
      }
      const $e = U('zoneTask');
      function He(e, n, c, t) {
        let a = null,
          h = null;
        c += t;
        const E = {};
        function m(S) {
          const y = S.data;
          y.args[0] = function () {
            return S.invoke.apply(this, arguments);
          };
          const D = a.apply(e, y.args);
          return it(D) ? (y.handleId = D) : ((y.handle = D), (y.isRefreshable = st(D.refresh))), S;
        }
        function b(S) {
          const { handle: y, handleId: D } = S.data;
          return h.call(e, y ?? D);
        }
        (a = pe(
          e,
          (n += t),
          S =>
            function (y, D) {
              if (st(D[0])) {
                const I = {
                    isRefreshable: !1,
                    isPeriodic: 'Interval' === t,
                    delay: 'Timeout' === t || 'Interval' === t ? D[1] || 0 : void 0,
                    args: D,
                  },
                  V = D[0];
                D[0] = function () {
                  try {
                    return V.apply(this, arguments);
                  } finally {
                    const { handle: G, handleId: z, isPeriodic: se, isRefreshable: X } = I;
                    !se && !X && (z ? delete E[z] : G && (G[$e] = null));
                  }
                };
                const J = Be(n, D[0], I, m, b);
                if (!J) return J;
                const { handleId: le, handle: ue, isRefreshable: oe, isPeriodic: v } = J.data;
                if (le) E[le] = J;
                else if (ue && ((ue[$e] = J), oe && !v)) {
                  const _ = ue.refresh;
                  ue.refresh = function () {
                    const { zone: G, state: z } = J;
                    return (
                      'notScheduled' === z
                        ? ((J._state = 'scheduled'), G._updateTaskCount(J, 1))
                        : 'running' === z && (J._state = 'scheduling'),
                      _.call(this)
                    );
                  };
                }
                return ue ?? le ?? J;
              }
              return S.apply(e, D);
            },
        )),
          (h = pe(
            e,
            c,
            S =>
              function (y, D) {
                const I = D[0];
                let V;
                it(I) ? ((V = E[I]), delete E[I]) : ((V = null == I ? void 0 : I[$e]), V ? (I[$e] = null) : (V = I)),
                  null != V && V.type ? V.cancelFn && V.zone.cancelTask(V) : S.apply(e, D);
              },
          ));
      }
      function ht(e, n, c) {
        if (!c || 0 === c.length) return n;
        const t = c.filter(h => h.target === e);
        if (!t || 0 === t.length) return n;
        const a = t[0].ignoreProperties;
        return n.filter(h => -1 === a.indexOf(h));
      }
      function dt(e, n, c, t) {
        e && x(e, ht(e, n, c), t);
      }
      function tt(e) {
        return Object.getOwnPropertyNames(e)
          .filter(n => n.startsWith('on') && n.length > 2)
          .map(n => n.substring(2));
      }
      function It(e, n, c, t, a) {
        const h = Zone.__symbol__(t);
        if (n[h]) return;
        const E = (n[h] = n[t]);
        (n[t] = function (m, b, S) {
          return (
            b &&
              b.prototype &&
              a.forEach(function (y) {
                const D = `${c}.${t}::` + y,
                  I = b.prototype;
                try {
                  if (I.hasOwnProperty(y)) {
                    const V = e.ObjectGetOwnPropertyDescriptor(I, y);
                    V && V.value
                      ? ((V.value = e.wrapWithCurrentZone(V.value, D)), e._redefineProperty(b.prototype, y, V))
                      : I[y] && (I[y] = e.wrapWithCurrentZone(I[y], D));
                  } else I[y] && (I[y] = e.wrapWithCurrentZone(I[y], D));
                } catch {}
              }),
            E.call(n, m, b, S)
          );
        }),
          e.attachOriginToPatched(n[t], E);
      }
      const _t = (function re() {
        const e = globalThis,
          n = !0 === e[fe('forceDuplicateZoneCheck')];
        if (e.Zone && (n || 'function' != typeof e.Zone.__symbol__)) throw new Error('Zone already loaded.');
        return (
          (e.Zone ??= (function We() {
            const e = de.performance;
            function n(M) {
              e && e.mark && e.mark(M);
            }
            function c(M, p) {
              e && e.measure && e.measure(M, p);
            }
            n('Zone');
            let t = (() => {
              class M {
                static #e = (this.__symbol__ = fe);
                static assertZonePatched() {
                  if (de.Promise !== L.ZoneAwarePromise)
                    throw new Error(
                      'Zone.js has detected that ZoneAwarePromise `(window|global).Promise` has been overwritten.\nMost likely cause is that a Promise polyfill has been loaded after Zone.js (Polyfilling Promise api is not necessary when zone.js is loaded. If you must load one, do so before loading zone.js.)',
                    );
                }
                static get root() {
                  let r = M.current;
                  for (; r.parent; ) r = r.parent;
                  return r;
                }
                static get current() {
                  return P.zone;
                }
                static get currentTask() {
                  return A;
                }
                static __load_patch(r, o, k = !1) {
                  if (L.hasOwnProperty(r)) {
                    const O = !0 === de[fe('forceDuplicateZoneCheck')];
                    if (!k && O) throw Error('Already loaded patch: ' + r);
                  } else if (!de['__Zone_disable_' + r]) {
                    const O = 'Zone:' + r;
                    n(O), (L[r] = o(de, M, C)), c(O, O);
                  }
                }
                get parent() {
                  return this._parent;
                }
                get name() {
                  return this._name;
                }
                constructor(r, o) {
                  (this._parent = r),
                    (this._name = o ? o.name || 'unnamed' : '<root>'),
                    (this._properties = (o && o.properties) || {}),
                    (this._zoneDelegate = new h(this, this._parent && this._parent._zoneDelegate, o));
                }
                get(r) {
                  const o = this.getZoneWith(r);
                  if (o) return o._properties[r];
                }
                getZoneWith(r) {
                  let o = this;
                  for (; o; ) {
                    if (o._properties.hasOwnProperty(r)) return o;
                    o = o._parent;
                  }
                  return null;
                }
                fork(r) {
                  if (!r) throw new Error('ZoneSpec required!');
                  return this._zoneDelegate.fork(this, r);
                }
                wrap(r, o) {
                  if ('function' != typeof r) throw new Error('Expecting function got: ' + r);
                  const k = this._zoneDelegate.intercept(this, r, o),
                    O = this;
                  return function () {
                    return O.runGuarded(k, this, arguments, o);
                  };
                }
                run(r, o, k, O) {
                  P = { parent: P, zone: this };
                  try {
                    return this._zoneDelegate.invoke(this, r, o, k, O);
                  } finally {
                    P = P.parent;
                  }
                }
                runGuarded(r, o = null, k, O) {
                  P = { parent: P, zone: this };
                  try {
                    try {
                      return this._zoneDelegate.invoke(this, r, o, k, O);
                    } catch (te) {
                      if (this._zoneDelegate.handleError(this, te)) throw te;
                    }
                  } finally {
                    P = P.parent;
                  }
                }
                runTask(r, o, k) {
                  if (r.zone != this)
                    throw new Error(
                      'A task can only be run in the zone of creation! (Creation: ' +
                        (r.zone || ue).name +
                        '; Execution: ' +
                        this.name +
                        ')',
                    );
                  const O = r,
                    { type: te, data: { isPeriodic: H = !1, isRefreshable: Ce = !1 } = {} } = r;
                  if (r.state === oe && (te === K || te === g)) return;
                  const Pe = r.state != G;
                  Pe && O._transitionTo(G, _);
                  const Re = A;
                  (A = O), (P = { parent: P, zone: this });
                  try {
                    te == g && r.data && !H && !Ce && (r.cancelFn = void 0);
                    try {
                      return this._zoneDelegate.invokeTask(this, O, o, k);
                    } catch (ge) {
                      if (this._zoneDelegate.handleError(this, ge)) throw ge;
                    }
                  } finally {
                    const ge = r.state;
                    if (ge !== oe && ge !== se)
                      if (te == K || H || (Ce && ge === v)) Pe && O._transitionTo(_, G, v);
                      else {
                        const d = O._zoneDelegates;
                        this._updateTaskCount(O, -1), Pe && O._transitionTo(oe, G, oe), Ce && (O._zoneDelegates = d);
                      }
                    (P = P.parent), (A = Re);
                  }
                }
                scheduleTask(r) {
                  if (r.zone && r.zone !== this) {
                    let k = this;
                    for (; k; ) {
                      if (k === r.zone)
                        throw Error(
                          `can not reschedule task to ${this.name} which is descendants of the original zone ${r.zone.name}`,
                        );
                      k = k.parent;
                    }
                  }
                  r._transitionTo(v, oe);
                  const o = [];
                  (r._zoneDelegates = o), (r._zone = this);
                  try {
                    r = this._zoneDelegate.scheduleTask(this, r);
                  } catch (k) {
                    throw (r._transitionTo(se, v, oe), this._zoneDelegate.handleError(this, k), k);
                  }
                  return (
                    r._zoneDelegates === o && this._updateTaskCount(r, 1), r.state == v && r._transitionTo(_, v), r
                  );
                }
                scheduleMicroTask(r, o, k, O) {
                  return this.scheduleTask(new E(X, r, o, k, O, void 0));
                }
                scheduleMacroTask(r, o, k, O, te) {
                  return this.scheduleTask(new E(g, r, o, k, O, te));
                }
                scheduleEventTask(r, o, k, O, te) {
                  return this.scheduleTask(new E(K, r, o, k, O, te));
                }
                cancelTask(r) {
                  if (r.zone != this)
                    throw new Error(
                      'A task can only be cancelled in the zone of creation! (Creation: ' +
                        (r.zone || ue).name +
                        '; Execution: ' +
                        this.name +
                        ')',
                    );
                  if (r.state === _ || r.state === G) {
                    r._transitionTo(z, _, G);
                    try {
                      this._zoneDelegate.cancelTask(this, r);
                    } catch (o) {
                      throw (r._transitionTo(se, z), this._zoneDelegate.handleError(this, o), o);
                    }
                    return this._updateTaskCount(r, -1), r._transitionTo(oe, z), (r.runCount = -1), r;
                  }
                }
                _updateTaskCount(r, o) {
                  const k = r._zoneDelegates;
                  -1 == o && (r._zoneDelegates = null);
                  for (let O = 0; O < k.length; O++) k[O]._updateTaskCount(r.type, o);
                }
              }
              return M;
            })();
            const a = {
              name: '',
              onHasTask: (M, p, r, o) => M.hasTask(r, o),
              onScheduleTask: (M, p, r, o) => M.scheduleTask(r, o),
              onInvokeTask: (M, p, r, o, k, O) => M.invokeTask(r, o, k, O),
              onCancelTask: (M, p, r, o) => M.cancelTask(r, o),
            };
            class h {
              get zone() {
                return this._zone;
              }
              constructor(p, r, o) {
                (this._taskCounts = { microTask: 0, macroTask: 0, eventTask: 0 }),
                  (this._zone = p),
                  (this._parentDelegate = r),
                  (this._forkZS = o && (o && o.onFork ? o : r._forkZS)),
                  (this._forkDlgt = o && (o.onFork ? r : r._forkDlgt)),
                  (this._forkCurrZone = o && (o.onFork ? this._zone : r._forkCurrZone)),
                  (this._interceptZS = o && (o.onIntercept ? o : r._interceptZS)),
                  (this._interceptDlgt = o && (o.onIntercept ? r : r._interceptDlgt)),
                  (this._interceptCurrZone = o && (o.onIntercept ? this._zone : r._interceptCurrZone)),
                  (this._invokeZS = o && (o.onInvoke ? o : r._invokeZS)),
                  (this._invokeDlgt = o && (o.onInvoke ? r : r._invokeDlgt)),
                  (this._invokeCurrZone = o && (o.onInvoke ? this._zone : r._invokeCurrZone)),
                  (this._handleErrorZS = o && (o.onHandleError ? o : r._handleErrorZS)),
                  (this._handleErrorDlgt = o && (o.onHandleError ? r : r._handleErrorDlgt)),
                  (this._handleErrorCurrZone = o && (o.onHandleError ? this._zone : r._handleErrorCurrZone)),
                  (this._scheduleTaskZS = o && (o.onScheduleTask ? o : r._scheduleTaskZS)),
                  (this._scheduleTaskDlgt = o && (o.onScheduleTask ? r : r._scheduleTaskDlgt)),
                  (this._scheduleTaskCurrZone = o && (o.onScheduleTask ? this._zone : r._scheduleTaskCurrZone)),
                  (this._invokeTaskZS = o && (o.onInvokeTask ? o : r._invokeTaskZS)),
                  (this._invokeTaskDlgt = o && (o.onInvokeTask ? r : r._invokeTaskDlgt)),
                  (this._invokeTaskCurrZone = o && (o.onInvokeTask ? this._zone : r._invokeTaskCurrZone)),
                  (this._cancelTaskZS = o && (o.onCancelTask ? o : r._cancelTaskZS)),
                  (this._cancelTaskDlgt = o && (o.onCancelTask ? r : r._cancelTaskDlgt)),
                  (this._cancelTaskCurrZone = o && (o.onCancelTask ? this._zone : r._cancelTaskCurrZone)),
                  (this._hasTaskZS = null),
                  (this._hasTaskDlgt = null),
                  (this._hasTaskDlgtOwner = null),
                  (this._hasTaskCurrZone = null);
                const k = o && o.onHasTask;
                (k || (r && r._hasTaskZS)) &&
                  ((this._hasTaskZS = k ? o : a),
                  (this._hasTaskDlgt = r),
                  (this._hasTaskDlgtOwner = this),
                  (this._hasTaskCurrZone = this._zone),
                  o.onScheduleTask ||
                    ((this._scheduleTaskZS = a),
                    (this._scheduleTaskDlgt = r),
                    (this._scheduleTaskCurrZone = this._zone)),
                  o.onInvokeTask ||
                    ((this._invokeTaskZS = a), (this._invokeTaskDlgt = r), (this._invokeTaskCurrZone = this._zone)),
                  o.onCancelTask ||
                    ((this._cancelTaskZS = a), (this._cancelTaskDlgt = r), (this._cancelTaskCurrZone = this._zone)));
              }
              fork(p, r) {
                return this._forkZS ? this._forkZS.onFork(this._forkDlgt, this.zone, p, r) : new t(p, r);
              }
              intercept(p, r, o) {
                return this._interceptZS
                  ? this._interceptZS.onIntercept(this._interceptDlgt, this._interceptCurrZone, p, r, o)
                  : r;
              }
              invoke(p, r, o, k, O) {
                return this._invokeZS
                  ? this._invokeZS.onInvoke(this._invokeDlgt, this._invokeCurrZone, p, r, o, k, O)
                  : r.apply(o, k);
              }
              handleError(p, r) {
                return (
                  !this._handleErrorZS ||
                  this._handleErrorZS.onHandleError(this._handleErrorDlgt, this._handleErrorCurrZone, p, r)
                );
              }
              scheduleTask(p, r) {
                let o = r;
                if (this._scheduleTaskZS)
                  this._hasTaskZS && o._zoneDelegates.push(this._hasTaskDlgtOwner),
                    (o = this._scheduleTaskZS.onScheduleTask(this._scheduleTaskDlgt, this._scheduleTaskCurrZone, p, r)),
                    o || (o = r);
                else if (r.scheduleFn) r.scheduleFn(r);
                else {
                  if (r.type != X) throw new Error('Task is missing scheduleFn.');
                  J(r);
                }
                return o;
              }
              invokeTask(p, r, o, k) {
                return this._invokeTaskZS
                  ? this._invokeTaskZS.onInvokeTask(this._invokeTaskDlgt, this._invokeTaskCurrZone, p, r, o, k)
                  : r.callback.apply(o, k);
              }
              cancelTask(p, r) {
                let o;
                if (this._cancelTaskZS)
                  o = this._cancelTaskZS.onCancelTask(this._cancelTaskDlgt, this._cancelTaskCurrZone, p, r);
                else {
                  if (!r.cancelFn) throw Error('Task is not cancelable');
                  o = r.cancelFn(r);
                }
                return o;
              }
              hasTask(p, r) {
                try {
                  this._hasTaskZS && this._hasTaskZS.onHasTask(this._hasTaskDlgt, this._hasTaskCurrZone, p, r);
                } catch (o) {
                  this.handleError(p, o);
                }
              }
              _updateTaskCount(p, r) {
                const o = this._taskCounts,
                  k = o[p],
                  O = (o[p] = k + r);
                if (O < 0) throw new Error('More tasks executed then were scheduled.');
                (0 != k && 0 != O) ||
                  this.hasTask(this._zone, {
                    microTask: o.microTask > 0,
                    macroTask: o.macroTask > 0,
                    eventTask: o.eventTask > 0,
                    change: p,
                  });
              }
            }
            class E {
              constructor(p, r, o, k, O, te) {
                if (
                  ((this._zone = null),
                  (this.runCount = 0),
                  (this._zoneDelegates = null),
                  (this._state = 'notScheduled'),
                  (this.type = p),
                  (this.source = r),
                  (this.data = k),
                  (this.scheduleFn = O),
                  (this.cancelFn = te),
                  !o)
                )
                  throw new Error('callback is not defined');
                this.callback = o;
                const H = this;
                this.invoke =
                  p === K && k && k.useG
                    ? E.invokeTask
                    : function () {
                        return E.invokeTask.call(de, H, this, arguments);
                      };
              }
              static invokeTask(p, r, o) {
                p || (p = this), he++;
                try {
                  return p.runCount++, p.zone.runTask(p, r, o);
                } finally {
                  1 == he && le(), he--;
                }
              }
              get zone() {
                return this._zone;
              }
              get state() {
                return this._state;
              }
              cancelScheduleRequest() {
                this._transitionTo(oe, v);
              }
              _transitionTo(p, r, o) {
                if (this._state !== r && this._state !== o)
                  throw new Error(
                    `${this.type} '${this.source}': can not transition to '${p}', expecting state '${r}'${o ? " or '" + o + "'" : ''}, was '${this._state}'.`,
                  );
                (this._state = p), p == oe && (this._zoneDelegates = null);
              }
              toString() {
                return this.data && typeof this.data.handleId < 'u'
                  ? this.data.handleId.toString()
                  : Object.prototype.toString.call(this);
              }
              toJSON() {
                return {
                  type: this.type,
                  state: this.state,
                  source: this.source,
                  zone: this.zone.name,
                  runCount: this.runCount,
                };
              }
            }
            const m = fe('setTimeout'),
              b = fe('Promise'),
              S = fe('then');
            let I,
              y = [],
              D = !1;
            function V(M) {
              if ((I || (de[b] && (I = de[b].resolve(0))), I)) {
                let p = I[S];
                p || (p = I.then), p.call(I, M);
              } else de[m](M, 0);
            }
            function J(M) {
              0 === he && 0 === y.length && V(le), M && y.push(M);
            }
            function le() {
              if (!D) {
                for (D = !0; y.length; ) {
                  const M = y;
                  y = [];
                  for (let p = 0; p < M.length; p++) {
                    const r = M[p];
                    try {
                      r.zone.runTask(r, null, null);
                    } catch (o) {
                      C.onUnhandledError(o);
                    }
                  }
                }
                C.microtaskDrainDone(), (D = !1);
              }
            }
            const ue = { name: 'NO ZONE' },
              oe = 'notScheduled',
              v = 'scheduling',
              _ = 'scheduled',
              G = 'running',
              z = 'canceling',
              se = 'unknown',
              X = 'microTask',
              g = 'macroTask',
              K = 'eventTask',
              L = {},
              C = {
                symbol: fe,
                currentZoneFrame: () => P,
                onUnhandledError: ee,
                microtaskDrainDone: ee,
                scheduleMicroTask: J,
                showUncaughtError: () => !t[fe('ignoreConsoleErrorUncaughtError')],
                patchEventTarget: () => [],
                patchOnProperties: ee,
                patchMethod: () => ee,
                bindArguments: () => [],
                patchThen: () => ee,
                patchMacroTask: () => ee,
                patchEventPrototype: () => ee,
                isIEOrEdge: () => !1,
                getGlobalObjects: () => {},
                ObjectDefineProperty: () => ee,
                ObjectGetOwnPropertyDescriptor: () => {},
                ObjectCreate: () => {},
                ArraySlice: () => [],
                patchClass: () => ee,
                wrapWithCurrentZone: () => ee,
                filterProperties: () => [],
                attachOriginToPatched: () => ee,
                _redefineProperty: () => ee,
                patchCallbacks: () => ee,
                nativeScheduleMicroTask: V,
              };
            let P = { parent: null, zone: new t(null, null) },
              A = null,
              he = 0;
            function ee() {}
            return c('Zone', 'Zone'), t;
          })()),
          e.Zone
        );
      })();
      (function Mt(e) {
        (function At(e) {
          e.__load_patch('ZoneAwarePromise', (n, c, t) => {
            const a = Object.getOwnPropertyDescriptor,
              h = Object.defineProperty,
              m = t.symbol,
              b = [],
              S = !1 !== n[m('DISABLE_WRAPPING_UNCAUGHT_PROMISE_REJECTION')],
              y = m('Promise'),
              D = m('then'),
              I = '__creationTrace__';
            (t.onUnhandledError = d => {
              if (t.showUncaughtError()) {
                const u = d && d.rejection;
                u
                  ? console.error(
                      'Unhandled Promise rejection:',
                      u instanceof Error ? u.message : u,
                      '; Zone:',
                      d.zone.name,
                      '; Task:',
                      d.task && d.task.source,
                      '; Value:',
                      u,
                      u instanceof Error ? u.stack : void 0,
                    )
                  : console.error(d);
              }
            }),
              (t.microtaskDrainDone = () => {
                for (; b.length; ) {
                  const d = b.shift();
                  try {
                    d.zone.runGuarded(() => {
                      throw d.throwOriginal ? d.rejection : d;
                    });
                  } catch (u) {
                    J(u);
                  }
                }
              });
            const V = m('unhandledPromiseRejectionHandler');
            function J(d) {
              t.onUnhandledError(d);
              try {
                const u = c[V];
                'function' == typeof u && u.call(this, d);
              } catch {}
            }
            function le(d) {
              return d && d.then;
            }
            function ue(d) {
              return d;
            }
            function oe(d) {
              return H.reject(d);
            }
            const v = m('state'),
              _ = m('value'),
              G = m('finally'),
              z = m('parentPromiseValue'),
              se = m('parentPromiseState'),
              X = 'Promise.then',
              g = null,
              K = !0,
              L = !1,
              C = 0;
            function P(d, u) {
              return i => {
                try {
                  M(d, u, i);
                } catch (f) {
                  M(d, !1, f);
                }
              };
            }
            const A = function () {
                let d = !1;
                return function (i) {
                  return function () {
                    d || ((d = !0), i.apply(null, arguments));
                  };
                };
              },
              he = 'Promise resolved with itself',
              ee = m('currentTaskTrace');
            function M(d, u, i) {
              const f = A();
              if (d === i) throw new TypeError(he);
              if (d[v] === g) {
                let w = null;
                try {
                  ('object' == typeof i || 'function' == typeof i) && (w = i && i.then);
                } catch (R) {
                  return (
                    f(() => {
                      M(d, !1, R);
                    })(),
                    d
                  );
                }
                if (u !== L && i instanceof H && i.hasOwnProperty(v) && i.hasOwnProperty(_) && i[v] !== g)
                  r(i), M(d, i[v], i[_]);
                else if (u !== L && 'function' == typeof w)
                  try {
                    w.call(i, f(P(d, u)), f(P(d, !1)));
                  } catch (R) {
                    f(() => {
                      M(d, !1, R);
                    })();
                  }
                else {
                  d[v] = u;
                  const R = d[_];
                  if (
                    ((d[_] = i),
                    d[G] === G && u === K && ((d[v] = d[se]), (d[_] = d[z])),
                    u === L && i instanceof Error)
                  ) {
                    const T = c.currentTask && c.currentTask.data && c.currentTask.data[I];
                    T && h(i, ee, { configurable: !0, enumerable: !1, writable: !0, value: T });
                  }
                  for (let T = 0; T < R.length; ) o(d, R[T++], R[T++], R[T++], R[T++]);
                  if (0 == R.length && u == L) {
                    d[v] = C;
                    let T = i;
                    try {
                      throw new Error(
                        'Uncaught (in promise): ' +
                          (function E(d) {
                            return d && d.toString === Object.prototype.toString
                              ? ((d.constructor && d.constructor.name) || '') + ': ' + JSON.stringify(d)
                              : d
                                ? d.toString()
                                : Object.prototype.toString.call(d);
                          })(i) +
                          (i && i.stack ? '\n' + i.stack : ''),
                      );
                    } catch (j) {
                      T = j;
                    }
                    S && (T.throwOriginal = !0),
                      (T.rejection = i),
                      (T.promise = d),
                      (T.zone = c.current),
                      (T.task = c.currentTask),
                      b.push(T),
                      t.scheduleMicroTask();
                  }
                }
              }
              return d;
            }
            const p = m('rejectionHandledHandler');
            function r(d) {
              if (d[v] === C) {
                try {
                  const u = c[p];
                  u && 'function' == typeof u && u.call(this, { rejection: d[_], promise: d });
                } catch {}
                d[v] = L;
                for (let u = 0; u < b.length; u++) d === b[u].promise && b.splice(u, 1);
              }
            }
            function o(d, u, i, f, w) {
              r(d);
              const R = d[v],
                T = R ? ('function' == typeof f ? f : ue) : 'function' == typeof w ? w : oe;
              u.scheduleMicroTask(
                X,
                () => {
                  try {
                    const j = d[_],
                      B = !!i && G === i[G];
                    B && ((i[z] = j), (i[se] = R));
                    const Z = u.run(T, void 0, B && T !== oe && T !== ue ? [] : [j]);
                    M(i, !0, Z);
                  } catch (j) {
                    M(i, !1, j);
                  }
                },
                i,
              );
            }
            const O = function () {},
              te = n.AggregateError;
            class H {
              static toString() {
                return 'function ZoneAwarePromise() { [native code] }';
              }
              static resolve(u) {
                return u instanceof H ? u : M(new this(null), K, u);
              }
              static reject(u) {
                return M(new this(null), L, u);
              }
              static withResolvers() {
                const u = {};
                return (
                  (u.promise = new H((i, f) => {
                    (u.resolve = i), (u.reject = f);
                  })),
                  u
                );
              }
              static any(u) {
                if (!u || 'function' != typeof u[Symbol.iterator])
                  return Promise.reject(new te([], 'All promises were rejected'));
                const i = [];
                let f = 0;
                try {
                  for (let T of u) f++, i.push(H.resolve(T));
                } catch {
                  return Promise.reject(new te([], 'All promises were rejected'));
                }
                if (0 === f) return Promise.reject(new te([], 'All promises were rejected'));
                let w = !1;
                const R = [];
                return new H((T, j) => {
                  for (let B = 0; B < i.length; B++)
                    i[B].then(
                      Z => {
                        w || ((w = !0), T(Z));
                      },
                      Z => {
                        R.push(Z), f--, 0 === f && ((w = !0), j(new te(R, 'All promises were rejected')));
                      },
                    );
                });
              }
              static race(u) {
                let i,
                  f,
                  w = new this((j, B) => {
                    (i = j), (f = B);
                  });
                function R(j) {
                  i(j);
                }
                function T(j) {
                  f(j);
                }
                for (let j of u) le(j) || (j = this.resolve(j)), j.then(R, T);
                return w;
              }
              static all(u) {
                return H.allWithCallback(u);
              }
              static allSettled(u) {
                return (this && this.prototype instanceof H ? this : H).allWithCallback(u, {
                  thenCallback: f => ({ status: 'fulfilled', value: f }),
                  errorCallback: f => ({ status: 'rejected', reason: f }),
                });
              }
              static allWithCallback(u, i) {
                let f,
                  w,
                  R = new this((Z, Y) => {
                    (f = Z), (w = Y);
                  }),
                  T = 2,
                  j = 0;
                const B = [];
                for (let Z of u) {
                  le(Z) || (Z = this.resolve(Z));
                  const Y = j;
                  try {
                    Z.then(
                      $ => {
                        (B[Y] = i ? i.thenCallback($) : $), T--, 0 === T && f(B);
                      },
                      $ => {
                        i ? ((B[Y] = i.errorCallback($)), T--, 0 === T && f(B)) : w($);
                      },
                    );
                  } catch ($) {
                    w($);
                  }
                  T++, j++;
                }
                return (T -= 2), 0 === T && f(B), R;
              }
              constructor(u) {
                const i = this;
                if (!(i instanceof H)) throw new Error('Must be an instanceof Promise.');
                (i[v] = g), (i[_] = []);
                try {
                  const f = A();
                  u && u(f(P(i, K)), f(P(i, L)));
                } catch (f) {
                  M(i, !1, f);
                }
              }
              get [Symbol.toStringTag]() {
                return 'Promise';
              }
              get [Symbol.species]() {
                return H;
              }
              then(u, i) {
                var T;
                let f = null == (T = this.constructor) ? void 0 : T[Symbol.species];
                (!f || 'function' != typeof f) && (f = this.constructor || H);
                const w = new f(O),
                  R = c.current;
                return this[v] == g ? this[_].push(R, w, u, i) : o(this, R, w, u, i), w;
              }
              catch(u) {
                return this.then(null, u);
              }
              finally(u) {
                var R;
                let i = null == (R = this.constructor) ? void 0 : R[Symbol.species];
                (!i || 'function' != typeof i) && (i = H);
                const f = new i(O);
                f[G] = G;
                const w = c.current;
                return this[v] == g ? this[_].push(w, f, u, u) : o(this, w, f, u, u), f;
              }
            }
            (H.resolve = H.resolve), (H.reject = H.reject), (H.race = H.race), (H.all = H.all);
            const Ce = (n[y] = n.Promise);
            n.Promise = H;
            const Pe = m('thenPatched');
            function Re(d) {
              const u = d.prototype,
                i = a(u, 'then');
              if (i && (!1 === i.writable || !i.configurable)) return;
              const f = u.then;
              (u[D] = f),
                (d.prototype.then = function (w, R) {
                  return new H((j, B) => {
                    f.call(this, j, B);
                  }).then(w, R);
                }),
                (d[Pe] = !0);
            }
            return (
              (t.patchThen = Re),
              Ce &&
                (Re(Ce),
                pe(n, 'fetch', d =>
                  (function ge(d) {
                    return function (u, i) {
                      let f = d.apply(u, i);
                      if (f instanceof H) return f;
                      let w = f.constructor;
                      return w[Pe] || Re(w), f;
                    };
                  })(d),
                )),
              (Promise[c.__symbol__('uncaughtPromiseErrors')] = b),
              H
            );
          });
        })(e),
          (function Nt(e) {
            e.__load_patch('toString', n => {
              const c = Function.prototype.toString,
                t = U('OriginalDelegate'),
                a = U('Promise'),
                h = U('Error'),
                E = function () {
                  if ('function' == typeof this) {
                    const y = this[t];
                    if (y) return 'function' == typeof y ? c.call(y) : Object.prototype.toString.call(y);
                    if (this === Promise) {
                      const D = n[a];
                      if (D) return c.call(D);
                    }
                    if (this === Error) {
                      const D = n[h];
                      if (D) return c.call(D);
                    }
                  }
                  return c.call(this);
                };
              (E[t] = c), (Function.prototype.toString = E);
              const m = Object.prototype.toString;
              Object.prototype.toString = function () {
                return 'function' == typeof Promise && this instanceof Promise ? '[object Promise]' : m.call(this);
              };
            });
          })(e),
          (function Lt(e) {
            e.__load_patch('util', (n, c, t) => {
              const a = tt(n);
              (t.patchOnProperties = x), (t.patchMethod = pe), (t.bindArguments = ze), (t.patchMacroTask = ie);
              const h = c.__symbol__('BLACK_LISTED_EVENTS'),
                E = c.__symbol__('UNPATCHED_EVENTS');
              n[E] && (n[h] = n[E]),
                n[h] && (c[h] = c[E] = n[h]),
                (t.patchEventPrototype = wt),
                (t.patchEventTarget = vt),
                (t.isIEOrEdge = bt),
                (t.ObjectDefineProperty = Fe),
                (t.ObjectGetOwnPropertyDescriptor = ne),
                (t.ObjectCreate = Ke),
                (t.ArraySlice = Oe),
                (t.patchClass = we),
                (t.wrapWithCurrentZone = Ge),
                (t.filterProperties = ht),
                (t.attachOriginToPatched = ae),
                (t._redefineProperty = Object.defineProperty),
                (t.patchCallbacks = It),
                (t.getGlobalObjects = () => ({
                  globalSources: at,
                  zoneSymbolEventNames: Te,
                  eventNames: a,
                  isBrowser: Ye,
                  isMix: s,
                  isNode: je,
                  TRUE_STR: _e,
                  FALSE_STR: me,
                  ZONE_SYMBOL_PREFIX: Me,
                  ADD_EVENT_LISTENER_STR: Ne,
                  REMOVE_EVENT_LISTENER_STR: Ie,
                }));
            });
          })(e);
      })(_t),
        (function St(e) {
          e.__load_patch('legacy', n => {
            const c = n[e.__symbol__('legacyPatch')];
            c && c();
          }),
            e.__load_patch('timers', n => {
              const c = 'set',
                t = 'clear';
              He(n, c, t, 'Timeout'), He(n, c, t, 'Interval'), He(n, c, t, 'Immediate');
            }),
            e.__load_patch('requestAnimationFrame', n => {
              He(n, 'request', 'cancel', 'AnimationFrame'),
                He(n, 'mozRequest', 'mozCancel', 'AnimationFrame'),
                He(n, 'webkitRequest', 'webkitCancel', 'AnimationFrame');
            }),
            e.__load_patch('blocking', (n, c) => {
              const t = ['alert', 'prompt', 'confirm'];
              for (let a = 0; a < t.length; a++)
                pe(
                  n,
                  t[a],
                  (E, m, b) =>
                    function (S, y) {
                      return c.current.run(E, n, y, b);
                    },
                );
            }),
            e.__load_patch('EventTarget', (n, c, t) => {
              (function Dt(e, n) {
                n.patchEventPrototype(e, n);
              })(n, t),
                (function Ot(e, n) {
                  if (Zone[n.symbol('patchEventTarget')]) return;
                  const {
                    eventNames: c,
                    zoneSymbolEventNames: t,
                    TRUE_STR: a,
                    FALSE_STR: h,
                    ZONE_SYMBOL_PREFIX: E,
                  } = n.getGlobalObjects();
                  for (let b = 0; b < c.length; b++) {
                    const S = c[b],
                      I = E + (S + h),
                      V = E + (S + a);
                    (t[S] = {}), (t[S][h] = I), (t[S][a] = V);
                  }
                  const m = e.EventTarget;
                  m && m.prototype && n.patchEventTarget(e, n, [m && m.prototype]);
                })(n, t);
              const a = n.XMLHttpRequestEventTarget;
              a && a.prototype && t.patchEventTarget(n, t, [a.prototype]);
            }),
            e.__load_patch('MutationObserver', (n, c, t) => {
              we('MutationObserver'), we('WebKitMutationObserver');
            }),
            e.__load_patch('IntersectionObserver', (n, c, t) => {
              we('IntersectionObserver');
            }),
            e.__load_patch('FileReader', (n, c, t) => {
              we('FileReader');
            }),
            e.__load_patch('on_property', (n, c, t) => {
              !(function Ct(e, n) {
                if ((je && !s) || Zone[e.symbol('patchEvents')]) return;
                const c = n.__Zone_ignore_on_properties;
                let t = [];
                if (Ye) {
                  const a = window;
                  t = t.concat([
                    'Document',
                    'SVGElement',
                    'Element',
                    'HTMLElement',
                    'HTMLBodyElement',
                    'HTMLMediaElement',
                    'HTMLFrameSetElement',
                    'HTMLFrameElement',
                    'HTMLIFrameElement',
                    'HTMLMarqueeElement',
                    'Worker',
                  ]);
                  const h = (function gt() {
                    try {
                      const e = De.navigator.userAgent;
                      if (-1 !== e.indexOf('MSIE ') || -1 !== e.indexOf('Trident/')) return !0;
                    } catch {}
                    return !1;
                  })()
                    ? [{ target: a, ignoreProperties: ['error'] }]
                    : [];
                  dt(a, tt(a), c && c.concat(h), Ve(a));
                }
                t = t.concat([
                  'XMLHttpRequest',
                  'XMLHttpRequestEventTarget',
                  'IDBIndex',
                  'IDBRequest',
                  'IDBOpenDBRequest',
                  'IDBDatabase',
                  'IDBTransaction',
                  'IDBCursor',
                  'WebSocket',
                ]);
                for (let a = 0; a < t.length; a++) {
                  const h = n[t[a]];
                  h && h.prototype && dt(h.prototype, tt(h.prototype), c);
                }
              })(t, n);
            }),
            e.__load_patch('customElements', (n, c, t) => {
              !(function Rt(e, n) {
                const { isBrowser: c, isMix: t } = n.getGlobalObjects();
                (c || t) &&
                  e.customElements &&
                  'customElements' in e &&
                  n.patchCallbacks(n, e.customElements, 'customElements', 'define', [
                    'connectedCallback',
                    'disconnectedCallback',
                    'adoptedCallback',
                    'attributeChangedCallback',
                    'formAssociatedCallback',
                    'formDisabledCallback',
                    'formResetCallback',
                    'formStateRestoreCallback',
                  ]);
              })(n, t);
            }),
            e.__load_patch('XHR', (n, c) => {
              !(function S(y) {
                const D = y.XMLHttpRequest;
                if (!D) return;
                const I = D.prototype;
                let J = I[Q],
                  le = I[Le];
                if (!J) {
                  const C = y.XMLHttpRequestEventTarget;
                  if (C) {
                    const P = C.prototype;
                    (J = P[Q]), (le = P[Le]);
                  }
                }
                const ue = 'readystatechange',
                  oe = 'scheduled';
                function v(C) {
                  const P = C.data,
                    A = P.target;
                  (A[E] = !1), (A[b] = !1);
                  const he = A[h];
                  J || ((J = A[Q]), (le = A[Le])), he && le.call(A, ue, he);
                  const ee = (A[h] = () => {
                    if (A.readyState === A.DONE)
                      if (!P.aborted && A[E] && C.state === oe) {
                        const p = A[c.__symbol__('loadfalse')];
                        if (0 !== A.status && p && p.length > 0) {
                          const r = C.invoke;
                          (C.invoke = function () {
                            const o = A[c.__symbol__('loadfalse')];
                            for (let k = 0; k < o.length; k++) o[k] === C && o.splice(k, 1);
                            !P.aborted && C.state === oe && r.call(C);
                          }),
                            p.push(C);
                        } else C.invoke();
                      } else !P.aborted && !1 === A[E] && (A[b] = !0);
                  });
                  return J.call(A, ue, ee), A[t] || (A[t] = C), K.apply(A, P.args), (A[E] = !0), C;
                }
                function _() {}
                function G(C) {
                  const P = C.data;
                  return (P.aborted = !0), L.apply(P.target, P.args);
                }
                const z = pe(
                    I,
                    'open',
                    () =>
                      function (C, P) {
                        return (C[a] = 0 == P[2]), (C[m] = P[1]), z.apply(C, P);
                      },
                  ),
                  X = U('fetchTaskAborting'),
                  g = U('fetchTaskScheduling'),
                  K = pe(
                    I,
                    'send',
                    () =>
                      function (C, P) {
                        if (!0 === c.current[g] || C[a]) return K.apply(C, P);
                        {
                          const A = { target: C, url: C[m], isPeriodic: !1, args: P, aborted: !1 },
                            he = Be('XMLHttpRequest.send', _, A, v, G);
                          C && !0 === C[b] && !A.aborted && he.state === oe && he.invoke();
                        }
                      },
                  ),
                  L = pe(
                    I,
                    'abort',
                    () =>
                      function (C, P) {
                        const A = (function V(C) {
                          return C[t];
                        })(C);
                        if (A && 'string' == typeof A.type) {
                          if (null == A.cancelFn || (A.data && A.data.aborted)) return;
                          A.zone.cancelTask(A);
                        } else if (!0 === c.current[X]) return L.apply(C, P);
                      },
                  );
              })(n);
              const t = U('xhrTask'),
                a = U('xhrSync'),
                h = U('xhrListener'),
                E = U('xhrScheduled'),
                m = U('xhrURL'),
                b = U('xhrErrorBeforeScheduled');
            }),
            e.__load_patch('geolocation', n => {
              n.navigator &&
                n.navigator.geolocation &&
                (function ye(e, n) {
                  const c = e.constructor.name;
                  for (let t = 0; t < n.length; t++) {
                    const a = n[t],
                      h = e[a];
                    if (h) {
                      if (!Xe(ne(e, a))) continue;
                      e[a] = (m => {
                        const b = function () {
                          return m.apply(this, ze(arguments, c + '.' + a));
                        };
                        return ae(b, m), b;
                      })(h);
                    }
                  }
                })(n.navigator.geolocation, ['getCurrentPosition', 'watchPosition']);
            }),
            e.__load_patch('PromiseRejectionEvent', (n, c) => {
              function t(a) {
                return function (h) {
                  ft(n, a).forEach(m => {
                    const b = n.PromiseRejectionEvent;
                    if (b) {
                      const S = new b(a, { promise: h.promise, reason: h.rejection });
                      m.invoke(S);
                    }
                  });
                };
              }
              n.PromiseRejectionEvent &&
                ((c[U('unhandledPromiseRejectionHandler')] = t('unhandledrejection')),
                (c[U('rejectionHandledHandler')] = t('rejectionhandled')));
            }),
            e.__load_patch('queueMicrotask', (n, c, t) => {
              !(function Pt(e, n) {
                n.patchMethod(
                  e,
                  'queueMicrotask',
                  c =>
                    function (t, a) {
                      Zone.current.scheduleMicroTask('queueMicrotask', a[0]);
                    },
                );
              })(n, t);
            });
        })(_t);
    },
  },
  de => {
    de((de.s = 74163));
  },
]);
