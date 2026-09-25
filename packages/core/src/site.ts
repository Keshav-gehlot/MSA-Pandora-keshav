export const siteConfig = {
  name: "MSA Pandora",
  organizer: "Microsoft Student Ambassadors, SRM",
  urls: {
    web: "https://pandora.msasrm.in",
    console: "https://console.pandora.msasrm.in",
  },
} as const;

export function pageTitle(section?: string): string {
  const trimmed = section?.trim();
  return trimmed ? `${trimmed} · ${siteConfig.name}` : siteConfig.name;
}
