// CSV exports of a client's data for the coach (open in Excel or Google Sheets, or send to a physio).
//   ?type=sets   every logged set: date, session, exercise, set, reps, kg, RPE, time, distance
//   ?type=tests  every test result and mobility measure, one row per value
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = user ? await supabase.from("profiles").select("role, status").eq("id", user.id).maybeSingle() : { data: null };
  if (me?.role !== "coach" || me.status !== "active" || !UUID.test(id)) return new NextResponse("Not allowed", { status: 403 });
  const { data: client } = await supabase.from("profiles").select("full_name, email").eq("id", id).maybeSingle();
  if (!client) return new NextResponse("Not found", { status: 404 });
  const type = req.nextUrl.searchParams.get("type") === "tests" ? "tests" : "sets";
  let csv: string;

  if (type === "sets") {
    const { data } = await supabase
      .from("set_logs")
      .select("set_no, reps, load_kg, value, metrics, exercises(name), workout_items(title, exercises(name)), workout_logs!inner(workout_date, athlete_id, workouts(title))")
      .eq("workout_logs.athlete_id", id)
      .eq("done", true)
      .limit(50000);
    const rows = ((data ?? []) as unknown as {
      set_no: number; reps: number | null; load_kg: number | null; value: number | null; metrics: Record<string, unknown> | null;
      exercises: { name: string } | null; workout_items: { title: string | null; exercises: { name: string } | null } | null;
      workout_logs: { workout_date: string; workouts: { title: string } | null };
    }[])
      .map((r) => [
        r.workout_logs.workout_date,
        r.workout_logs.workouts?.title ?? "",
        r.exercises?.name ?? r.workout_items?.exercises?.name ?? r.workout_items?.title ?? "",
        r.set_no, r.reps, r.load_kg, r.value,
        Object.entries(r.metrics ?? {}).filter(([, v]) => v != null && v !== "").map(([k, v]) => `${k}=${v}`).join("; "),
      ])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])) || String(a[2]).localeCompare(String(b[2])) || Number(a[3]) - Number(b[3]));
    csv = toCsv(["Date", "Session", "Exercise", "Set", "Reps", "Load (kg)", "Value", "Other"], rows);
  } else {
    const [{ data: defs }, { data: tests }, { data: ms }, { data: rom }] = await Promise.all([
      supabase.from("test_definitions").select("key, name"),
      supabase.from("test_entries").select("test_key, tested_on, values").eq("athlete_id", id).order("tested_on"),
      supabase.from("rom_measures").select("key, name, unit"),
      supabase.from("rom_entries").select("measure_key, measured_on, left_value, right_value, value").eq("athlete_id", id).order("measured_on"),
    ]);
    const dn = new Map((defs ?? []).map((d) => [d.key as string, d.name as string]));
    const mn = new Map((ms ?? []).map((m) => [m.key as string, { name: m.name as string, unit: m.unit === "deg" ? "deg" : "cm" }]));
    const rows: unknown[][] = [];
    for (const t of (tests ?? []) as { test_key: string; tested_on: string; values: Record<string, number> }[])
      for (const [k, v] of Object.entries(t.values ?? {})) rows.push([t.tested_on, "Test", dn.get(t.test_key) ?? t.test_key, k, v]);
    for (const r of (rom ?? []) as { measure_key: string; measured_on: string; left_value: number | null; right_value: number | null; value: number | null }[]) {
      const m = mn.get(r.measure_key);
      const name = m?.name ?? r.measure_key;
      if (r.left_value != null) rows.push([r.measured_on, "Mobility", name, `left (${m?.unit ?? ""})`, r.left_value]);
      if (r.right_value != null) rows.push([r.measured_on, "Mobility", name, `right (${m?.unit ?? ""})`, r.right_value]);
      if (r.value != null) rows.push([r.measured_on, "Mobility", name, m?.unit ?? "", r.value]);
    }
    rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    csv = toCsv(["Date", "Type", "Test", "Measure", "Value"], rows);
  }
  const who = (client.full_name ?? client.email).replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "client";
  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${who}-${type}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
