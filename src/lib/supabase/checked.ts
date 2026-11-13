import "server-only";

type Result = { data: unknown; error?: { code?: string; message: string } | null };

/**
 * Refusals a page already handles by showing nothing or « introuvable »:
 * a rule raised by a database function (forbidden, not_found…), no row for
 * `.single()`, and a table the role may not read.
 */
const EXPECTED = new Set(["P0001", "PGRST116", "42501"]);

/**
 * Awaits a Supabase read made for a page. A real failure (network, timeout,
 * broken query) raises the area's error screen instead of being shown as an
 * empty list. The result is returned unchanged otherwise.
 */
export async function checked<Q extends PromiseLike<Result>>(query: Q): Promise<Awaited<Q>> {
  const result = (await query) as Awaited<Q> & Result;
  const error = result.error;
  if (error && !EXPECTED.has(error.code ?? "")) {
    console.error("[query]", error.code ?? "", error.message);
    throw new Error("La lecture des données a échoué.");
  }
  return result;
}
