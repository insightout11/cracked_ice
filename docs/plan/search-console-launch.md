# Search Console launch checklist

Use this checklist after the technical SEO correction pass is deployed. Search Console setup is
an owner action because Domain-property verification changes DNS.

## 1. Create and verify the property

1. Open [Google Search Console](https://search.google.com/search-console).
2. Add a **Domain** property using `crackedicehockey.com` — no protocol, `www`, or path.
3. Add the TXT verification record Google supplies at the domain's DNS provider.
4. Return to Search Console and select **Verify**. Keep the TXT record after verification.

A Domain property includes the apex domain, `www`, and both HTTP and HTTPS variants. Do not create
separate properties unless path- or hostname-specific reporting is needed later.

## 2. Submit the sitemap

In **Indexing → Sitemaps**, submit:

```text
https://www.crackedicehockey.com/sitemap.xml
```

Confirm that Search Console reports **Success** and discovers the same number of URLs present in
the live sitemap. The sitemap is also declared in `robots.txt`.

## 3. Inspect the launch URLs

Use **URL inspection → Test live URL** for these pages after deployment:

- `https://www.crackedicehockey.com/`
- `https://www.crackedicehockey.com/season`
- `https://www.crackedicehockey.com/compare`
- `https://www.crackedicehockey.com/blog`
- the 2026–27 Off-Night Bible URL after owner approval and publication

For each URL, confirm that crawling is allowed, the user-declared and Google-selected canonicals
match, and rendered HTML contains the visible page heading. Request indexing for the homepage,
tool landing pages, and flagship article; do not repeatedly request indexing.

## 4. Record the baseline

After data begins appearing, record weekly totals for indexed pages, clicks, impressions, click-
through rate, and the first queries generating impressions. Use query and page reports to refine
article titles and internal links; do not rewrite content solely to chase individual low-volume
query fluctuations.
