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
      className={className}
      hasFacebook={hasFacebook}
      hasGitHub={hasGitHub}
      hasGoogle={hasGoogle}
      hasMagicLink={hasMagicLink}
      hasTwitter={hasTwitter}
      label={label}
      magicLinkAction={hasMagicLink ? magicLinkAction : undefined}
      registerAction={registerAction}
      signInAction={signInAction}
    />
  );
}
