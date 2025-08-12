@echo off
echo 🚀 Shadow Market Tracker - GitHub Deployment Script
echo ================================================

echo.
echo 📁 Initializing Git repository...
git init

echo.
echo 📝 Adding all files...
git add .

echo.
echo 💾 Creating initial commit...
git commit -m "Initial commit: Shadow Market Tracker cyberpunk landing page"

echo.
echo 🌿 Setting main branch...
git branch -M main

echo.
echo 🔗 Adding remote origin...
git remote add origin https://github.com/Cardinal-coding-production/shadow-market-tracker-website.git

echo.
echo 🚀 Pushing to GitHub...
git push -u origin main

echo.
echo ✅ Deployment complete!
echo.
echo 🌐 Your website will be available at:
echo https://cardinal-coding-production.github.io/shadow-market-tracker-website
echo.
echo 📋 Next steps:
echo 1. Go to your GitHub repository settings
echo 2. Navigate to Pages section
echo 3. Enable GitHub Pages from main branch
echo 4. Wait 5-10 minutes for deployment
echo.
echo 🎉 Your cyberpunk website is ready for the digital frontier!

pause
