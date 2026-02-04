export class HttpError extends Error {
  readonly status: number;
  readonly body: string | null;

  constructor(message: string, status: number, body: string | null) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.body = body;
  }
}

export class ParseError extends Error {
  readonly causeMessage: string;

  constructor(message: string, causeMessage: string) {
    super(message);
    this.name = 'ParseError';
    this.causeMessage = causeMessage;
  }
}
