// Launcher versions (x.y.z, as in package.json and the release tags).

function parts(version: string): number[] | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** true only when both are plain x.y.z versions and `candidate` is newer than `current`. */
export function isNewerVersion(candidate: string, current: string): boolean {
  const a = parts(candidate);
  const b = parts(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i]! > b[i]!;
  return false;
}

/** Release page of one version, built from the version only (never from text the window sends). */
export function releasePageUrl(releasesUrl: string, version: string): string {
  return parts(version) ? `${releasesUrl}/tag/v${version.trim().replace(/^v/, '')}` : releasesUrl;
}
