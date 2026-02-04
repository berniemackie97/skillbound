import {
  magicLinkAction,
  registerAction,
  signInAction,
} from '@/lib/auth/auth-actions';
import { getAuthProviderFlags } from '@/lib/auth/auth-providers';

import { SignInModalTrigger } from './sign-in-modal-trigger';

type SignInModalButtonProps = {
  label?: string;
  className?: string;
};

export function SignInModalButton({
  label = 'Sign in',
  className = 'button ghost',
}: SignInModalButtonProps) {
  const { hasGoogle, hasGitHub, hasFacebook, hasTwitter, hasMagicLink } =
    getAuthProviderFlags();

  return (
    <SignInModalTrigger
      label={label}
      className={className}
      hasGoogle={hasGoogle}
      hasGitHub={hasGitHub}
      hasFacebook={hasFacebook}
      hasTwitter={hasTwitter}
      hasMagicLink={hasMagicLink}
      signInAction={signInAction}
      registerAction={registerAction}
      magicLinkAction={hasMagicLink ? magicLinkAction : undefined}
    />
  );
}
