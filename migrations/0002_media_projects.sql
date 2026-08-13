PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO cms_projects (
  id, slug, name, summary, status, industry, project_type, content_json, seo_title, seo_description
) VALUES
  (
    'project-hmd-erp',
    'hmd-erp',
    'HMD ERP',
    'Enterprise operations platform spanning inventory, factory workflows, containers, POS, accounts, payroll, reporting, and multi-company operations.',
    'published',
    'Enterprise operations',
    'ERP platform',
    '{"galleryMediaIds":[],"sections":[]}',
    'HMD ERP | Dakzo Systems',
    'Explore HMD ERP, the flagship enterprise operations platform built by Dakzo Systems.'
  ),
  (
    'project-congo-delivery',
    'congo-delivery',
    'Congo Delivery',
    'Delivery and logistics platform designed around dispatch, operational visibility, tracking, and the customer journey.',
    'published',
    'Logistics',
    'Delivery platform',
    '{"galleryMediaIds":[],"sections":[]}',
    'Congo Delivery | Dakzo Systems',
    'Explore Congo Delivery, a logistics and delivery platform built by Dakzo Systems.'
  ),
  (
    'project-moto-track',
    'moto-track',
    'Moto Track',
    'Fleet and motorcycle tracking platform centered on live maps, alerts, reporting, and operational monitoring.',
    'published',
    'Fleet technology',
    'Tracking platform',
    '{"galleryMediaIds":[],"sections":[]}',
    'Moto Track | Dakzo Systems',
    'Explore Moto Track, a fleet and motorcycle tracking platform built by Dakzo Systems.'
  );
