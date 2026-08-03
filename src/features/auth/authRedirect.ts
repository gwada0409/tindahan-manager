export function getAuthBaseUrl(
  location: Pick<Location, 'origin'> = window.location,
  baseUrl = import.meta.env.BASE_URL,
): string {
  return `${location.origin}${baseUrl}`;
}

export function getAuthRedirectUrl(
  route: '/login' | '/reset-password',
  location: Pick<Location, 'origin'> = window.location,
  baseUrl = import.meta.env.BASE_URL,
): string {
  return `${getAuthBaseUrl(location, baseUrl)}#${route}`;
}
