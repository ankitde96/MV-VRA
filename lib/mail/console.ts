import type { Mailer, MailMessage } from "./types";

/**
 * Dev-only transport (MAIL_PROVIDER=console, the only value that exists — lib/env.ts).
 * `ROLLBACK.md`: sent emails cannot be rolled back, so nothing in this codebase points at
 * a real sender yet — every OTP in dev and in tests is read from this log line, never a
 * real inbox.
 */
export class ConsoleMailer implements Mailer {
  async send(message: MailMessage): Promise<void> {
    console.log(
      `[mail:console] to=${message.to} subject="${message.subject}"\n${message.text}`,
    );
  }
}
