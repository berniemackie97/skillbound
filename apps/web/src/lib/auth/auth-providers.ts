export type AuthProviderFlags = {
  hasGoogle: boolean;
  hasGitHub: boolean;
  hasFacebook: boolean;
  hasTwitter: boolean;
  hasMagicLink: boolean;
  hasOAuth: boolean;
};

export function getAuthProviderFlags(): AuthProviderFlags {
  const hasGoogle =
    Boolean(process.env['AUTH_GOOGLE_ID']) &&
    Boolean(process.env['AUTH_GOOGLE_SECRET']);
  const hasGitHub =
    Boolean(process.env['AUTH_GITHUB_ID']) &&
    Boolean(process.env['AUTH_GITHUB_SECRET']);
  const hasFacebook =
    Boolean(process.env['AUTH_FACEBOOK_ID']) &&
    Boolean(process.env['AUTH_FACEBOOK_SECRET']);
  const hasTwitter =
    Boolean(process.env['AUTH_TWITTER_ID']) &&
    Boolean(process.env['AUTH_TWITTER_SECRET']);
  const hasMagicLink =
    Boolean(process.env['AUTH_EMAIL_SERVER']) &&
    Boolean(process.env['AUTH_EMAIL_FROM']);

  return {
    hasGoogle,
    hasGitHub,
    hasFacebook,
    hasTwitter,
    hasMagicLink,
    hasOAuth: hasGoogle || hasGitHub || hasFacebook || hasTwitter,
  };
}
