import { DrizzleAdapter } from '@auth/drizzle-adapter';
import {
  accounts,
  authenticators,
  sessions,
  users,
  verificationTokens,
} from '@skillbound/database';
import type { NextRequest } from 'next/server';
import NextAuth, {
  type NextAuthConfig,
  type NextAuthResult,
  type Session,
} from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Facebook from 'next-auth/providers/facebook';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import Nodemailer from 'next-auth/providers/nodemailer';
import Twitter from 'next-auth/providers/twitter';

import { getDbClient } from '../db';

import { credentialsSchema, verifyUserCredentials } from './auth-credentials';
import '../config/env';

const googleId = process.env['AUTH_GOOGLE_ID'];
const googleSecret = process.env['AUTH_GOOGLE_SECRET'];
const githubId = process.env['AUTH_GITHUB_ID'];
const githubSecret = process.env['AUTH_GITHUB_SECRET'];
const facebookId = process.env['AUTH_FACEBOOK_ID'];
const facebookSecret = process.env['AUTH_FACEBOOK_SECRET'];
const twitterId = process.env['AUTH_TWITTER_ID'];
const twitterSecret = process.env['AUTH_TWITTER_SECRET'];
const emailServer = process.env['AUTH_EMAIL_SERVER'];
const emailFrom = process.env['AUTH_EMAIL_FROM'];

const providers: NextAuthConfig['providers'] = [];
if (googleId && googleSecret) {
  providers.push(
    Google({
      clientId: googleId,
      clientSecret: googleSecret,
    })
  );
}
if (githubId && githubSecret) {
  providers.push(
    GitHub({
      clientId: githubId,
      clientSecret: githubSecret,
    })
  );
}
if (facebookId && facebookSecret) {
  providers.push(
    Facebook({
      clientId: facebookId,
      clientSecret: facebookSecret,
    })
  );
}
if (twitterId && twitterSecret) {
  providers.push(
    Twitter({
      clientId: twitterId,
      clientSecret: twitterSecret,
    })
  );
}
if (emailServer && emailFrom) {
  providers.push(
    Nodemailer({
      server: emailServer,
      from: emailFrom,
    })
  );
}
providers.push(
  Credentials({
    name: 'Email & Password',
    credentials: {
      identifier: { label: 'Email or username', type: 'text' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      const parsed = credentialsSchema.safeParse(credentials);
      if (!parsed.success) {
        return null;
      }
      const user = await verifyUserCredentials(parsed.data);
      if (!user) {
        return null;
      }
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      };
    },
  })
);

const authConfig: NextAuthConfig = {
  secret: process.env['AUTH_SECRET'] ?? process.env['NEXTAUTH_SECRET'],
  adapter: DrizzleAdapter(getDbClient(), {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
    authenticatorsTable: authenticators,
  }),
  session: {
    strategy: 'jwt',
  },
  providers,
  pages: {
    signIn: '/login',
    signOut: '/logout',
  },
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }
      return token;
    },
    session({ session, token, user }) {
      if (session.user) {
        session.user.id = user?.id ?? token.sub ?? session.user.id;
      }
      return session;
    },
  },
};

const authResult = NextAuth(authConfig) as NextAuthResult;

type RouteHandler = (req: NextRequest) => Promise<Response>;

export const handlers: { GET: RouteHandler; POST: RouteHandler } =
  authResult.handlers;

export const auth: () => Promise<Session | null> = () => authResult.auth();
export const signIn: NextAuthResult['signIn'] = authResult.signIn;
export const signOut: NextAuthResult['signOut'] = authResult.signOut;
