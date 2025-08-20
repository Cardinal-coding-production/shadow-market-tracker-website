/* global chrome */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.command === "extractPageContext") {
    // Extract page title
    const title = document.title;
    // Extract meta description
    const metaDescription = document.querySelector('meta[name="description"]')?.content || '';
    // Extract main headings (h1, h2)
    const headings = Array.from(document.querySelectorAll('h1, h2')).map(h => h.innerText).filter(Boolean);
    // Optionally, extract keywords meta tag
    const metaKeywords = document.querySelector('meta[name="keywords"]')?.content || '';

    sendResponse({
      title,
      metaDescription,
      headings,
      metaKeywords
    });
    return true; // Indicates async response
  }
}); 