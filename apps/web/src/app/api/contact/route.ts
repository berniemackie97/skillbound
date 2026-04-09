import { NextResponse } from 'next/server';

const CONTACT_EMAIL = 'bs.development.contact@gmail.com';
const RESEND_API_KEY = process.env['RESEND_API_KEY'];

interface ContactPayload {
  name?: string;
  email?: string;
  category: string;
  subject?: string;
  message: string;
}

const VALID_CATEGORIES = ['feedback', 'suggestion', 'bug', 'question', 'other'];

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ContactPayload;

    // Validate
    if (!body.message || body.message.trim().length < 10) {
      return NextResponse.json(
        { error: 'Message must be at least 10 characters' },
        { status: 400 }
      );
    }

    if (body.message.length > 2000) {
      return NextResponse.json(
        { error: 'Message must be under 2000 characters' },
        { status: 400 }
      );
    }

    if (!VALID_CATEGORIES.includes(body.category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }

    // Sanitize
    const name = body.name?.slice(0, 100) || 'Anonymous';
    const email = body.email?.slice(0, 200) || 'Not provided';
    const category = body.category;
    const subject =
      body.subject?.slice(0, 200) || `${category} from SkillBound`;
    const message = body.message.slice(0, 2000);

    const emailSubject = `[SkillBound ${category}] ${subject}`;
    const emailBody = `
New ${category} from SkillBound Contact Form

From: ${name}
Email: ${email}
Category: ${category}
Subject: ${subject}

Message:
${message}

---
Sent from SkillBound Contact Form
    `.trim();

    // Send via Resend API if key is available
    if (RESEND_API_KEY) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'SkillBound <noreply@skillbound.org>',
          to: [CONTACT_EMAIL],
          subject: emailSubject,
          text: emailBody,
          reply_to: body.email || undefined,
        }),
      });

      if (!res.ok) {
        const errorData = await res.text();
        console.error('Resend API error:', errorData);
        return NextResponse.json(
          { error: 'Failed to send email' },
          { status: 500 }
        );
      }
    } else {
      // Fallback: log to console in development
      console.log('=== CONTACT FORM SUBMISSION ===');
      console.log(`To: ${CONTACT_EMAIL}`);
      console.log(`Subject: ${emailSubject}`);
      console.log(emailBody);
      console.log('=== END CONTACT FORM ===');
      console.warn('RESEND_API_KEY not set - email logged to console only');
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
