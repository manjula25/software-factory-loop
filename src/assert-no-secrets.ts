/**
 * Secrets leak guard (FR-003). The loop calls this on every string it emits
 * (prompt, PR body) before it leaves the harness: if any string contains a
 * configured environment value, the emission aborts instead of leaking.
 *
 * Every env value of meaningful length is treated as sensitive — a base URL
 * is not a credential, but the standing rule is that environment values are
 * never echoed, so we don't rank them.
 */
const MIN_SENSITIVE_LENGTH = 8;

export function assertNoSecrets(
  strings: readonly string[],
  env: Readonly<Record<string, string>>,
): void {
  const secrets = Object.entries(env).filter(
    ([, value]) => value.length >= MIN_SENSITIVE_LENGTH,
  );
  strings.forEach((text, index) => {
    for (const [key, value] of secrets) {
      if (text.includes(value)) {
        throw new Error(
          `Secret leak blocked: string #${index + 1} contains the value of ${key}: "${text}"`,
        );
      }
    }
  });
}
