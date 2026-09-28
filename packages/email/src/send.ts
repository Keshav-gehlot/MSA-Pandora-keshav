import { render } from "@react-email/render";
import { templates, type TemplateName, type TemplateProps } from "./registry";
import { fileTransport, resendTransport, type MailTransport } from "./transport";

const DEFAULT_FROM = "MSA Pandora <pandora@recruitments.msasrm.in>";

export function getTransport(): MailTransport {
  const { MAIL_TRANSPORT, RESEND_API_KEY, DEPLOY_TARGET } = process.env;
  // When actually deployed, writing mail to a file would silently lose every email, so a missing setting is an error.
  if (DEPLOY_TARGET && (MAIL_TRANSPORT !== "resend" || !RESEND_API_KEY)) {
    throw new Error("MAIL_TRANSPORT=resend and RESEND_API_KEY must be set when deployed (DEPLOY_TARGET is set)");
  }
  if (MAIL_TRANSPORT === "resend") return resendTransport(RESEND_API_KEY ?? "");
  return fileTransport(process.env.MAIL_OUTBOX_PATH ?? ".mail/outbox.jsonl");
}

export async function sendEmail<T extends TemplateName>(
  input: { to: string; template: T; props: TemplateProps<T> },
  options: { transport?: MailTransport } = {},
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const allowlist = process.env.MAIL_ALLOWLIST?.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean) ?? [];
  // Previews fail closed: with no allowlist they send nothing, so a preview can never email real participants.
  const preview = process.env.DEPLOY_TARGET === "preview";
  if ((allowlist.length > 0 || preview) && !allowlist.includes(input.to.trim().toLowerCase())) {
    return { ok: true, id: "skipped-not-allowlisted" };
  }
  const template = templates[input.template];
  const props = input.props as never;
  try {
    const transport = options.transport ?? getTransport();
    const { id } = await transport.send({
      from: process.env.EMAIL_FROM ?? DEFAULT_FROM,
      to: input.to,
      subject: template.subject(props),
      html: await render(template.html(props)),
      text: template.text(props),
    });
    return { ok: true, id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
