export function resolveTemplate(
  template: { subject: string; body_html: string },
  vars: Record<string, string>
): { subject: string; body_html: string } {
  const resolve = (str: string) =>
    str.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '')
  return { subject: resolve(template.subject), body_html: resolve(template.body_html) }
}
