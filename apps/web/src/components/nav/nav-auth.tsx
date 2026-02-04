import { auth } from '@/lib/auth/auth';
import {
  magicLinkAction,
  registerAction,
  signInAction,
  signOutAction,
} from '@/lib/auth/auth-actions';
import { getAuthProviderFlags } from '@/lib/auth/auth-providers';

import { AuthButtons } from '../auth/auth-buttons';

export async function NavAuth() {
  const session = await auth();
  const user = session?.user;

  const { hasGoogle, hasGitHub, hasFacebook, hasTwitter, hasMagicLink } =
    getAuthProviderFlags();

  return (
    <AuthButtons
      hasFacebook={hasFacebook}
      hasGitHub={hasGitHub}
      hasGoogle={hasGoogle}
      hasMagicLink={hasMagicLink}
      hasTwitter={hasTwitter}
      isSignedIn={Boolean(user)}
      magicLinkAction={hasMagicLink ? magicLinkAction : undefined}
      registerAction={registerAction}
      signInAction={signInAction}
      signOutAction={signOutAction}
      userEmail={user?.email}
      userName={user?.name}
    />
  );
}
