import { SupabaseClient } from "@supabase/supabase-js";

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

export async function checkRateLimit(
  supabase: SupabaseClient,
  table: string,
  userColumn: string,
  userId: string,
  maxPerHour: number
): Promise<void> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { count } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq(userColumn, userId)
    .gte("created_at", oneHourAgo);

  if ((count ?? 0) >= maxPerHour) {
    throw new RateLimitError(
      `Rate limit exceeded. Maximum ${maxPerHour} per hour.`
    );
  }
}
