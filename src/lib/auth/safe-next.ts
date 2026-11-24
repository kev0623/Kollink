/** 只接受站內路徑，避免登入後被導到外部網站（open redirect）。 */
export function safeNextPath(input: string | null | undefined): string | null {
  if (!input || input.length > 512) return null;
  if (!input.startsWith("/")) return null;
  if (input[1] === "/" || input[1] === "\\") return null;
  if (/[\u0000-\u001f\u007f]/.test(input)) return null;
  if (input.includes("\\") || /%2e/i.test(input)) return null;
  const pathname = input.split(/[?#]/)[0];
  if (pathname.split("/").some((seg) => seg === "." || seg === "..")) return null;
  if (/^\/(auth|login|signup)/.test(pathname)) return null;
  return input;
}
