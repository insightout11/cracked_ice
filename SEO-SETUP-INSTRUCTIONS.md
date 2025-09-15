# SEO Setup Instructions for Cracked Ice Hockey

## Google Analytics 4 Setup

### Step 1: Create Google Analytics Account
1. Go to [Google Analytics](https://analytics.google.com/)
2. Click "Start measuring"
3. Create an account named "Cracked Ice Hockey"
4. Create a property named "crackedicehockey.com"
5. Select "Web" as platform
6. Enter website URL: `https://crackedicehockey.com`

### Step 2: Get Your Measurement ID
1. After setup, copy your Measurement ID (format: G-XXXXXXXXXX)
2. In `index.html`, replace `G-XXXXXXXXXX` with your actual Measurement ID (appears in 2 places)

### Step 3: Configure Enhanced Events
Set up these custom events in GA4:
- `tool_usage` - Track when users interact with optimizer tools
- `feature_engagement` - Track specific feature usage
- `complement_analysis` - Track complement analysis usage
- `schedule_view` - Track schedule page visits

## Google Search Console Setup

### Step 1: Verify Domain
1. Go to [Google Search Console](https://search.google.com/search-console/)
2. Add property: `crackedicehockey.com`
3. Choose "Domain" verification method
4. Add the TXT record to your Namecheap DNS settings:
   - Type: TXT
   - Host: @
   - Value: [provided by Google]

### Step 2: Submit Sitemap
1. After verification, go to "Sitemaps" in left menu
2. Submit: `https://crackedicehockey.com/sitemap.xml`

## Bing Webmaster Tools Setup

1. Go to [Bing Webmaster Tools](https://www.bing.com/webmasters/)
2. Add site: `https://crackedicehockey.com`
3. Verify using Google Search Console (easiest method)
4. Submit sitemap: `https://crackedicehockey.com/sitemap.xml`

## Target Keywords by Page

### Homepage (/)
- Primary: "fantasy hockey optimizer"
- Secondary: "NHL weekly schedule", "fantasy hockey tools"
- Long-tail: "free fantasy hockey lineup optimizer"

### Schedule Page (/schedule)
- Primary: "NHL weekly schedule"
- Secondary: "fantasy hockey schedule", "NHL schedule grid"
- Long-tail: "NHL weekly schedule analysis tool"

### Game Analysis (/game-analysis)
- Primary: "fantasy hockey off-night strategy"
- Secondary: "back-to-back games NHL", "fantasy hockey analysis"
- Long-tail: "NHL off-night games fantasy strategy"

## Content Strategy for Blog

### Seasonal Content Calendar
- **October**: "2024-25 Fantasy Hockey Draft Strategy"
- **November**: "Best Off-Night Teams for Fantasy Hockey"
- **December**: "Holiday Week NHL Schedule Analysis"
- **January**: "Mid-Season Fantasy Hockey Trade Targets"
- **February**: "All-Star Break Impact on Fantasy Hockey"
- **March**: "Playoff Push Fantasy Hockey Strategy"

### Evergreen Content Ideas
1. "Complete Guide to Fantasy Hockey Off-Night Strategy"
2. "How to Use Back-to-Back Games in Fantasy Hockey"
3. "NHL Schedule Analysis: Finding Hidden Advantages"
4. "Fantasy Hockey Complement Analysis Explained"
5. "Best Fantasy Hockey Tools for 2024-25"

## Performance Monitoring

### Core Web Vitals Targets
- Largest Contentful Paint (LCP): < 2.5s
- First Input Delay (FID): < 100ms
- Cumulative Layout Shift (CLS): < 0.1

### SEO KPIs to Track
- Organic traffic growth: Target 200% increase in 3 months
- Keyword rankings: Top 20 for primary keywords in 6 months
- Click-through rate from search: Target 5-8%
- Page load speed: Target < 3 seconds

## Monthly SEO Tasks

### Week 1
- Review Google Analytics for user behavior insights
- Check Search Console for new keyword opportunities
- Update meta descriptions based on performance

### Week 2
- Publish 1-2 new blog posts targeting seasonal keywords
- Update existing content with fresh statistics
- Check for broken links and technical issues

### Week 3
- Analyze competitor content and keywords
- Update internal linking structure
- Optimize images with better alt text

### Week 4
- Review and update XML sitemap
- Monitor Core Web Vitals performance
- Plan next month's content calendar

## Competition Analysis

### Primary Competitors
- FantasyHockeySim.com
- Dobber Hockey tools
- Daily Faceoff lineup tools

### Competitive Advantages to Highlight
- Free comprehensive NHL weekly schedule tool
- Advanced complement analysis algorithm
- Real-time off-night identification
- User-friendly interface design
- Data-driven fantasy hockey insights

## Technical SEO Checklist

### ✅ Completed
- [x] Meta titles and descriptions optimized
- [x] Open Graph and Twitter Card tags
- [x] Schema.org structured data
- [x] XML sitemap created
- [x] Robots.txt configured
- [x] Google Analytics 4 code added
- [x] Canonical URLs set
- [x] Favicon implemented

### 🔄 Next Steps (To be completed)
- [ ] Set up actual Google Analytics account
- [ ] Verify Google Search Console
- [ ] Set up Bing Webmaster Tools
- [ ] Create blog section routing
- [ ] Optimize Core Web Vitals
- [ ] Add FAQ schema markup
- [ ] Implement breadcrumb navigation

This SEO foundation positions Cracked Ice Hockey to rank competitively for fantasy hockey and NHL schedule-related searches while building sustainable organic traffic.