# 🚀 Deployment Guide - Shadow Market Tracker Website

## 📋 Pre-Deployment Checklist

### 1. Update Placeholder URLs
Before deploying, replace these placeholder URLs in your files:

**In `index.html`:**
- Line 11: `https://yourdomain.github.io/shadow-market-tracker`
- Line 13: `https://yourdomain.github.io/shadow-market-tracker/assets/img/og-image.png`
- Line 39: `https://chrome.google.com/webstore/detail/placeholder`
- Line 58: `https://chrome.google.com/webstore/detail/placeholder`
- Line 149: `https://chrome.google.com/webstore/detail/placeholder`
- Line 177: `https://chrome.google.com/webstore/detail/placeholder`
- Line 208: `https://chrome.google.com/webstore/detail/placeholder`

**In `privacy.html` and `terms.html`:**
- Update email addresses from placeholder to real ones
- Add your actual business address where indicated

### 2. Customize Content
- Update company information
- Modify pricing to match your actual plans
- Add real contact information
- Update legal jurisdiction in Terms of Service

## 🌐 GitHub Pages Deployment

### Step 1: Create GitHub Repository
```bash
# Navigate to your website folder
cd shadow-market-tracker-website

# Initialize git repository
git init

# Add all files
git add .

# Initial commit
git commit -m "Initial commit: Shadow Market Tracker landing page"

# Set main branch
git branch -M main

# Add remote origin
git remote add origin https://github.com/Cardinal-coding-production/shadow-market-tracker-website.git

# Push to GitHub
git push -u origin main
```

### Step 2: Enable GitHub Pages
1. Go to your GitHub repository
2. Click on **Settings** tab
3. Scroll down to **Pages** section
4. Under **Source**, select **Deploy from a branch**
5. Choose **main** branch and **/ (root)** folder
6. Click **Save**
7. Wait 5-10 minutes for deployment

### Step 3: Access Your Website
Your website will be available at:
```
https://cardinal-coding-production.github.io/shadow-market-tracker-website
```

## 🔧 Alternative Hosting Options

### Netlify (Recommended for custom domain)
1. Create account at netlify.com
2. Connect your GitHub repository
3. Deploy automatically on every push
4. Add custom domain if needed

### Vercel
1. Create account at vercel.com
2. Import GitHub repository
3. Deploy with zero configuration
4. Automatic HTTPS and global CDN

### Traditional Web Hosting
Upload all files to your web hosting provider:
- Upload entire folder contents to public_html or www directory
- Ensure file permissions are set correctly
- Test all links and functionality

## 📊 SEO Optimization

### Meta Tags Included
- ✅ Title and description tags
- ✅ Open Graph tags for social sharing
- ✅ Twitter Card tags
- ✅ Viewport meta tag for mobile

### Additional SEO Steps
1. **Google Search Console**: Add your domain
2. **Google Analytics**: Add tracking code if needed
3. **Sitemap**: Create sitemap.xml for better indexing
4. **Robots.txt**: Add robots.txt file

### Sample robots.txt
```
User-agent: *
Allow: /

Sitemap: https://cardinal-coding-production.github.io/shadow-market-tracker-website/sitemap.xml
```

## 🔒 Security Considerations

### HTTPS
- GitHub Pages automatically provides HTTPS
- Ensure all external links use HTTPS
- Update any HTTP references to HTTPS

### Content Security Policy (Optional)
Add to `<head>` section for enhanced security:
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline' fonts.googleapis.com; font-src fonts.gstatic.com; img-src 'self' data:;">
```

## 📱 Testing Checklist

### Desktop Testing
- [ ] All sections load correctly
- [ ] Navigation works smoothly
- [ ] Hover effects function properly
- [ ] All links work (update placeholders first)
- [ ] Typography renders correctly

### Mobile Testing
- [ ] Responsive design works on all screen sizes
- [ ] Mobile navigation toggles correctly
- [ ] Touch interactions work properly
- [ ] Text is readable on small screens
- [ ] Buttons are touch-friendly

### Cross-Browser Testing
- [ ] Chrome (primary target)
- [ ] Firefox
- [ ] Safari
- [ ] Edge

## 🎯 Payment Processor Approval

### Required Elements (✅ All Included)
- ✅ Clear product description
- ✅ Transparent pricing information
- ✅ Subscription model clearly stated
- ✅ Privacy Policy page
- ✅ Terms of Service page
- ✅ Contact information
- ✅ Professional design
- ✅ Mobile-responsive layout

### Approval Tips
1. **Razorpay**: Ensure pricing is clear, terms are comprehensive, and include detailed privacy policy for data handling
2. **Professional presentation**: Clear subscription terms and transparent pricing
3. **Compliance**: All legal pages and contact information properly displayed

## 🔄 Maintenance

### Regular Updates
- Keep legal pages current with regulations
- Update pricing as needed
- Refresh content and statistics
- Monitor and fix any broken links

### Analytics Tracking
Add Google Analytics or similar:
```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

## 🎉 Launch Checklist

- [ ] All placeholder URLs updated
- [ ] Contact information is real
- [ ] Legal pages reviewed
- [ ] Cross-browser testing complete
- [ ] Mobile responsiveness verified
- [ ] GitHub Pages deployment successful
- [ ] Domain pointing correctly (if using custom domain)
- [ ] SSL certificate active
- [ ] Analytics tracking setup (optional)

## 📞 Support

If you encounter any issues during deployment:
1. Check GitHub Pages deployment status
2. Verify all file paths are relative
3. Ensure no server-side dependencies
4. Test locally by opening index.html in browser

---

**Your cyberpunk business intelligence website is ready for the digital frontier! 🔮✨**
