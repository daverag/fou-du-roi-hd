export function resolveAssetUrl(assetPath: string): string {
  const normalizedPath = assetPath.replace(/^\/+/, '');
  return new URL(normalizedPath, document.baseURI).toString();
}
