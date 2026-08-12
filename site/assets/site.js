const toggle = document.querySelector('[data-menu-toggle]');
const nav = document.querySelector('[data-nav]');

if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });

  nav.addEventListener('click', (event) => {
    if (event.target instanceof HTMLAnchorElement && nav.classList.contains('open')) {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && nav.classList.contains('open')) {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.focus();
    }
  });
}

document.querySelectorAll('[data-year]').forEach((node) => {
  node.textContent = String(new Date().getFullYear());
});

const currentPath = window.location.pathname.replace(/\/index\.html$/, '/');
document.querySelectorAll('[data-nav] a').forEach((link) => {
  const href = link.getAttribute('href');
  if (href && href !== '/' && currentPath.startsWith(href)) link.setAttribute('aria-current', 'page');
});

// Technical SEO: canonical, Open Graph and organization schema derive from the deployed origin.
const canonicalUrl = new URL(currentPath || '/', window.location.origin).href;
if (!document.querySelector('link[rel="canonical"]')) {
  const canonical = document.createElement('link');
  canonical.rel = 'canonical';
  canonical.href = canonicalUrl;
  document.head.append(canonical);
}

const description = document.querySelector('meta[name="description"]')?.content || '';
const socialMeta = [
  ['property', 'og:type', document.body.dataset.contentType === 'article' ? 'article' : 'website'],
  ['property', 'og:title', document.title],
  ['property', 'og:description', description],
  ['property', 'og:url', canonicalUrl],
  ['name', 'twitter:card', 'summary_large_image'],
  ['name', 'twitter:title', document.title],
  ['name', 'twitter:description', description]
];
for (const [attribute, key, value] of socialMeta) {
  if (!document.querySelector(`meta[${attribute}="${key}"]`)) {
    const meta = document.createElement('meta');
    meta.setAttribute(attribute, key);
    meta.content = value;
    document.head.append(meta);
  }
}

const schema = document.createElement('script');
schema.type = 'application/ld+json';
const baseSchema = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${window.location.origin}/#organization`,
      name: 'Dakzo Systems',
      url: `${window.location.origin}/`,
      description: 'A Dakik LLC company building custom software, ERP systems, applications, websites, logistics technology, tracking platforms, and business automation.'
    },
    {
      '@type': 'WebSite',
      '@id': `${window.location.origin}/#website`,
      name: 'Dakzo Systems',
      url: `${window.location.origin}/`,
      publisher: { '@id': `${window.location.origin}/#organization` }
    }
  ]
};
if (document.body.dataset.contentType === 'article') {
  baseSchema['@graph'].push({
    '@type': 'Article',
    headline: document.querySelector('h1')?.textContent?.trim() || document.title,
    description,
    mainEntityOfPage: canonicalUrl,
    publisher: { '@id': `${window.location.origin}/#organization` },
    author: { '@id': `${window.location.origin}/#organization` }
  });
}
schema.textContent = JSON.stringify(baseSchema);
document.head.append(schema);

// Conversion system: validate the project inquiry, produce a portable brief, and let users copy it.
const inquiryForm = document.querySelector('[data-project-form]');
if (inquiryForm instanceof HTMLFormElement) {
  const output = document.querySelector('[data-project-summary]');
  const copyButton = document.querySelector('[data-copy-brief]');
  const buildBrief = () => {
    const data = new FormData(inquiryForm);
    return [
      'Dakzo Systems — Project Inquiry',
      `Name: ${data.get('name') || ''}`,
      `Company: ${data.get('company') || ''}`,
      `Email: ${data.get('email') || ''}`,
      `Project type: ${data.get('projectType') || ''}`,
      `Timeline: ${data.get('timeline') || ''}`,
      `Budget: ${data.get('budget') || ''}`,
      '',
      'What needs to work better:',
      String(data.get('details') || '')
    ].join('\n');
  };
  inquiryForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!inquiryForm.reportValidity()) return;
    const brief = buildBrief();
    if (output) {
      output.textContent = brief;
      output.hidden = false;
    }
    if (copyButton instanceof HTMLButtonElement) copyButton.hidden = false;
    document.querySelector('[data-inquiry-status]')?.replaceChildren(document.createTextNode('Project brief ready. Copy it below and send it through your preferred Dakzo contact channel.'));
  });
  copyButton?.addEventListener('click', async () => {
    await navigator.clipboard.writeText(buildBrief());
    copyButton.textContent = 'Copied';
  });
}