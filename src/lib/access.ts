// Staff can only reach the channel assistants (email, social, voice, WhatsApp). Every other page stays
// out of the console until it is deliberately listed here.
export const ASSISTANT_PATHS = ["/email", "/social", "/staff-voice", "/whatsapp"] as const;

export const DEFAULT_ASSISTANT_PATH: (typeof ASSISTANT_PATHS)[number] = "/email";

export function isAssistantPath(pathname: string): boolean {
  return (ASSISTANT_PATHS as readonly string[]).includes(pathname.replace(/\/+$/, "") || pathname);
}
