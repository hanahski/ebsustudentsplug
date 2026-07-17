import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const pickSchema = z.object({
  matchId: z.string().uuid(),
  character: z.string().trim().min(1).max(24),
});

function normalizeCharacter(value: string) {
  const v = value.trim().toLowerCase();
  if (v === "subzero" || v === "sub-zero") return "Subzero";
  if (v === "kano") return "Kano";
  if (v === "omar") return "Omar";
  return null;
}

async function isAdminUser(supabaseAdmin: any, userId: string) {
  const { data } = await supabaseAdmin.rpc("is_admin", { _uid: userId });
  return !!data;
}

async function getCredits(supabaseAdmin: any, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("credits")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Number(data?.credits ?? 0);
}

async function debitStake(supabaseAdmin: any, userId: string, stake: number, matchId: string) {
  if (await isAdminUser(supabaseAdmin, userId)) return;
  const credits = await getCredits(supabaseAdmin, userId);
  if (credits < stake) throw new Error("INSUFFICIENT_CREDITS_ONE_PLAYER");
  const balanceAfter = credits - stake;
  const { error: updateError } = await supabaseAdmin
    .from("profiles")
    .update({ credits: balanceAfter })
    .eq("id", userId);
  if (updateError) throw new Error(updateError.message);
  const { error: txError } = await supabaseAdmin.from("credit_transactions").insert({
    user_id: userId,
    amount: -stake,
    reason: "battle_stake",
    metadata: { match_id: matchId, game: "mk" },
    balance_after: balanceAfter,
  });
  if (txError) throw new Error(txError.message);
}

export const pickMkCharacter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { matchId: string; character: string }) => pickSchema.parse(input))
  .handler(async ({ data, context }) => {
    const chosen = normalizeCharacter(data.character);
    if (!chosen) throw new Error("bad character");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: match, error: loadError } = await supabaseAdmin
      .from("battle_matches")
      .select("id,status,game_type,player_a,player_b,a_character,b_character,stake")
      .eq("id", data.matchId)
      .maybeSingle();
    if (loadError) throw new Error(loadError.message);
    if (!match) throw new Error("match not found");
    if (match.game_type !== "mk") throw new Error("wrong game type");
    if (match.status !== "coin_flip") throw new Error("not in select stage");
    if (context.userId !== match.player_a && context.userId !== match.player_b) throw new Error("not a player");

    const isA = context.userId === match.player_a;
    const myColumn = isA ? "a_character" : "b_character";
    const oppColumn = isA ? "b_character" : "a_character";

    if (match[myColumn]) throw new Error("already picked");
    if (match[oppColumn] === chosen) throw new Error("character taken");

    const pickUpdate = isA
      ? { a_character: chosen, last_activity_at: new Date().toISOString() }
      : { b_character: chosen, last_activity_at: new Date().toISOString() };

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("battle_matches")
      .update(pickUpdate)
      .eq("id", data.matchId)
      .is(myColumn, null)
      .select("id,status,player_a,player_b,a_character,b_character,stake")
      .maybeSingle();
    if (updateError) throw new Error(updateError.message);
    if (!updated) throw new Error("already picked");

    if (!updated.a_character || !updated.b_character || !updated.player_b) {
      return { ok: true, waiting: true };
    }

    const aCredits = await getCredits(supabaseAdmin, updated.player_a);
    const bCredits = await getCredits(supabaseAdmin, updated.player_b);
    const aAdmin = await isAdminUser(supabaseAdmin, updated.player_a);
    const bAdmin = await isAdminUser(supabaseAdmin, updated.player_b);
    if ((aCredits < updated.stake && !aAdmin) || (bCredits < updated.stake && !bAdmin)) {
      await supabaseAdmin
        .from("battle_matches")
        .update({ status: "cancelled", last_activity_at: new Date().toISOString() })
        .eq("id", data.matchId)
        .eq("status", "coin_flip");
      throw new Error("INSUFFICIENT_CREDITS_ONE_PLAYER");
    }

    const { data: started, error: startError } = await supabaseAdmin
      .from("battle_matches")
      .update({ status: "active", started_at: new Date().toISOString(), escrowed: true, last_activity_at: new Date().toISOString() })
      .eq("id", data.matchId)
      .eq("status", "coin_flip")
      .select("id")
      .maybeSingle();
    if (startError) throw new Error(startError.message);
    if (!started) return { ok: true, started: true };

    await debitStake(supabaseAdmin, updated.player_a, updated.stake, data.matchId);
    await debitStake(supabaseAdmin, updated.player_b, updated.stake, data.matchId);

    return { ok: true, started: true };
  });