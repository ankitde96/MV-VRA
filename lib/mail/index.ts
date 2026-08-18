import { env } from "@/lib/env";
import { ConsoleMailer } from "./console";
import type { Mailer } from "./types";

let mailer: Mailer | null = null;

export function getMailer(): Mailer {
  if (mailer) return mailer;

  switch (env.MAIL_PROVIDER) {
    case "console":
      mailer = new ConsoleMailer();
      return mailer;
  }
}

export type { Mailer, MailMessage } from "./types";
