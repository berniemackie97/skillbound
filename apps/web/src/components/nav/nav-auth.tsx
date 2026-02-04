import {
  magicLinkAction,
  registerAction,
  signInAction,
  signOutAction,
} from '@/lib/auth/auth-actions';
import { auth } from '@/lib/auth/auth';
import { getAuthProviderFlags } from '@/lib/auth/auth-providers';

import { AuthButtons } from '../auth/auth-buttons';

export async function NavAuth() {
  const session = await auth();
  const user = session?.user;

  const { hasGoogle, hasGitHub, hasFacebook, hasTwitter, hasMagicLink } =
    getAuthProviderFlags();

  return (
    <AuthButtons
      isSignedIn={Boolean(user)}
      userEmail={user?.email}
      userName={user?.name}
      hasGoogle={hasGoogle}
      hasGitHub={hasGitHub}
      hasFacebook={hasFacebook}
      hasTwitter={hasTwitter}
      hasMagicLink={hasMagicLink}
      signInAction={signInAction}
      signOutAction={signOutAction}
      registerAction={registerAction}
      magicLinkAction={hasMagicLink ? magicLinkAction : undefined}
    />
  );
}
