import {
  magicLinkAction,
  registerAction,
  signInAction,
  signOutAction,
} from '@/lib/auth/auth-actions';
import { getAuthProviderFlags } from '@/lib/auth/auth-providers';

import { SiteNavMarketingClient } from './site-nav-marketing-client';

export function SiteNavMarketing() {
  const {
    hasGoogle,
    hasGitHub,
    hasFacebook,
    hasTwitter,
    hasMagicLink,
    hasOAuth,
  } = getAuthProviderFlags();

  return (
    <SiteNavMarketingClient
      hasFacebook={hasFacebook}
      hasGitHub={hasGitHub}
      hasGoogle={hasGoogle}
      hasMagicLink={hasMagicLink}
      hasOAuth={hasOAuth}
      hasTwitter={hasTwitter}
      magicLinkAction={hasMagicLink ? magicLinkAction : undefined}
      registerAction={registerAction}
      signInAction={signInAction}
      signOutAction={signOutAction}
    />
  );
}
