const DRIVE_ID_RAW_REGEX = /^[a-zA-Z0-9_-]{15,100}$/;

export function extractGoogleDriveFileId(rawInput: string): string | null {
  const input = rawInput.trim();
  if (!input) return null;

  if (DRIVE_ID_RAW_REGEX.test(input)) {
    return input;
  }

  try {
    const url = new URL(input);
    const host = url.hostname.toLowerCase();

    if (host === 'drive.google.com' || host === 'docs.google.com') {
      // /file/d/<ID>/view or /d/<ID>/...
      const pathMatch = url.pathname.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
      if (pathMatch?.[1]) return pathMatch[1];

      // ?id=<ID> (open?id=..., uc?id=..., thumbnail?id=...)
      const queryId = url.searchParams.get('id');
      if (queryId && /^[a-zA-Z0-9_-]{10,}$/.test(queryId)) {
        return queryId;
      }
    }

    if (host === 'lh3.googleusercontent.com') {
      const lh3Match = url.pathname.match(/^\/d\/([a-zA-Z0-9_-]{10,})/);
      if (lh3Match?.[1]) return lh3Match[1];
    }
  } catch {
    return null;
  }

  return null;
}

export function normalizeImageInput(rawInput: string): string {
  const trimmed = rawInput.trim();
  if (!trimmed) return '';

  const driveId = extractGoogleDriveFileId(trimmed);
  if (driveId) {
    return `https://drive.google.com/thumbnail?id=${driveId}&sz=w1600`;
  }

  return trimmed;
}

export function isValidImageInput(rawInput: string): boolean {
  const trimmed = rawInput.trim();
  if (!trimmed) return true;
  if (extractGoogleDriveFileId(trimmed)) return true;

  try {
    const url = new URL(trimmed);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export function resolveDisplayImageUrl(rawInput?: string): string | null {
  if (!rawInput) return null;
  const normalized = normalizeImageInput(rawInput);
  if (!normalized) return null;
  try {
    const url = new URL(normalized);
    if (url.protocol === 'https:' || url.protocol === 'http:') {
      return url.toString();
    }
    return null;
  } catch {
    return null;
  }
}
