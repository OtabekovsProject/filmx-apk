export interface UpdateInfo {
  hasUpdate: boolean;
  latestVersion: string;
  currentVersion: string;
  downloadUrl: string;
  releaseNotes: string;
  releaseTitle: string;
  publishedAt: string;
}

const GITHUB_REPO = 'OtabekovsProject/filmx-apk';

export async function checkAppUpdate(currentVersion: string): Promise<UpdateInfo | null> {
  try {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'FilmX-Mobile-App',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const tagName: string = data.tag_name || '';
    const cleanLatest = tagName.replace(/^v/i, '').trim();
    const cleanCurrent = currentVersion.replace(/^v/i, '').trim();

    // Find the APK asset
    let downloadUrl = data.html_url;
    if (data.assets && Array.isArray(data.assets)) {
      const apkAsset = data.assets.find((a: any) =>
        a.name && (a.name.endsWith('.apk') || a.browser_download_url?.endsWith('.apk'))
      );
      if (apkAsset && apkAsset.browser_download_url) {
        downloadUrl = apkAsset.browser_download_url;
      }
    }

    const hasUpdate = isNewerVersion(cleanLatest, cleanCurrent);

    return {
      hasUpdate,
      latestVersion: tagName || `v${cleanLatest}`,
      currentVersion: `v${cleanCurrent}`,
      downloadUrl,
      releaseNotes: data.body || "Yangi filmlar va tezkor pleyer takomillashtirildi.",
      releaseTitle: data.name || `FilmX ${tagName}`,
      publishedAt: data.published_at || '',
    };
  } catch (error) {
    console.warn('Update check failed:', error);
    return null;
  }
}

function isNewerVersion(latest: string, current: string): boolean {
  try {
    const lParts = latest.split('.').map((p) => parseInt(p, 10) || 0);
    const cParts = current.split('.').map((p) => parseInt(p, 10) || 0);

    for (let i = 0; i < Math.max(lParts.length, cParts.length); i++) {
      const l = lParts[i] || 0;
      const c = cParts[i] || 0;
      if (l > c) return true;
      if (l < c) return false;
    }
  } catch (e) {}
  return false;
}
