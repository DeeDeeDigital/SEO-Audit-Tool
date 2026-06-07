// 13-section SEO audit checklist based on the Master SEO Audit framework.
// severity: 'critical' | 'high' | 'medium' | 'low'
// automated items are pre-filled from the technical scan API response.
//   automated: true  — check can be auto-detected
//   automatedKey    — dot-path into the technicalData object
//   invertedPass    — true means the value being FALSE is a pass (e.g. hasCrawlDelay should be false to pass)
//   threshold       — numeric: pass if value >= threshold

export const AUDIT_SECTIONS = [
  {
    id: 'preaudit',
    title: '1. Pre-Audit Setup',
    items: [
      { id: 'access_ga4',       severity: 'high',     label: 'GA4 access confirmed — data is flowing (check Realtime report)' },
      { id: 'access_gsc',       severity: 'high',     label: 'GSC property verified and matches canonical domain (www vs non-www)' },
      { id: 'canonical_domain', severity: 'high',     label: 'Canonical domain format documented (www vs non-www, HTTPS confirmed)' },
      { id: 'sitemap_located',  severity: 'medium',   label: 'XML sitemap URL(s) located and documented' },
      { id: 'robots_saved',     severity: 'medium',   label: 'robots.txt saved as baseline copy' },
      { id: 'ga4_baseline',     severity: 'medium',   label: 'GA4 organic baseline screenshot captured (last 12 months, filtered to Organic Search)' },
      { id: 'gsc_baseline',     severity: 'medium',   label: 'GSC Performance baseline screenshot captured (last 16 months — clicks, impressions, CTR, position)' },
      { id: 'cms_identified',   severity: 'low',      label: 'CMS and hosting environment identified (WordPress, Shopify, custom; shared, VPS, CDN)' },
      { id: 'scope_defined',    severity: 'high',     label: 'Audit scope defined in writing with client (full domain, subfolder, or specific page types)' },
      { id: 'page_count',       severity: 'medium',   label: 'Screaming Frog crawled page count vs GSC indexed page count documented — gap noted if significant' },
      { id: 'migrations_noted', severity: 'high',     label: 'Recent site migrations, redesigns, or URL structure changes documented' },
      { id: 'algo_review',      severity: 'high',     label: 'Traffic drop dates cross-referenced with algorithm update history (moz.com/google-algorithm-change)' },
    ],
  },

  {
    id: 'technical',
    title: '2. Technical SEO',
    items: [
      // robots.txt
      { id: 'robots_200',          severity: 'critical', label: 'robots.txt exists at domain root and returns 200', automated: true, automatedKey: 'robots.exists' },
      { id: 'robots_no_blocks',    severity: 'critical', label: 'No CSS, JS, or image resources blocked by robots.txt' },
      { id: 'robots_sitemap_dir',  severity: 'high',     label: 'Sitemap URL(s) referenced in robots.txt via Sitemap: directive', automated: true, automatedKey: 'robots.hasSitemap' },
      { id: 'robots_crawl_delay',  severity: 'low',      label: 'No crawl-delay directive (Googlebot ignores it; Bingbot is slowed by it)', automated: true, automatedKey: 'robots.crawlDelay', nullIsPass: true },
      { id: 'robots_no_conflicts', severity: 'medium',   label: 'No conflicting Allow/Disallow rules — tested in GSC robots.txt tester' },
      // sitemaps
      { id: 'sitemap_exists',      severity: 'high',     label: 'XML sitemap exists and returns 200', automated: true, automatedKey: 'sitemap.exists' },
      { id: 'sitemap_gsc',         severity: 'high',     label: 'Sitemap submitted to GSC and shows Success status (no errors)' },
      { id: 'sitemap_clean',       severity: 'high',     label: 'Sitemap contains only indexable URLs — no noindex pages, no 4xx, no 3xx redirects' },
      { id: 'sitemap_canonical',   severity: 'high',     label: 'Sitemap URLs exactly match the canonical tag on each page' },
      { id: 'sitemap_size',        severity: 'medium',   label: 'Sitemap is under 50MB and under 50,000 URLs' },
      { id: 'sitemap_lastmod',     severity: 'low',      label: 'Sitemap lastmod dates reflect real content changes (not auto-regenerated daily)' },
      { id: 'sitemap_dynamic',     severity: 'medium',   label: 'Sitemap updates automatically when new content is published' },
      // https / redirects
      { id: 'https_redirect',      severity: 'critical', label: 'HTTP redirects to HTTPS via 301 (tested: http://domain.com → https://domain.com)', automated: true, automatedKey: 'https.httpRedirects' },
      { id: 'https_loads',         severity: 'critical', label: 'HTTPS version loads successfully (SSL certificate valid)' },
      { id: 'www_redirect',        severity: 'high',     label: 'www / non-www resolved to a single canonical version via 301' },
      { id: 'trailing_slash',      severity: 'medium',   label: 'Trailing slash vs no trailing slash is consistent site-wide' },
      // indexation
      { id: 'gsc_coverage',        severity: 'high',     label: 'GSC Coverage report pulled — Error, Warning, Valid, Excluded counts documented' },
      { id: 'noindex_intentional', severity: 'critical', label: 'All noindex pages verified as intentional — spot-checked 20+ pages in source' },
      { id: 'priority_indexed',    severity: 'critical', label: 'All priority pages (homepage, key service/product pages) confirmed indexed in GSC' },
      { id: 'gsc_not_indexed',     severity: 'high',     label: 'GSC "Discovered/Crawled - not indexed" URLs reviewed and categorized (quality issue vs crawl budget)' },
      // canonicalization
      { id: 'self_canonical',      severity: 'high',     label: 'Every page has a self-referencing canonical tag (absolute URL, not relative)', sfAutoKey: 'missingCanonical', sfPassIfZero: true },
      { id: 'canonical_correct',   severity: 'high',     label: 'Canonical tags point to final destination — no canonicals pointing to redirect targets' },
      { id: 'google_overrides',    severity: 'medium',   label: 'GSC "Duplicate, Google chose different canonical" URLs reviewed — causes investigated' },
      // architecture
      { id: 'url_structure',       severity: 'medium',   label: 'URLs are short, descriptive, keyword-relevant, use hyphens (not underscores), all lowercase', sfAutoKey: 'urlStructureIssues', sfPassIfZero: true },
      { id: 'crawl_depth',         severity: 'medium',   label: 'Key pages are no more than 3 clicks from homepage (Screaming Frog Crawl Depth report)', sfAutoKey: 'pagesDeepThan3', sfPassIfZero: true },
      { id: 'faceted_nav',         severity: 'medium',   label: 'Faceted navigation / URL parameters not generating excessive crawlable URLs' },
      // CWV
      { id: 'cwv_mobile',          severity: 'high',     label: 'Mobile PageSpeed performance score 75+', automated: true, automatedKey: 'pagespeed.mobile.score', threshold: 75 },
      { id: 'cwv_desktop',         severity: 'medium',   label: 'Desktop PageSpeed performance score 75+', automated: true, automatedKey: 'pagespeed.desktop.score', threshold: 75 },
      { id: 'cwv_gsc',             severity: 'high',     label: 'GSC Core Web Vitals report: "Good" URLs trending up, "Poor" URLs documented and addressed' },
    ],
  },

  {
    id: 'onpage',
    title: '3. On-Page SEO',
    items: [
      { id: 'title_unique',       severity: 'high',   label: 'Every page has a unique, keyword-optimized title tag (50–60 characters)', sfAutoKey: 'titleIssues', sfPassIfZero: true },
      { id: 'title_format',       severity: 'medium', label: 'Title tags follow a consistent format (Keyword — Differentiator | Brand)' },
      { id: 'meta_desc',          severity: 'medium', label: 'Every page has a unique meta description (under 155 characters) — no auto-generated descriptions', sfAutoKey: 'missingMeta', sfPassIfZero: true },
      { id: 'h1_single',          severity: 'high',   label: 'Every page has exactly one H1 — includes the target keyword, near the top of the content', sfAutoKey: 'h1Issues', sfPassIfZero: true },
      { id: 'heading_hierarchy',  severity: 'medium', label: 'Heading structure is logical (H2s beneath H1, H3s beneath H2s — no skipped levels)' },
      { id: 'image_alt',          severity: 'medium', label: 'All images have descriptive alt text (keyword-relevant where natural)' },
      { id: 'internal_links',     severity: 'high',   label: 'Key pages have adequate internal links pointing to them — no orphaned priority pages' },
      { id: 'no_broken_links',    severity: 'high',   label: 'No broken internal or external links (Screaming Frog scan complete)', sfAutoKey: 'broken4xx', sfPassIfZero: true },
      { id: 'schema_org',         severity: 'high',   label: 'Organization or LocalBusiness schema on homepage with accurate NAP' },
      { id: 'schema_pages',       severity: 'medium', label: 'Appropriate schema on key page types: Article, Product, Service, FAQ, BreadcrumbList' },
      { id: 'schema_valid',       severity: 'high',   label: 'All schema validated in Google Rich Results Test — no errors, only valid warnings' },
      { id: 'og_tags',            severity: 'low',    label: 'Open Graph and Twitter Card meta tags set on all key pages' },
    ],
  },

  {
    id: 'content',
    title: '4. Content Audit',
    items: [
      { id: 'content_inventory',   severity: 'high',   label: 'Full content inventory built: URL, page type, word count, organic traffic, inbound links, last updated' },
      { id: 'thin_content',        severity: 'high',   label: 'Thin content pages identified (under 300 words with no unique value) — triaged for update/merge/delete' },
      { id: 'duplicate_content',   severity: 'high',   label: 'Duplicate and near-duplicate content identified — canonicalized or consolidated' },
      { id: 'cannibalization',     severity: 'high',   label: 'Keyword cannibalization identified — two pages competing for same primary keyword resolved' },
      { id: 'triage_complete',     severity: 'high',   label: 'Every page assigned a triage action: Keep / Update / Merge (target URL) / Delete+Redirect / Noindex' },
      { id: 'outdated_content',    severity: 'medium', label: 'Outdated content flagged: stale stats, old dates, changed products/services, dead links within body' },
      { id: 'datemodified',        severity: 'medium', label: 'dateModified in Article schema reflects actual content edits (not CMS auto-publish date)' },
      { id: 'refresh_schedule',    severity: 'low',    label: 'Content refresh schedule created: annual (evergreen), semi-annual (competitive KWs), quarterly (time-sensitive)' },
      { id: 'eeat_signals',        severity: 'high',   label: 'E-E-A-T signals present: named authors with credentials, About/Contact/Privacy pages complete, sources cited' },
      { id: 'about_contact',       severity: 'high',   label: 'About, Contact, and Privacy Policy pages exist, are complete, and accurately represent the organization' },
    ],
  },

  {
    id: 'keywords',
    title: '5. Keyword Research & Mapping',
    items: [
      { id: 'gsc_keywords',        severity: 'high',   label: 'All ranking keywords pulled from GSC (up to 10,000 via Search Analytics for Sheets add-on)' },
      { id: 'competitor_gap',      severity: 'high',   label: 'Competitor keyword gap analysis run — Missing and Weak keywords exported by volume' },
      { id: 'intent_classified',   severity: 'high',   label: 'Keywords classified by intent: Informational / Navigational / Commercial Investigation / Transactional' },
      { id: 'funnel_coverage',     severity: 'medium', label: 'Keywords balanced across funnel stages: Awareness / Consideration / Decision' },
      { id: 'keyword_map',         severity: 'high',   label: 'Keyword mapping spreadsheet complete: one primary keyword per URL, 3–5 secondary keywords' },
      { id: 'no_cannibalization',  severity: 'high',   label: 'No two pages mapped to the same primary keyword' },
      { id: 'content_gaps',        severity: 'high',   label: 'High-priority keywords with no existing page flagged as content gaps — added to content calendar' },
      { id: 'ai_overview_flags',   severity: 'medium', label: 'Keywords triggering AI Overviews identified — citation strategy noted separately' },
      { id: 'serp_features',       severity: 'medium', label: 'SERP features noted per keyword: Featured Snippet, Map Pack, Shopping, Video, Knowledge Panel' },
      { id: 'local_keywords',      severity: 'medium', label: 'Local keyword variants (city + service, near me) mapped to location pages (if local SEO applies)' },
    ],
  },

  {
    id: 'gsc',
    title: '6. Google Search Console',
    items: [
      { id: 'gsc_top_queries',     severity: 'high',     label: 'Top 50 queries by impressions documented with CTR, avg position, and brand/non-brand classification' },
      { id: 'gsc_top_pages',       severity: 'high',     label: 'Top 20 organic landing pages by clicks documented with their top query' },
      { id: 'gsc_brand_nonbrand',  severity: 'high',     label: 'Brand vs non-brand average position tracked separately — non-brand is the primary growth metric' },
      { id: 'gsc_manual_action',   severity: 'critical', label: 'GSC Manual Actions: clean (no active penalties)' },
      { id: 'gsc_security',        severity: 'critical', label: 'GSC Security Issues: clean (no hacked content, malware, or deceptive pages flagged)' },
      { id: 'gsc_index_errors',    severity: 'critical', label: 'GSC Coverage errors reviewed — no unexplained critical errors (Server error, Submitted URL blocked, etc.)' },
      { id: 'gsc_cwv_report',      severity: 'high',     label: 'GSC Core Web Vitals report reviewed — Poor URL count and affected page types documented' },
      { id: 'gsc_rich_results',    severity: 'medium',   label: 'GSC Enhancements / Rich Results report reviewed — schema errors addressed' },
      { id: 'gsc_links_report',    severity: 'medium',   label: 'GSC Links report reviewed — top linked pages and top linking anchor text documented' },
      { id: 'gsc_disco_notindex',  severity: 'high',     label: 'GSC "Discovered/Crawled - not indexed" URL patterns analyzed — root cause identified' },
    ],
  },

  {
    id: 'ga4',
    title: '7. Google Analytics 4',
    items: [
      { id: 'ga4_firing',          severity: 'critical', label: 'GA4 tag confirmed firing on all pages — verified in DevTools Network tab or Tag Assistant' },
      { id: 'ga4_no_ua',           severity: 'medium',   label: 'Universal Analytics (UA-) tags removed from GTM — UA stopped processing July 1, 2023' },
      { id: 'ga4_organic_trend',   severity: 'high',     label: 'Organic Search channel 12-month trend documented: growing / flat / declining (export to CSV)' },
      { id: 'ga4_landing_pages',   severity: 'high',     label: 'Top organic landing pages by sessions identified and cross-referenced with GSC top pages' },
      { id: 'ga4_conversions',     severity: 'high',     label: 'Conversion events configured and verified: form submits, calls, purchases, key CTAs' },
      { id: 'ga4_attribution',     severity: 'medium',   label: 'Attribution model noted (default: data-driven) — last-click comparison reviewed for context' },
      { id: 'ga4_segments',        severity: 'medium',   label: 'Analysis uses Organic Search segment — not all-users which dilutes organic performance data' },
      { id: 'ga4_content_groups',  severity: 'low',      label: 'Content groups or custom dimensions set up to segment by page type (blog, product, location, etc.)' },
    ],
  },

  {
    id: 'backlinks',
    title: '8. Backlinks & Off-Page',
    items: [
      { id: 'da_benchmark',        severity: 'high',   label: 'Domain authority / DR benchmarked against top 5 competitors — gap documented' },
      { id: 'backlink_trend',      severity: 'high',   label: 'Referring domains trend over 12 months: growing / flat / declining' },
      { id: 'top_linked_pages',    severity: 'high',   label: 'Top linked pages confirmed as priority pages — no link equity wasted on 404s or old press releases' },
      { id: 'anchor_text',         severity: 'high',   label: 'Anchor text distribution reviewed — no over-optimization (30%+ exact-match keyword anchors is a risk)' },
      { id: 'dofollow_ratio',      severity: 'medium', label: 'Dofollow vs nofollow ratio noted — typically 50–70% dofollow for editorially earned links' },
      { id: 'toxic_links',         severity: 'high',   label: 'Toxic/spammy backlinks reviewed — disavow file prepared if significant volume of high-toxicity links' },
      { id: 'link_gap',            severity: 'high',   label: 'Backlink gap analysis complete — domains linking to 2+ competitors but not you documented' },
      { id: 'broken_backlinks',    severity: 'medium', label: 'Broken backlinks (pointing to 404s) identified — 301 redirects implemented or outreach sent' },
      { id: 'unlinked_mentions',   severity: 'medium', label: 'Unlinked brand mentions identified via Brand Monitoring — outreach targets documented' },
      { id: 'nap_consistency',     severity: 'high',   label: 'NAP (Name, Address, Phone) consistent across all major online directories' },
    ],
  },

  {
    id: 'local',
    title: '9. Local SEO',
    optional: true,
    items: [
      { id: 'gbp_claimed',           severity: 'critical', label: 'GBP listing claimed, verified, and managed by the business' },
      { id: 'gbp_name',              severity: 'high',     label: 'GBP name matches website and citations exactly — no keyword stuffing in business name' },
      { id: 'gbp_category',          severity: 'high',     label: 'GBP primary category is most specific/relevant — secondary categories added (up to 9)' },
      { id: 'gbp_address',           severity: 'high',     label: 'GBP address and phone match website footer/contact page format exactly' },
      { id: 'gbp_hours',             severity: 'medium',   label: 'GBP hours accurate — holiday hours updated proactively' },
      { id: 'gbp_description',       severity: 'medium',   label: 'GBP description filled out (400–750 chars, 2–3 natural keyword mentions, no links or HTML)' },
      { id: 'gbp_photos',            severity: 'medium',   label: 'GBP: 10+ high-quality photos uploaded — added regularly (1–2/month minimum)' },
      { id: 'gbp_posts',             severity: 'medium',   label: 'GBP posts published at least weekly (What\'s New, Offer, Event, or Product)' },
      { id: 'gbp_reviews',           severity: 'high',     label: 'All GBP reviews responded to (both positive and negative) — response rate 100%' },
      { id: 'gbp_qa',                severity: 'medium',   label: 'GBP Q&A seeded with common questions answered from business account' },
      { id: 'nap_directories',       severity: 'high',     label: 'NAP 100% consistent across Yelp, Bing Places, Apple Maps, BBB, YP, Foursquare' },
      { id: 'localbusiness_schema',  severity: 'high',     label: 'LocalBusiness JSON-LD schema on homepage/contact page — NAP matches GBP exactly' },
      { id: 'location_pages',        severity: 'high',     label: 'Location/service-area pages exist with unique content (not cloned templates)' },
      { id: 'embedded_map',          severity: 'medium',   label: 'Google Map embedded on contact/location page — shows same address as GBP' },
    ],
  },

  {
    id: 'ecommerce',
    title: '10. E-Commerce SEO',
    optional: true,
    items: [
      { id: 'unique_descriptions',   severity: 'high',   label: 'Product descriptions are unique — not copied verbatim from manufacturer (will not outrank manufacturer)' },
      { id: 'product_titles',        severity: 'high',   label: 'Product title tags include: Brand + Model + Key Attribute + Product Type' },
      { id: 'product_schema',        severity: 'high',   label: 'Product schema on all product pages: Product, Offer (with price + availability), AggregateRating' },
      { id: 'product_images_alt',    severity: 'medium', label: 'Product images have descriptive alt text: product name + key attribute + brand' },
      { id: 'out_of_stock',          severity: 'high',   label: 'Out-of-stock products kept live with similar product recs OR 301 redirected — never 404d' },
      { id: 'discontinued',          severity: 'high',   label: 'Discontinued products 301 redirected to best replacement or parent category — backlinks preserved' },
      { id: 'category_copy',         severity: 'medium', label: 'Category pages have unique intro copy above the product grid (100–300+ words)' },
      { id: 'faceted_canonical',     severity: 'high',   label: 'Faceted navigation URLs canonicalized to base category URL or noindexed' },
      { id: 'breadcrumbs',           severity: 'medium', label: 'Breadcrumbs present and BreadcrumbList schema implemented on product + category pages' },
      { id: 'ga4_ecommerce',         severity: 'high',   label: 'GA4 Enhanced E-commerce events firing: view_item, add_to_cart, begin_checkout, purchase' },
      { id: 'cart_funnel',           severity: 'medium', label: 'GA4 Funnel Exploration built: view_item → add_to_cart → begin_checkout → purchase (organic segment)' },
    ],
  },

  {
    id: 'geo',
    title: '11. GEO / AI Search / LLM Citations',
    items: [
      { id: 'ai_brand_query',        severity: 'high',   label: 'Brand name queried in ChatGPT, Perplexity, Claude, Copilot, Gemini — AI knowledge + accuracy documented' },
      { id: 'ai_unprompted',         severity: 'high',   label: 'Core service/product terms queried unprompted in AI tools — brand appearance vs competitors documented' },
      { id: 'ai_vs_competitor',      severity: 'high',   label: '"Brand vs Competitor" queries run in AI tools — fairness, accuracy, and competitor advantages noted' },
      { id: 'perplexity_citations',  severity: 'high',   label: 'Perplexity source citations for key topics documented — your URLs vs competitor URLs noted' },
      { id: 'ai_overviews',          severity: 'high',   label: 'Google AI Overviews tracked for target keywords — cited sources panel reviewed and logged' },
      { id: 'direct_answers',        severity: 'high',   label: 'Key pages answer their primary question directly in the first 1–2 paragraphs (not buried)' },
      { id: 'faq_schema',            severity: 'high',   label: 'FAQ sections with FAQPage JSON-LD schema on key service, product, and landing pages' },
      { id: 'howto_content',         severity: 'medium', label: 'Step-by-step content uses HowTo schema where applicable' },
      { id: 'author_signals',        severity: 'high',   label: 'Named authors with bio pages, credentials, and author schema markup on all content pages' },
      { id: 'structured_content',    severity: 'medium', label: 'Content structured for extraction: H2/H3 headers, short paragraphs (50–70 words max), bullets, tables' },
      { id: 'original_data',         severity: 'medium', label: 'Original research, data, or case studies published — primary sources get preferential AI citation' },
      { id: 'ai_crawlers_allowed',   severity: 'high',   label: 'robots.txt checked for AI crawler rules — GPTBot, ClaudeBot, PerplexityBot, Google-Extended not accidentally blocked' },
      { id: 'llms_txt',              severity: 'low',    label: 'llms.txt file considered — provides AI assistants structured site content summary (llmstxt.org)' },
      { id: 'wikidata_entity',       severity: 'medium', label: 'Wikidata entity exists for brand with accurate core fields (if brand is notable enough)' },
      { id: 'knowledge_panel',       severity: 'medium', label: 'Google Knowledge Panel reviewed for accuracy — claimed if available, errors corrected' },
    ],
  },

  {
    id: 'competitive',
    title: '12. Competitive Analysis',
    items: [
      { id: 'serp_competitors',      severity: 'high',   label: 'Top 5 SERP competitors identified — domains appearing most frequently in top 10 for target keywords' },
      { id: 'competitor_da',         severity: 'high',   label: 'Competitor DA/DR, estimated organic traffic, and referring domains benchmarked in a comparison table' },
      { id: 'keyword_gap',           severity: 'high',   label: 'Keyword gap analysis run — "Missing" (0 ranking) and "Weak" (ranking below competitors) documented by volume' },
      { id: 'content_gap',           severity: 'high',   label: 'Content types competitors have that you don\'t documented: calculators, guides, databases, glossaries, video series' },
      { id: 'featured_snippets',     severity: 'medium', label: 'Competitor featured snippets reviewed — content structure format (Q&A, numbered list, table) modeled' },
      { id: 'backlink_gap_comp',     severity: 'high',   label: 'Backlink gap analysis run — referring domains linking to 2+ competitors but not you exported' },
      { id: 'cwv_comparison',        severity: 'medium', label: 'Core Web Vitals scores compared vs competitors via PageSpeed Insights — mobile LCP, INP, CLS side-by-side' },
      { id: 'schema_comparison',     severity: 'medium', label: 'Competitor schema implementation depth reviewed — schema types and property depth vs your implementation' },
      { id: 'site_architecture',     severity: 'medium', label: 'Competitor site architecture reviewed — key page depth, topic cluster coverage, navigation patterns' },
    ],
  },

  {
    id: 'reporting',
    title: '13. Reporting & Prioritization',
    items: [
      { id: 'findings_spreadsheet',  severity: 'high',   label: 'All findings documented in master spreadsheet: Issue / Evidence (URLs) / Severity / Recommended Fix / Effort / Impact' },
      { id: 'quick_wins',            severity: 'high',   label: 'Quick wins tab: issues fixable in under 2 hours with impact score 7+ — presented first to client' },
      { id: 'exec_summary',          severity: 'high',   label: 'Executive summary written: 1 page, top 5 findings, current impact, recommended action, expected outcome' },
      { id: 'phased_roadmap',        severity: 'high',   label: 'Phased implementation roadmap: Phase 1 (30 days / Critical+High), Phase 2 (60 days), Phase 3 (90 days)' },
      { id: 'ownership_assigned',    severity: 'high',   label: 'Owner assigned to every finding: Developer / SEO+Content / Marketing — no unassigned items' },
      { id: 'kpis_defined',          severity: 'medium', label: 'KPIs defined per phase: Coverage errors ↓, Good CWV URLs ↑, avg position ↑, organic sessions ↑' },
      { id: 'gsc_pre_baseline',      severity: 'medium', label: 'GSC Performance screenshot taken before any fixes deployed — dated file saved' },
      { id: 'gsc_annotations',       severity: 'medium', label: 'GSC date annotations added when major fixes go live — makes impact correlation possible' },
      { id: 'change_log',            severity: 'medium', label: 'Change log created: date / change type / URLs affected / expected impact / who made it' },
      { id: 'monitoring_schedule',   severity: 'medium', label: 'Post-audit monitoring schedule set: weekly GSC health check, monthly organic review, quarterly full review' },
    ],
  },
]

