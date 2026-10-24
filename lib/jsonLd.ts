/** JSON-LD を script 要素へ安全に埋め込む。HTML パーサーによる </script> の解釈を防ぐ。 */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
