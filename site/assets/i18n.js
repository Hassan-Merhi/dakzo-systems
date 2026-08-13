const DEFAULT_LANGUAGE = 'en-US';
const STORAGE_KEY = 'dakzo-language';

const LANGUAGES = [
  { code: 'en-US', label: 'English (US)', dir: 'ltr' },
  { code: 'fr', label: 'Français', dir: 'ltr' },
  { code: 'ar', label: 'العربية', dir: 'rtl' },
  { code: 'es', label: 'Español', dir: 'ltr' }
];

const STRINGS = {
  'en-US': {
    language: 'Language',
    skipMain: 'Skip to main content',
    homeLabel: 'Dakzo Systems home',
    companySubline: 'A Dakik LLC Company',
    openNav: 'Open navigation',
    closeNav: 'Close navigation',
    primaryNav: 'Primary navigation',
    solutions: 'Solutions',
    services: 'Services',
    work: 'Work',
    about: 'About',
    insights: 'Insights',
    startProject: 'Start a project',
    company: 'Company',
    build: 'Build',
    selectedSystems: 'Selected systems',
    footerDescription: 'We design and build custom software, applications, websites, business systems, logistics technology, tracking platforms, and automation.',
    footerLegal: '© {year} Dakzo Systems. A Dakik LLC Company.',
    footerTagline: 'Custom software built around real operations.',
    createBrief: 'Create project brief',
    copyBrief: 'Copy brief',
    copied: 'Copied',
    inquiryIdle: 'We do not submit anything automatically from this static site. Your brief stays in your browser until you choose to send it.',
    inquiryReady: 'Project brief ready. Copy it below and send it through your preferred Dakzo contact channel.',
    briefTitle: 'Dakzo Systems — Project Inquiry',
    briefName: 'Name',
    briefCompany: 'Company',
    briefEmail: 'Email',
    briefProjectType: 'Project type',
    briefTimeline: 'Timeline',
    briefBudget: 'Budget',
    briefDetails: 'What needs to work better:'
  },
  fr: {
    language: 'Langue',
    skipMain: 'Aller au contenu principal',
    homeLabel: 'Accueil Dakzo Systems',
    companySubline: 'Une société de Dakik LLC',
    openNav: 'Ouvrir la navigation',
    closeNav: 'Fermer la navigation',
    primaryNav: 'Navigation principale',
    solutions: 'Solutions',
    services: 'Services',
    work: 'Réalisations',
    about: 'À propos',
    insights: 'Analyses',
    startProject: 'Démarrer un projet',
    company: 'Entreprise',
    build: 'Créer',
    selectedSystems: 'Systèmes sélectionnés',
    footerDescription: 'Nous concevons et développons des logiciels sur mesure, des applications, des sites web, des systèmes métier, des technologies logistiques, des plateformes de suivi et des automatisations.',
    footerLegal: '© {year} Dakzo Systems. Une société de Dakik LLC.',
    footerTagline: 'Des logiciels sur mesure conçus autour des opérations réelles.',
    createBrief: 'Créer le brief du projet',
    copyBrief: 'Copier le brief',
    copied: 'Copié',
    inquiryIdle: 'Aucune donnée n’est envoyée automatiquement depuis ce site statique. Votre brief reste dans votre navigateur jusqu’à ce que vous choisissiez de l’envoyer.',
    inquiryReady: 'Le brief du projet est prêt. Copiez-le ci-dessous et envoyez-le via votre canal de contact Dakzo préféré.',
    briefTitle: 'Dakzo Systems — Demande de projet',
    briefName: 'Nom',
    briefCompany: 'Entreprise',
    briefEmail: 'E-mail',
    briefProjectType: 'Type de projet',
    briefTimeline: 'Délai',
    briefBudget: 'Budget',
    briefDetails: 'Ce qui doit mieux fonctionner :'
  },
  ar: {
    language: 'اللغة',
    skipMain: 'الانتقال إلى المحتوى الرئيسي',
    homeLabel: 'الصفحة الرئيسية لـ Dakzo Systems',
    companySubline: 'إحدى شركات Dakik LLC',
    openNav: 'فتح قائمة التنقل',
    closeNav: 'إغلاق قائمة التنقل',
    primaryNav: 'التنقل الرئيسي',
    solutions: 'الحلول',
    services: 'الخدمات',
    work: 'أعمالنا',
    about: 'من نحن',
    insights: 'الرؤى',
    startProject: 'ابدأ مشروعًا',
    company: 'الشركة',
    build: 'التطوير',
    selectedSystems: 'أنظمة مختارة',
    footerDescription: 'نصمم ونبني برمجيات مخصصة وتطبيقات ومواقع إلكترونية وأنظمة أعمال وتقنيات لوجستية ومنصات تتبع وحلول أتمتة.',
    footerLegal: '© {year} Dakzo Systems. إحدى شركات Dakik LLC.',
    footerTagline: 'برمجيات مخصصة مبنية حول العمليات الفعلية.',
    createBrief: 'إنشاء موجز المشروع',
    copyBrief: 'نسخ الموجز',
    copied: 'تم النسخ',
    inquiryIdle: 'لا نرسل أي بيانات تلقائيًا من هذا الموقع الثابت. يبقى موجزك في متصفحك إلى أن تختار إرساله.',
    inquiryReady: 'موجز المشروع جاهز. انسخه أدناه وأرسله عبر قناة التواصل المفضلة لديك مع Dakzo.',
    briefTitle: 'Dakzo Systems — طلب مشروع',
    briefName: 'الاسم',
    briefCompany: 'الشركة',
    briefEmail: 'البريد الإلكتروني',
    briefProjectType: 'نوع المشروع',
    briefTimeline: 'الجدول الزمني',
    briefBudget: 'الميزانية',
    briefDetails: 'ما الذي يحتاج إلى العمل بشكل أفضل:'
  },
  es: {
    language: 'Idioma',
    skipMain: 'Ir al contenido principal',
    homeLabel: 'Inicio de Dakzo Systems',
    companySubline: 'Una empresa de Dakik LLC',
    openNav: 'Abrir navegación',
    closeNav: 'Cerrar navegación',
    primaryNav: 'Navegación principal',
    solutions: 'Soluciones',
    services: 'Servicios',
    work: 'Proyectos',
    about: 'Nosotros',
    insights: 'Perspectivas',
    startProject: 'Iniciar un proyecto',
    company: 'Empresa',
    build: 'Desarrollo',
    selectedSystems: 'Sistemas seleccionados',
    footerDescription: 'Diseñamos y desarrollamos software a medida, aplicaciones, sitios web, sistemas empresariales, tecnología logística, plataformas de seguimiento y automatización.',
    footerLegal: '© {year} Dakzo Systems. Una empresa de Dakik LLC.',
    footerTagline: 'Software a medida creado alrededor de operaciones reales.',
    createBrief: 'Crear resumen del proyecto',
    copyBrief: 'Copiar resumen',
    copied: 'Copiado',
    inquiryIdle: 'No enviamos nada automáticamente desde este sitio estático. Tu resumen permanece en tu navegador hasta que decidas enviarlo.',
    inquiryReady: 'El resumen del proyecto está listo. Cópialo abajo y envíalo por tu canal de contacto de Dakzo preferido.',
    briefTitle: 'Dakzo Systems — Consulta de proyecto',
    briefName: 'Nombre',
    briefCompany: 'Empresa',
    briefEmail: 'Correo electrónico',
    briefProjectType: 'Tipo de proyecto',
    briefTimeline: 'Plazo',
    briefBudget: 'Presupuesto',
    briefDetails: 'Qué necesita funcionar mejor:'
  }
};

