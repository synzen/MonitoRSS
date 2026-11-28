const VIDEO_URL_PATTERN = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;

export function isVideoMediaUrl(url?: string | null): boolean {
  return !!url && VIDEO_URL_PATTERN.test(url);
}
