export const languages = {
  sk: 'Slovensky',
  en: 'English',
} as const;

export type Lang = keyof typeof languages;

export const defaultLang: Lang = 'sk';

export const ui = {
  sk: {
    // Nav
    'nav.home': 'Domov',
    'nav.cv': 'CV',
    'nav.portfolio': 'Portfólio',
    'nav.blog': 'Blog',
    'nav.contact': 'Kontakt',

    // Hero
    'hero.greeting': 'Ahoj, som',
    'hero.tagline': 'DevOps inžinier. Servery, automatizácia, kód.',
    'hero.cta.cv': 'Pozri CV',
    'hero.cta.portfolio': 'Moje projekty',
    'hero.cta.blog': 'Čítaj blog',

    // CV
    'cv.title': 'Curriculum Vitae',
    'cv.experience': 'Skúsenosti',
    'cv.education': 'Vzdelanie',
    'cv.skills': 'Zručnosti',
    'cv.download': 'Stiahnuť PDF',
    'cv.present': 'súčasnosť',

    // Portfolio
    'portfolio.title': 'Portfólio',
    'portfolio.subtitle': 'Projekty, na ktorých som pracoval',
    'portfolio.view': 'Zobraziť projekt',
    'portfolio.source': 'Zdrojový kód',

    // Blog
    'blog.title': 'Blog',
    'blog.subtitle': 'Siete, Linux, automatizácia a veci z praxe',
    'blog.readmore': 'Čítať ďalej',
    'blog.minutes': 'min čítania',

    // Footer
    'footer.rights': 'Všetky práva vyhradené',
    'footer.built': 'Postavené s',

    // Theme
    'theme.toggle': 'Prepnúť tému',
    'lang.switch': 'English',
  },
  en: {
    // Nav
    'nav.home': 'Home',
    'nav.cv': 'CV',
    'nav.portfolio': 'Portfolio',
    'nav.blog': 'Blog',
    'nav.contact': 'Contact',

    // Hero
    'hero.greeting': 'Hi, I\'m',
    'hero.tagline': 'DevOps engineer. Servers, automation, code.',
    'hero.cta.cv': 'View CV',
    'hero.cta.portfolio': 'My projects',
    'hero.cta.blog': 'Read blog',

    // CV
    'cv.title': 'Curriculum Vitae',
    'cv.experience': 'Experience',
    'cv.education': 'Education',
    'cv.skills': 'Skills',
    'cv.download': 'Download PDF',
    'cv.present': 'present',

    // Portfolio
    'portfolio.title': 'Portfolio',
    'portfolio.subtitle': 'Projects I\'ve worked on',
    'portfolio.view': 'View project',
    'portfolio.source': 'Source code',

    // Blog
    'blog.title': 'Blog',
    'blog.subtitle': 'Networks, Linux, automation and notes from the field',
    'blog.readmore': 'Read more',
    'blog.minutes': 'min read',

    // Footer
    'footer.rights': 'All rights reserved',
    'footer.built': 'Built with',

    // Theme
    'theme.toggle': 'Toggle theme',
    'lang.switch': 'Slovensky',
  },
} as const;

export type TranslationKey = keyof (typeof ui)['sk'];

export function useTranslations(lang: Lang) {
  return function t(key: TranslationKey): string {
    return ui[lang][key] ?? ui[defaultLang][key] ?? key;
  };
}

export function getLangFromUrl(url: URL): Lang {
  const [, lang] = url.pathname.split('/');
  if (lang in languages) return lang as Lang;
  return defaultLang;
}

export function getAlternatePath(url: URL, targetLang: Lang): string {
  const segments = url.pathname.split('/').filter(Boolean);
  const currentLang = segments[0] as Lang;

  if (currentLang in languages) {
    // Remove current lang prefix
    segments.shift();
  }

  if (targetLang === defaultLang) {
    return '/' + segments.join('/');
  }

  return '/' + [targetLang, ...segments].join('/');
}
