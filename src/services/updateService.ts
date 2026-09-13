export interface UpdateInfo {
  hasUpdate: boolean;
  isNativeUpgrade: boolean;
  latestVersion: string;
  currentVersion: string;
  downloadUrl: string;
  releaseNotes: string;
  releaseTitle: string;
  publishedAt: string;
}

const GITHUB_REPO = "OtabekovsProject/filmx-apk";

/**
 * Checks if a newer native engine version is available.
 * Content and movie updates are handled seamlessly in-app via syncRemoteMediaData,
 * so users are NEVER prompted to reinstall the APK just for new movies or content!
 */
export async function checkAppUpdate(currentVersion: string): Promise<UpdateInfo | null> {
  try {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "FilmX-Mobile-App",
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const tagName: string = data.tag_name || "";
    const cleanLatest = tagName.replace(/^v/i, "").trim();
    const cleanCurrent = currentVersion.replace(/^v/i, "").trim();

    // Find the APK asset
    let downloadUrl = data.html_url;
    if (data.assets && Array.isArray(data.assets)) {
      const apkAsset = data.assets.find((a: any) =>
        a.name && (a.name.endsWith(".apk") || a.browser_download_url?.endsWith(".apk"))
      );
      if (apkAsset && apkAsset.browser_download_url) {
        downloadUrl = apkAsset.browser_download_url;
      }
    }

    const { hasUpdate, isNativeUpgrade } = evaluateVersionDiff(cleanLatest, cleanCurrent);

    return {
      hasUpdate,
      isNativeUpgrade,
      latestVersion: tagName || `v${cleanLatest}`,
      currentVersion: `v${cleanCurrent}`,
      downloadUrl,
      releaseNotes: data.body || "Yangi filmlar va tezkor pleyer takomillashtirildi.",
      releaseTitle: data.name || `FilmX ${tagName}`,
      publishedAt: data.published_at || "",
    };
  } catch (error) {
    console.warn("Update check warning:", error);
    return null;
  }
}

/**
 * Compares versions. Only triggers full APK reinstall if major or minor native version is bumped,
 * preventing annoying prompts for data-only or patch releases.
 */
function evaluateVersionDiff(latest: string, current: string): { hasUpdate: boolean; isNativeUpgrade: boolean } {
  try {
    const lParts = latest.split(".").map((p) => parseInt(p, 10) || 0);
    const cParts = current.split(".").map((p) => parseInt(p, 10) || 0);

    const lMajor = lParts[0] || 0;
    const cMajor = cParts[0] || 0;
    const lMinor = lParts[1] || 0;
    const cMinor = cParts[1] || 0;

    // Major change (e.g. 1.x -> 2.x) represents a major native engine rebuild
    if (lMajor > cMajor) {
      return { hasUpdate: true, isNativeUpgrade: true };
    }

    // Significant feature jump
    if (lMajor === cMajor && lMinor > cMinor + 1) {
      return { hasUpdate: true, isNativeUpgrade: true };
    }

    for (let i = 0; i < Math.max(lParts.length, cParts.length); i++) {
      const l = lParts[i] || 0;
      const c = cParts[i] || 0;
      if (l > c) {
        // Minor/patch update - content already syncs OTA
        return { hasUpdate: true, isNativeUpgrade: false };
      }
      if (l < c) {
        return { hasUpdate: false, isNativeUpgrade: false };
      }
    }
  } catch (e) {}

  return { hasUpdate: false, isNativeUpgrade: false };
}
