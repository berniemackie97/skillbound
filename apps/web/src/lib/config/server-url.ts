import 'server-only';

import { headers } from 'next/headers';

export async function getServerBaseUrl() {
  const headerList = await headers();
  const host =
    headerList.get('x-forwarded-host') ?? headerList.get('host') ?? '';
  const proto = headerList.get('x-forwarded-proto') ?? 'http';

  if (!host) {
    return 'http://localhost:3000';
  }

  return `${proto}://${host}`;
}