export const ALL_ITEMS = AUDIT_SECTIONS.flatMap(s =>
  s.items.map(item => ({ ...item, sectionId: s.id }))
)

export function severityClasses(severity) {
  return {
    critical: { bg: 'bg-red-50',   text: 'text-red-700',   badge: 'bg-red-100 text-red-700',   border: 'border-red-200'   },
    high:     { bg: 'bg-amber-50', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700',border: 'border-amber-200' },
    medium:   { bg: 'bg-blue-50',  text: 'text-blue-700',  badge: 'bg-blue-100 text-blue-700',  border: 'border-blue-200'  },
    low:      { bg: 'bg-gray-50',  text: 'text-gray-600',  badge: 'bg-gray-100 text-gray-600',  border: 'border-gray-200'  },
  }[severity] || { bg: 'bg-gray-50', text: 'text-gray-600', badge: 'bg-gray-100 text-gray-600', border: 'border-gray-200' }
}

export function getNestedValue(obj, path) {
  if (!path || !obj) return undefined
  return path.split('.').reduce((cur, key) => cur?.[key], obj)
}

export function computeAutoStatus(item, technicalData, sfData) {
  // ── Technical scan auto-status (robots, sitemap, HTTPS, PageSpeed) ──────────
  if (item.automated && technicalData) {
    // nullIsPass: value being absent/null is itself the pass condition (e.g. no crawl-delay)
    if (item.nullIsPass) {
      const val = getNestedValue(technicalData, item.automatedKey)
      return (val === null || val === undefined || val === '') ? 'pass' : 'fail'
    }
    const val = getNestedValue(technicalData, item.automatedKey)
    if (val !== undefined && val !== null) {
      if (item.threshold != null) return typeof val === 'number' && val >= item.threshold ? 'pass' : 'fail'
      if (item.invertedPass)      return !val ? 'pass' : 'fail'
      return val === true ? 'pass' : val === false ? 'fail' : null
    }
  }

  // ── Screaming Frog crawl auto-status ─────────────────────────────────────────
  if (item.sfAutoKey && sfData) {
    const val = sfData[item.sfAutoKey]
    if (val !== undefined && val !== null) {
      if (item.sfPassIfZero) return val === 0 ? 'pass' : 'fail'
    }
  }

  return null
}

export const TOTAL_ITEMS = AUDIT_SECTIONS.reduce((s, sec) => s + sec.items.length, 0)
