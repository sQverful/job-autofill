'use strict';
(self.webpackChunkoneclick_ui = self.webpackChunkoneclick_ui || []).push([
  [792],
  {
    45233: (y, g, t) => {
      t.d(g, { R: () => T, y: () => h });
      var i = t(54438),
        a = t(41780),
        v = t(88141),
        r = t(75205);
      const T = 'x-custom-error';
      function h(s, c) {
        const d = (0, i.WQX)(r.f),
          e = (0, i.WQX)(a.c$);
        return s.headers.has(T)
          ? c(s.clone({ headers: s.headers.delete(T) }))
          : c(s).pipe(
              (0, v.M)({
                error: () => {
                  const O = e.instant('oneclick-ui.common.errors.generic-error-retry');
                  d.showError(O);
                },
              }),
            );
      }
    },
    76691: (y, g, t) => {
      t.d(g, { V: () => h });
      var i = t(75765),
        a = t(96354),
        v = t(54438),
        r = t(21626);
      let T = (() => {
          class s {
            constructor(d) {
              this.httpClient = d;
            }
            geFeatureAccess(d, e) {
              return this.httpClient.get(`/oneclick-ui/api/companies/feature-access?companyId=${d}&feature=${e}`);
            }
            static #t = (this.ɵfac = function (e) {
              return new (e || s)(v.KVO(r.Qq));
            });
            static #n = (this.ɵprov = v.jDH({ token: s, factory: s.ɵfac, providedIn: 'root' }));
          }
          return s;
        })(),
        h = (() => {
          class s {
            constructor(d, e) {
              (this.window = d),
                (this.accessService = e),
                (this.ocContextCopy = JSON.parse(JSON.stringify(this.window.__OC_CONTEXT__)));
            }
            getContext() {
              return this.ocContextCopy;
            }
            getStepsMetadata() {
              const { hasInlineAssessments: d, screeningConfiguration: e } = this.getContext();
              return { hasInlineAssessments: d, hasScreeningQuestions: e.questions && e.questions.length > 0 };
            }
            isFeatureToggleEnabled(d) {
              const e = this.getContext().company.id;
              return this.accessService.geFeatureAccess(e, d).pipe((0, a.T)(E => E.hasAccess));
            }
            getCalculatedBrandingColors() {
              return this.getContext().calculatedBranding;
            }
            hasScreeningQuestions() {
              var d, e;
              return (
                (null == (e = null == (d = this.getContext().screeningConfiguration) ? void 0 : d.questions)
                  ? void 0
                  : e.length) > 0
              );
            }
            static #t = (this.ɵfac = function (e) {
              return new (e || s)(v.KVO(i.j), v.KVO(T));
            });
            static #n = (this.ɵprov = v.jDH({ token: s, factory: s.ɵfac, providedIn: 'root' }));
          }
          return s;
        })();
    },
    75205: (y, g, t) => {
      t.d(g, { f: () => v });
      var i = t(5098),
        a = t(54438);
      let v = (() => {
        class r {
          constructor() {
            this.DEFAULT_DURATION = 3e3;
          }
          show(h, s, c = !0, d = this.DEFAULT_DURATION) {
            const e = new i.H$({ duration: d, variant: s, showClose: c, unsafeHTML: h });
            document.dispatchEvent(e);
          }
          showError(h, s = this.DEFAULT_DURATION, c = !1) {
            this.show(h, i.Hd.error, c, s);
          }
          showSuccess(h, s = this.DEFAULT_DURATION, c = !1) {
            this.show(h, i.Hd.success, c, s);
          }
          showWarning(h, s = this.DEFAULT_DURATION, c = !1) {
            this.show(h, i.Hd.warning, c, s);
          }
          showInfo(h, s = this.DEFAULT_DURATION, c = !1) {
            this.show(h, i.Hd.info, c, s);
          }
          static #t = (this.ɵfac = function (s) {
            return new (s || r)();
          });
          static #n = (this.ɵprov = a.jDH({ token: r, factory: r.ɵfac, providedIn: 'root' }));
        }
        return r;
      })();
    },
    75765: (y, g, t) => {
      t.d(g, { j: () => a });
      const a = new (t(54438).nKC)('WINDOW');
    },
    97144: (y, g, t) => {
      t.d(g, { c: () => i });
      const i = {
        production: !0,
        staticFilesConfig: {
          imgRootPath: 'https://av-www.smartrecruiters.com/oneclick-ui/static/assets/images/',
          jsRootPath: 'https://js-www.smartrecruiters.com/oneclick-ui/static/',
        },
      };
    },
    94008: (y, g, t) => {
      var i = t(10467),
        a = t(54438),
        v = t(97144),
        r = t(65647);
      t(75634);
      let h = (() => {
        class n {
          sendFMPEvent() {
            const l = new CustomEvent('srOneClickUiAppBootstrapInitEvent', { bubbles: !0, cancelable: !0 });
            window.parent && window.parent !== window && window.parent.document.dispatchEvent(l),
              window.document.dispatchEvent(l);
          }
          static #t = (this.ɵfac = function (o) {
            return new (o || n)();
          });
          static #n = (this.ɵprov = a.jDH({ token: n, factory: n.ɵfac, providedIn: 'root' }));
        }
        return n;
      })();
      var s = t(32457);
      let c = (() => {
        class n {
          constructor() {
            (this.perfasticAgentService = (0, a.WQX)(h)), (this.theme = r.uJ);
          }
          ngOnInit() {
            this.perfasticAgentService.sendFMPEvent();
          }
          static #t = (this.ɵfac = function (o) {
            return new (o || n)();
          });
          static #n = (this.ɵcmp = a.VBU({
            type: n,
            selectors: [['oc-app-root']],
            standalone: !0,
            features: [a.aNF],
            decls: 3,
            vars: 1,
            consts: [[3, 'theme']],
            template: function (o, m) {
              1 & o && (a.j41(0, 'spl-wrapper', 0), a.nrm(1, 'router-outlet')(2, 'spl-toaster'), a.k0s()),
                2 & o && a.Y8G('theme', m.theme);
            },
            dependencies: [s.n3],
            encapsulation: 2,
          }));
        }
        return n;
      })();
      var d = t(86551),
        e = t(69184);
      const E_FORM = 'oneclick-ui.page.title.prefix.form',
        E_SCREENING = 'oneclick-ui.page.title.prefix.screening';
      var O = t(41780);
      const U = [
        {
          path: '',
          resolve: {
            _: () => {
              const n = (0, a.WQX)(O.c$);
              return n.getTranslation(n.currentLang);
            },
          },
          children: [
            {
              path: 'visual-regression',
              loadComponent: () =>
                t
                  .e(632)
                  .then(t.bind(t, 65632))
                  .then(n => n.VisualRegressionPageComponent),
            },
            {
              path: 'company/:companyId/job/:jobId/publication/:publicationId',
              loadComponent: () =>
                Promise.all([t.e(775), t.e(511), t.e(795)])
                  .then(t.bind(t, 37795))
                  .then(n => n.OneclickFormRootComponent),
              children: [
                {
                  path: '',
                  loadComponent: () =>
                    Promise.all([t.e(775), t.e(109), t.e(979), t.e(898), t.e(100), t.e(76), t.e(726)])
                      .then(t.bind(t, 52726))
                      .then(n => n.OneclickFormComponent),
                  data: { titleConfig: { prefixTranslationKey: E_FORM } },
                },
                {
                  path: 'screening',
                  loadComponent: () =>
                    Promise.all([t.e(775), t.e(109), t.e(979), t.e(898), t.e(76), t.e(85)])
                      .then(t.bind(t, 57085))
                      .then(n => n.ScreeningQuestionsComponent),
                  data: { titleConfig: { prefixTranslationKey: E_SCREENING } },
                },
                {
                  path: 'assessment',
                  loadComponent: () =>
                    Promise.all([t.e(775), t.e(109), t.e(432)])
                      .then(t.bind(t, 7432))
                      .then(n => n.AssessmentLandingComponent),
                },
                {
                  path: 'assessment/complete/:operationId',
                  loadComponent: () =>
                    Promise.all([t.e(775), t.e(109), t.e(76), t.e(481)])
                      .then(t.bind(t, 2481))
                      .then(n => n.AssessmentPreExitComponent),
                },
                {
                  path: 'assessment/complete/:operationId/submit',
                  loadComponent: () =>
                    Promise.all([t.e(775), t.e(109), t.e(76), t.e(314)])
                      .then(t.bind(t, 36314))
                      .then(n => n.AssessmentExitComponent),
                },
                {
                  path: 'success',
                  loadComponent: () =>
                    t
                      .e(372)
                      .then(t.bind(t, 75372))
                      .then(n => n.SuccessPageComponent),
                },
              ],
            },
            {
              path: 'company/:companyIdentifier/publication/:publicationUuid',
              loadComponent: () =>
                Promise.all([t.e(775), t.e(511), t.e(795)])
                  .then(t.bind(t, 37795))
                  .then(n => n.OneclickFormRootComponent),
              children: [
                {
                  path: '',
                  loadComponent: () =>
                    Promise.all([t.e(775), t.e(109), t.e(979), t.e(898), t.e(100), t.e(76), t.e(726)])
                      .then(t.bind(t, 52726))
                      .then(n => n.OneclickFormComponent),
                  data: { titleConfig: { prefixTranslationKey: E_FORM } },
                },
                {
                  path: 'screening',
                  loadComponent: () =>
                    Promise.all([t.e(775), t.e(109), t.e(979), t.e(898), t.e(76), t.e(85)])
                      .then(t.bind(t, 57085))
                      .then(n => n.ScreeningQuestionsComponent),
                  data: { titleConfig: { prefixTranslationKey: E_SCREENING } },
                },
                {
                  path: 'assessment',
                  loadComponent: () =>
                    Promise.all([t.e(775), t.e(109), t.e(432)])
                      .then(t.bind(t, 7432))
                      .then(n => n.AssessmentLandingComponent),
                },
                {
                  path: 'assessment/complete/:operationId',
                  loadComponent: () =>
                    Promise.all([t.e(775), t.e(109), t.e(76), t.e(481)])
                      .then(t.bind(t, 2481))
                      .then(n => n.AssessmentPreExitComponent),
                },
                {
                  path: 'assessment/complete/:operationId/submit',
                  loadComponent: () =>
                    Promise.all([t.e(775), t.e(109), t.e(76), t.e(314)])
                      .then(t.bind(t, 36314))
                      .then(n => n.AssessmentExitComponent),
                },
                {
                  path: 'success',
                  loadComponent: () =>
                    t
                      .e(372)
                      .then(t.bind(t, 75372))
                      .then(n => n.SuccessPageComponent),
                },
              ],
            },
            {
              path: 'company/:companyIdentifier/publication/:publicationUuid/expired',
              loadComponent: () =>
                Promise.all([t.e(775), t.e(399)])
                  .then(t.bind(t, 80399))
                  .then(n => n.ExpiringPostingAnonymousComponent),
            },
            {
              path: 'company/:companyIdentifier/job/:jobId',
              loadComponent: () =>
                Promise.all([t.e(775), t.e(511), t.e(795)])
                  .then(t.bind(t, 37795))
                  .then(n => n.OneclickFormRootComponent),
              children: [
                {
                  path: '',
                  loadComponent: () =>
                    Promise.all([t.e(775), t.e(109), t.e(979), t.e(898), t.e(100), t.e(76), t.e(726)])
                      .then(t.bind(t, 52726))
                      .then(n => n.OneclickFormComponent),
                  data: { titleConfig: { prefixTranslationKey: E_FORM } },
                },
                {
                  path: 'screening',
                  loadComponent: () =>
                    Promise.all([t.e(775), t.e(109), t.e(979), t.e(898), t.e(76), t.e(85)])
                      .then(t.bind(t, 57085))
                      .then(n => n.ScreeningQuestionsComponent),
                  data: { titleConfig: { prefixTranslationKey: E_SCREENING } },
                },
                {
                  path: 'success',
                  loadComponent: () =>
                    t
                      .e(372)
                      .then(t.bind(t, 75372))
                      .then(n => n.SuccessPageComponent),
                },
              ],
            },
            {
              path: 'partners',
              loadComponent: () =>
                Promise.all([t.e(775), t.e(511), t.e(795)])
                  .then(t.bind(t, 37795))
                  .then(n => n.OneclickFormRootComponent),
              children: [
                {
                  path: '',
                  loadComponent: () =>
                    Promise.all([t.e(775), t.e(109), t.e(979), t.e(100), t.e(426)])
                      .then(t.bind(t, 96426))
                      .then(n => n.PartnersFormComponent),
                },
              ],
            },
            {
              path: 'company/:companyId/job/:jobId/partners',
              loadComponent: () =>
                Promise.all([t.e(775), t.e(511), t.e(795)])
                  .then(t.bind(t, 37795))
                  .then(n => n.OneclickFormRootComponent),
              children: [
                {
                  path: '',
                  loadComponent: () =>
                    Promise.all([t.e(775), t.e(109), t.e(979), t.e(100), t.e(426)])
                      .then(t.bind(t, 96426))
                      .then(n => n.PartnersFormComponent),
                },
              ],
            },
            {
              path: 'partners/company/:companyId/job/:jobId',
              loadComponent: () =>
                Promise.all([t.e(775), t.e(511), t.e(795)])
                  .then(t.bind(t, 37795))
                  .then(n => n.OneclickFormRootComponent),
              children: [
                {
                  path: '',
                  loadComponent: () =>
                    Promise.all([t.e(775), t.e(109), t.e(979), t.e(100), t.e(426)])
                      .then(t.bind(t, 96426))
                      .then(n => n.PartnersFormComponent),
                },
              ],
            },
            {
              path: 'ep/company/:companyIdentifier/publication/:publicationUuid',
              loadComponent: () =>
                Promise.all([t.e(775), t.e(511), t.e(558)])
                  .then(t.bind(t, 67558))
                  .then(n => n.EmployeePortalFormRootComponent),
              children: [
                {
                  path: '',
                  loadComponent: () =>
                    Promise.all([t.e(775), t.e(109), t.e(979), t.e(898), t.e(100), t.e(76), t.e(472)])
                      .then(t.bind(t, 10472))
                      .then(n => n.EmployeePortalFormComponent),
                },
                {
                  path: 'screening',
                  loadComponent: () =>
                    Promise.all([t.e(775), t.e(109), t.e(979), t.e(898), t.e(76), t.e(866)])
                      .then(t.bind(t, 41866))
                      .then(n => n.EmployeePortalAdditionalInfoComponent),
                },
              ],
            },
          ],
        },
      ];
      var A = t(89417),
        D = t(21626),
        x = t(345),
        L = t(91932),
        M = t(54843),
        p = t(86958),
        S = t(76691);
      let K = (() => {
        class n {
          constructor(l) {
            this.contextService = l;
          }
          getLanguage() {
            return this.contextService.getContext().language || 'en';
          }
          getNormalizedLanguage() {
            return this.getLanguage().toLowerCase().replace('_', '-');
          }
          static #t = (this.ɵfac = function (o) {
            return new (o || n)(a.KVO(S.V));
          });
          static #n = (this.ɵprov = a.jDH({ token: n, factory: n.ɵfac, providedIn: 'root' }));
        }
        return n;
      })();
      t(5301),
        t(23494),
        t(5098),
        t(1352),
        t(96634),
        t(9309),
        t(55898),
        t(57580),
        t(90164),
        t(98348),
        t(4981),
        t(70679),
        t(20055),
        t(71918),
        t(82844),
        t(74145);
      var j = t(75765),
        W = t(45233),
        B = t(60177);
      let H = (() => {
          class n {
            constructor(l) {
              (this.document = l), (this.pageTitle = this.document.title), (this.translationService = (0, a.WQX)(O.c$));
            }
            getTitle(l) {
              var o = this;
              return (0, i.A)(function* () {
                const m = o.findTitlePrefix(l);
                if (!m) return o.pageTitle;
                const C = yield o.getPrefixTranslation(m);
                return C ? `${C} - ${o.pageTitle}` : o.pageTitle;
              })();
            }
            getPrefixTranslation(l) {
              var o = this;
              return (0, i.A)(function* () {
                const m = l.split('.'),
                  C = o.translationService.currentLang,
                  P = yield o.translationService.getTranslation(C).toPromise();
                return o.getTranslationByPath(m, P);
              })();
            }
            getTranslationByPath(l, o) {
              const m = l.reduce((C, P) => {
                if (C && C[P]) return C[P];
              }, o);
              if ('string' == typeof m) return m;
            }
            findTitlePrefix(l) {
              const { root: o } = l;
              return this.findConfigInChildren(o);
            }
            findConfigInChildren(l, o = null) {
              const { children: m, data: C } = l,
                { titleConfig: P } = C;
              return (
                P && (o = C.titleConfig.prefixTranslationKey),
                l.children &&
                  m.forEach(F => {
                    const R = this.findConfigInChildren(F, o);
                    R && (o = R);
                  }),
                o
              );
            }
            static #t = (this.ɵfac = function (o) {
              return new (o || n)(a.KVO(B.qQ));
            });
            static #n = (this.ɵprov = a.jDH({ token: n, factory: n.ɵfac, providedIn: 'root' }));
          }
          return n;
        })(),
        V = (() => {
          class n extends s.Oy {
            constructor(l, o) {
              super(), (this.title = l), (this.pageTitleService = o);
            }
            updateTitle(l) {
              var o = this;
              return (0, i.A)(function* () {
                const m = yield o.pageTitleService.getTitle(l);
                o.title.setTitle(m);
              })();
            }
            static #t = (this.ɵfac = function (o) {
              return new (o || n)(a.KVO(x.hE), a.KVO(H));
            });
            static #n = (this.ɵprov = a.jDH({ token: n, factory: n.ɵfac }));
          }
          return n;
        })();
      (t.p = v.c.staticFilesConfig.jsRootPath),
        v.c.production && (0, a.SmG)(),
        (0, x.B8)(c, {
          providers: [
            (0, a.oKB)(
              x.Bb,
              A.YN,
              A.X1,
              p.MD.forRoot({
                strategy: p._1.Http,
                httpLoaderConfig: {
                  fetchFrom: '/oneclick-ui/i18n/',
                  bundles: [
                    'oneclick-ui',
                    'oneclick-location-autocomplete',
                    'questions-ui-component',
                    'location-autocomplete',
                  ],
                },
              }),
              d.ag,
            ),
            {
              provide: a.hnV,
              multi: !0,
              useFactory: (n, I) =>
                ((n, I) =>
                  (0, i.A)(function* () {
                    const l = n.getLanguage();
                    try {
                      yield (0, M._)(I.use(l));
                    } catch (o) {
                      console.error(o);
                    }
                    (0, L.j0)(l);
                  }))(n, I),
              deps: [K, O.c$],
            },
            { provide: j.j, useValue: window },
            { provide: s.Oy, useClass: V },
            (0, D.$R)(
              (0, D.b$)([
                function N(n, I) {
                  const l = (0, a.WQX)(S.V),
                    o = new RegExp('^(?:[a-z]+:)?//', 'i');
                  return (function C(f) {
                    return (
                      (function R(f) {
                        return (
                          !f.urlWithParams.includes('dcr_id') &&
                          !f.urlWithParams.includes('dcr_dc') &&
                          !f.headers.has('DCR-DC')
                        );
                      })(f) &&
                      ((function F(f) {
                        return !o.test(f);
                      })(f.url) ||
                        (function P(f) {
                          return f.includes('smartrecruiters.com');
                        })(f.url))
                    );
                  })(n)
                    ? I(
                        (function m(f) {
                          const { env: $ } = l.getContext();
                          return f.clone({ setHeaders: { 'DCR-DC': $ } });
                        })(n),
                      )
                    : I(n);
                },
                W.y,
              ]),
            ),
            (0, e.vF)(),
            (0, s.lh)(U, (0, s.oH)({ scrollPositionRestoration: 'top' })),
          ],
        }).catch(n => console.error(n));
    },
  },
  y => {
    y.O(0, [502], () => y((y.s = 94008))), y.O();
  },
]);
