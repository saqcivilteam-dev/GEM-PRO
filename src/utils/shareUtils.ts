/**
 * Public Share Utility for Google AI Studio environment
 * 
 * In AI Studio Build:
 * - Developer iframe URL contains 'ais-dev-' which requires the owner's AI Studio Google login.
 *   If shared, external accounts or other browsers receive 403 / Access Denied or redirect errors.
 * - Public preview URL contains 'ais-pre-' which is 100% free, public, and accessible by ANY account,
 *   teammate, guest, or external browser without login roadblocks.
 */

export const SHARED_APP_CANONICAL_URL =
  'https://ais-pre-2qtrkd3l54vk7xikqgdvkx-471160090687.asia-southeast1.run.app';

export interface ShareOptions {
  trackerId?: string;
  role?: 'editor' | 'viewer' | 'admin';
  coworkerName?: string;
}

export function getPublicShareUrl(optionsOrTrackerId?: string | ShareOptions): string {
  let base = SHARED_APP_CANONICAL_URL;

  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    if (origin.includes('ais-dev-')) {
      // Replace private dev host with public preview host
      base = origin.replace('ais-dev-', 'ais-pre-');
    } else if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      base = origin;
    } else if (origin.includes('ais-pre-')) {
      base = origin;
    } else {
      base = origin;
    }
  }

  const queryParams = new URLSearchParams();
  // Always guarantee the landing page when sharing the link is the Login page
  queryParams.set('landing', 'login');

  if (typeof optionsOrTrackerId === 'string') {
    if (optionsOrTrackerId) queryParams.set('tracker', optionsOrTrackerId);
  } else if (optionsOrTrackerId) {
    if (optionsOrTrackerId.trackerId) {
      queryParams.set('tracker', optionsOrTrackerId.trackerId);
    }
    if (optionsOrTrackerId.role) {
      queryParams.set('role', optionsOrTrackerId.role);
      queryParams.set('invite', 'coworker');
    }
    if (optionsOrTrackerId.coworkerName && optionsOrTrackerId.coworkerName.trim()) {
      queryParams.set('name', optionsOrTrackerId.coworkerName.trim());
    }
  }

  const queryString = queryParams.toString();
  return queryString ? `${base}?${queryString}` : base;
}
