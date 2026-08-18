/**
 * CONSTRAINTS.md #10-adjacent — one interface, feature code never sees which transport is
 * behind it. Only a console transport exists (lib/mail/console.ts); PLAN.md's own open
 * question on the real provider is a later, separate decision.
 */
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}
