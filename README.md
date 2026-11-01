# Ruhul Exe – Official Website

Plain HTML, CSS and JavaScript. No build step, no paid services.

## Files
- `index.html` – the page and SEO tags
- `style.css` – black theme with red neon accents
- `script.js` – videos, live status, subscriber count, menu, contact form
- `config.js` – your settings (channel, optional API key, social links)
- `robots.txt`, `sitemap.xml`, `favicon.svg`, `.nojekyll`

## Publish on GitHub Pages (free)
1. Create a free account at github.com.
2. Tap **New repository**. Name it `ruhul-exe`, set it to **Public**, and create it.
3. Tap **Add file → Upload files**, upload every file from this folder (including `.nojekyll`), then **Commit changes**.
4. Open **Settings → Pages**. Under **Build and deployment**, set Source to **Deploy from a branch**, Branch to **main**, folder **/ (root)**, then **Save**.
5. After about one minute your site is live at `https://YOUR-USERNAME.github.io/ruhul-exe/`.

## Replace the placeholder address (needed for Google)
Replace `https://YOUR-USERNAME.github.io/ruhul-exe/` with your real address in:
- `index.html` (canonical, og:url, and the JSON-LD block – 5 places)
- `sitemap.xml`
- `robots.txt`

## Get indexed by Google (free)
1. Go to search.google.com/search-console and add your site as a **URL prefix** property.
2. Verify it (the HTML tag method: paste the given `<meta>` tag inside `<head>` in `index.html`).
3. Open **Sitemaps**, submit `sitemap.xml`.
4. Use **URL inspection → Request indexing** for your home page.

## What is real, and what has limits
- **Latest videos**: read from the channel's public RSS feed (free, no key). Shows the most recent uploads.
- **Subscriber count**: shown only if it can be confirmed. Without an API key it is a best-effort read through a free proxy; if that fails, the box stays hidden. Nothing is invented.
- **Live status**: with the optional key it checks your recent uploads for an active broadcast. Without it, a best-effort check runs. If neither works, the page says "Could not check live status" instead of guessing.
- **Community posts**: YouTube offers no free way to read these on a website, so the section links to your Community tab. You can add posts by hand in `config.js`.
- **Contact form**: opens the visitor's email app addressed to Bloggerruhul078@gmail.com (no server needed).
- **Social links**: only YouTube and email are known. Add others in `config.js`; empty ones stay hidden.

## Optional: free YouTube API key (no billing)
1. Open console.cloud.google.com, create a project.
2. Enable **YouTube Data API v3**.
3. **Credentials → Create credentials → API key**.
4. Under **Application restrictions** choose **Websites** and add `https://YOUR-USERNAME.github.io/*`. Under API restrictions choose YouTube Data API v3.
5. Paste the key into `apiKey` in `config.js`.

The key is visible in the page source, so always restrict it to your website as above.

## Social sharing image
For a preview picture when the link is shared, add a 1200×630 `og-image.png` to the repo and put this in `<head>`:
`<meta property="og:image" content="https://YOUR-USERNAME.github.io/ruhul-exe/og-image.png">`