function validLanguage(value) {
  return LANGUAGES.some((language) => language.code === value) ? value : DEFAULT_LANGUAGE;
}

function readStoredLanguage() {
  try {
    return validLanguage(localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

function storeLanguage(language) {
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Storage can be blocked by browser privacy settings; the current page still works.
  }
}

function interpolate(value, replacements = {}) {
  return Object.entries(replacements).reduce(
    (text, [key, replacement]) => text.replaceAll(`{${key}}`, String(replacement)),
    value
  );
}

function ensureStylesheet() {
  if (document.querySelector('link[data-i18n-styles]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/assets/i18n.css';
  link.dataset.i18nStyles = '';
  document.head.append(link);
}

function setText(selector, value) {
  document.querySelectorAll(selector).forEach((node) => {
    node.textContent = value;
  });
}

function setNavText(href, value) {
  document.querySelectorAll(`[data-nav] a[href="${href}"], .site-footer a[href="${href}"]`).forEach((node) => {
    node.textContent = value;
  });
}

function ensureLanguagePicker() {
  const nav = document.querySelector('[data-nav]');
  if (!nav) return null;
  const existing = nav.querySelector('[data-language-picker]');
  if (existing) return existing.querySelector('select');

  const wrapper = document.createElement('div');
  wrapper.className = 'language-picker';
  wrapper.dataset.languagePicker = '';

  const select = document.createElement('select');
  select.name = 'language';
  select.autocomplete = 'off';
  select.dataset.languageSelect = '';
  for (const language of LANGUAGES) {
    const option = document.createElement('option');
    option.value = language.code;
    option.textContent = language.label;
    select.append(option);
  }
  wrapper.append(select);

  const cta = nav.querySelector('.nav-cta');
  if (cta) nav.insertBefore(wrapper, cta);
  else nav.append(wrapper);
  return select;
}

function translateSharedUi(language) {
  const strings = STRINGS[language] || STRINGS[DEFAULT_LANGUAGE];
  const direction = LANGUAGES.find((item) => item.code === language)?.dir || 'ltr';
  const menuToggle = document.querySelector('[data-menu-toggle]');
  const menuOpen = menuToggle?.getAttribute('aria-expanded') === 'true';

  document.documentElement.lang = language;
  document.documentElement.dir = direction;
  document.documentElement.dataset.locale = language;

  setText('.skip-link', strings.skipMain);
  document.querySelectorAll('.brand[aria-label]').forEach((brand) => brand.setAttribute('aria-label', strings.homeLabel));
  setText('.brand-copy small', strings.companySubline);
  if (menuToggle) menuToggle.setAttribute('aria-label', menuOpen ? strings.closeNav : strings.openNav);
  document.querySelector('[data-nav]')?.setAttribute('aria-label', strings.primaryNav);

  setNavText('/solutions/', strings.solutions);
  setNavText('/services/', strings.services);
  setNavText('/work/', strings.work);
  setNavText('/about/', strings.about);
  setNavText('/insights/', strings.insights);
  document.querySelectorAll('a.nav-cta, .site-footer a[href="/contact/"]').forEach((node) => {
    node.textContent = strings.startProject;
  });

  setText('.site-footer .footer-col h2:nth-of-type(1)', strings.company);
  const footerHeadings = document.querySelectorAll('.site-footer .footer-col h2');
  if (footerHeadings[0]) footerHeadings[0].textContent = strings.company;
  if (footerHeadings[1]) footerHeadings[1].textContent = strings.build;
  if (footerHeadings[2]) footerHeadings[2].textContent = strings.selectedSystems;
  setText('.site-footer .footer-brand > p', strings.footerDescription);

  const footerBottom = document.querySelectorAll('.site-footer .footer-bottom > span');
  if (footerBottom[0]) footerBottom[0].textContent = interpolate(strings.footerLegal, { year: new Date().getFullYear() });
  if (footerBottom[1]) footerBottom[1].textContent = strings.footerTagline;

  setText('[data-project-form] button[type="submit"]', strings.createBrief);
  setText('[data-copy-brief]', strings.copyBrief);
  const status = document.querySelector('[data-inquiry-status]');
  if (status && !status.dataset.ready) status.textContent = strings.inquiryIdle;

  const select = document.querySelector('[data-language-select]');
  if (select) {
    select.setAttribute('aria-label', strings.language);
    select.setAttribute('title', strings.language);
    select.value = language;
  }
}

export function initI18n() {
  if (window.DakzoI18n?.ready) return window.DakzoI18n;
  ensureStylesheet();
  const select = ensureLanguagePicker();
  let currentLanguage = readStoredLanguage();

  const api = {
    ready: true,
    languages: LANGUAGES.map(({ code, label, dir }) => ({ code, label, dir })),
    get language() {
      return currentLanguage;
    },
    t(key, replacements) {
      const strings = STRINGS[currentLanguage] || STRINGS[DEFAULT_LANGUAGE];
      return interpolate(strings[key] || STRINGS[DEFAULT_LANGUAGE][key] || key, replacements);
    },
    setLanguage(language, { persist = true } = {}) {
      currentLanguage = validLanguage(language);
      if (persist) storeLanguage(currentLanguage);
      translateSharedUi(currentLanguage);
      window.dispatchEvent(new CustomEvent('dakzo:languagechange', { detail: { language: currentLanguage } }));
      return currentLanguage;
    }
  };

  window.DakzoI18n = api;
  select?.addEventListener('change', (event) => api.setLanguage(event.target.value));
  api.setLanguage(currentLanguage, { persist: false });
  return api;
}

export { DEFAULT_LANGUAGE, LANGUAGES, STORAGE_KEY };
