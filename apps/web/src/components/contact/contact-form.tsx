'use client';

import { useCallback, useState } from 'react';

type ContactCategory = 'feedback' | 'suggestion' | 'bug' | 'question' | 'other';

const CATEGORIES: {
  value: ContactCategory;
  label: string;
  description: string;
}[] = [
  {
    value: 'feedback',
    label: 'Feedback',
    description: 'Tell us what you think',
  },
  {
    value: 'suggestion',
    label: 'Suggestion',
    description: 'Ideas for new features',
  },
  {
    value: 'bug',
    label: 'Bug Report',
    description: "Something isn't working right",
  },
  {
    value: 'question',
    label: 'Question',
    description: 'Need help with something',
  },
  { value: 'other', label: 'Other', description: 'Anything else' },
];

interface FormState {
  name: string;
  email: string;
  category: ContactCategory;
  subject: string;
  message: string;
  _hp: string; // honeypot
}

export function ContactForm() {
  const [form, setForm] = useState<FormState>({
    name: '',
    email: '',
    category: 'feedback',
    subject: '',
    message: '',
    _hp: '',
  });
  const [status, setStatus] = useState<
    'idle' | 'sending' | 'success' | 'error'
  >('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [loadedAt] = useState(() => Date.now());

  const handleChange = useCallback(
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >
    ) => {
      const { name, value } = e.target;
      setForm((prev) => ({ ...prev, [name]: value }));
    },
    []
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setErrorMessage('');

      // Validation
      if (form.message.trim().length < 10) {
        setErrorMessage('Message must be at least 10 characters.');
        return;
      }

      if (form.message.length > 2000) {
        setErrorMessage('Message must be under 2000 characters.');
        return;
      }

      // Anti-spam checks
      if (form._hp) return; // honeypot filled = bot
      if (Date.now() - loadedAt < 3000) {
        setErrorMessage('Please wait a moment before submitting.');
        return;
      }

      setStatus('sending');

      try {
        const res = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name || undefined,
            email: form.email || undefined,
            category: form.category,
            subject: form.subject || undefined,
            message: form.message,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to send message');
        }

        setStatus('success');
        setForm({
          name: '',
          email: '',
          category: 'feedback',
          subject: '',
          message: '',
          _hp: '',
        });
      } catch (err) {
        setStatus('error');
        setErrorMessage(
          err instanceof Error ? err.message : 'Something went wrong'
        );
      }
    },
    [form, loadedAt]
  );

  if (status === 'success') {
    return (
      <div className="contact-success">
        <div aria-hidden="true" className="contact-success__icon">
          &#10003;
        </div>
        <h2>Message Sent!</h2>
        <p>
          Thanks for reaching out. We&apos;ll get back to you if a response is
          needed.
        </p>
        <button
          className="button"
          type="button"
          onClick={() => setStatus('idle')}
        >
          Send Another Message
        </button>
      </div>
    );
  }

  return (
    <form noValidate className="contact-form" onSubmit={handleSubmit}>
      <div className="contact-categories">
        {CATEGORIES.map((cat) => (
          <label
            key={cat.value}
            className={`contact-category ${form.category === cat.value ? 'contact-category--active' : ''}`}
          >
            <input
              checked={form.category === cat.value}
              name="category"
              type="radio"
              value={cat.value}
              onChange={handleChange}
            />
            <span className="contact-category__label">{cat.label}</span>
            <span className="contact-category__desc">{cat.description}</span>
          </label>
        ))}
      </div>

      <div className="contact-fields">
        <div className="form-grid">
          <label>
            Name <span className="contact-optional">(optional)</span>
            <input
              name="name"
              placeholder="Your name or RSN"
              type="text"
              value={form.name}
              onChange={handleChange}
            />
          </label>
          <label>
            Email <span className="contact-optional">(optional)</span>
            <input
              name="email"
              placeholder="For follow-up replies"
              type="email"
              value={form.email}
              onChange={handleChange}
            />
          </label>
        </div>

        <label>
          Subject <span className="contact-optional">(optional)</span>
          <input
            name="subject"
            placeholder="Brief summary"
            type="text"
            value={form.subject}
            onChange={handleChange}
          />
        </label>

        <label>
          <span className="contact-label-text">
            Message<span className="contact-required">*</span>
          </span>
          <textarea
            required
            name="message"
            placeholder="What's on your mind?"
            rows={6}
            value={form.message}
            onChange={handleChange}
          />
          <span className="contact-char-count">
            {form.message.length} / 2000
          </span>
        </label>

        {/* Honeypot - hidden from real users */}
        <div
          aria-hidden="true"
          style={{ position: 'absolute', left: '-9999px', opacity: 0 }}
        >
          <input
            autoComplete="off"
            name="_hp"
            tabIndex={-1}
            type="text"
            value={form._hp}
            onChange={handleChange}
          />
        </div>
      </div>

      {errorMessage && <div className="contact-error">{errorMessage}</div>}

      <div className="form-actions">
        <button
          className="button"
          disabled={status === 'sending'}
          type="submit"
        >
          {status === 'sending' ? 'Sending...' : 'Send Message'}
        </button>
      </div>
    </form>
  );
}
