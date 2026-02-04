import Link from 'next/link';
import type { ReactNode } from 'react';

type Variant = 'solid' | 'ghost';

type CommonProps = {
  children: ReactNode;
  className?: string;
  variant?: Variant;
};

type InternalProps = CommonProps & {
  href: string;
  external?: false;
  /**
   * Next.js Link prefetch:
   * - undefined = let Next decide (default)
   * - null = "auto" behavior (varies by Next version, but is a valid type)
   * - false = disable
   */
  prefetch?: boolean | null;
};

type ExternalProps = CommonProps & {
  href: string;
  external: true;
};

export type ButtonLinkProps = InternalProps | ExternalProps;

function cx(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(' ');
}

/**
 * A Link/anchor that uses your `.button` styles.
 * - Internal links use Next <Link> for SPA navigation.
 * - External links use <a> with safe rel/target.
 */
export function ButtonLink(props: ButtonLinkProps) {
  const { variant = 'solid', className, children } = props;

  const classes = cx('button', variant === 'ghost' && 'ghost', className);

  if (props.external) {
    return (
      <a
        className={classes}
        href={props.href}
        rel="noopener noreferrer"
        target="_blank"
      >
        {children}
      </a>
    );
  }

  // IMPORTANT: With exactOptionalPropertyTypes enabled,
  // passing prefetch={undefined} is a type error.
  // So we only include the prop when it's explicitly provided.
  const prefetchProps =
    props.prefetch === undefined ? {} : { prefetch: props.prefetch };

  return (
    <Link className={classes} href={props.href} {...prefetchProps}>
      {children}
    </Link>
  );
}
