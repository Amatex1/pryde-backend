/**
 * Vite Plugin: Inject Build Version
 * Adds a meta tag with the current build timestamp to index.html
 * This allows the frontend to detect when a new deployment has occurred
 */

export default function buildVersionPlugin() {
  return {
    name: 'build-version-plugin',
    transformIndexHtml(html) {
      // Generate a unique build version based on timestamp
      const buildVersion = Date.now().toString();
      
      // Inject meta tag into <head>
      return html.replace(
        '</head>',
        `  <meta name="build-version" content="${buildVersion}" />\n  </head>`
      );
    }
  };
}

