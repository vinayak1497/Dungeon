declare module "pdf-parse" {
  const parse: (data: Buffer | Uint8Array) => Promise<{ text: string; numpages?: number; info?: unknown; metadata?: unknown }>;
  export default parse;
}

// Direct lib import: bypasses pdf-parse/index.js, whose `!module.parent`
// debug block runs a self-test (readFileSync './test/data/...') at import
// time and crashes inside Next.js server bundles.
declare module "pdf-parse/lib/pdf-parse.js" {
  const parse: (data: Buffer | Uint8Array) => Promise<{ text: string; numpages?: number; info?: unknown; metadata?: unknown }>;
  export default parse;
}
