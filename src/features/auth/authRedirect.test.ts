import { describe, expect, it } from 'vitest';
import { getAuthBaseUrl, getAuthRedirectUrl } from './authRedirect';

const location = { origin: 'https://example.github.io' } as Location;

describe('base-aware auth redirects', () => {
  it('keeps localhost redirects at the root base', () => {
    expect(getAuthRedirectUrl('/reset-password', location, '/'))
      .toBe('https://example.github.io/#/reset-password');
  });

  it('includes the GitHub Pages project base', () => {
    expect(getAuthBaseUrl(location, '/tindahan-manager/'))
      .toBe('https://example.github.io/tindahan-manager/');
    expect(getAuthRedirectUrl('/login', location, '/tindahan-manager/'))
      .toBe('https://example.github.io/tindahan-manager/#/login');
  });
});