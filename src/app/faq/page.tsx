import { requireState } from "@/lib/session";
import { FAQ } from "@/lib/faq";
import { BackLink, Heading, Screen } from "@/components/ui";

export default async function FaqPage() {
  await requireState(["athlete", "coach"]);
  return (
    <Screen>
      <BackLink href="/" label="Home" />
      <Heading sub="Quick answers on training, niggles and food. Tap a question to open it.">
        FAQ
      </Heading>

      <nav className="mb-6 flex flex-wrap gap-2" aria-label="FAQ sections">
        {FAQ.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="rounded-full border border-line bg-surface-2 px-3 py-1.5 text-sm font-bold"
          >
            {s.title}
          </a>
        ))}
      </nav>

      {FAQ.map((s) => (
        <section key={s.id} id={s.id} className="mb-8 scroll-mt-6">
          <h2 className="mb-3 text-xl font-black uppercase tracking-tight">
            {s.title}
          </h2>
          {s.alert && (
            <div className="mb-3 rounded-2xl border border-brand/70 bg-brand/10 p-5">
              <p className="font-extrabold">{s.alert.title}</p>
              <p className="mt-1 text-sm">{s.alert.lead}</p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm">
                {s.alert.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {s.items.map((it) => (
              <details key={it.q} className="group">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-bold">
                  {it.q}
                  <span
                    aria-hidden
                    className="shrink-0 text-muted transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <div className="px-4 pb-4 text-[15px] leading-relaxed">
                  {it.a.map((p) => (
                    <p key={p} className="mb-2">
                      {p}
                    </p>
                  ))}
                  {it.tables?.map((t) => (
                    <div key={t.caption} className="mt-3">
                      <p className="mb-1 text-sm font-extrabold">{t.caption}</p>
                      <table className="w-full text-left text-sm">
                        <thead className="text-xs text-muted">
                          <tr>
                            <th className="py-1 pr-2 font-semibold">
                              {t.head[0]}
                            </th>
                            <th className="py-1 pr-2 font-semibold">
                              {t.head[1]}
                            </th>
                            <th className="py-1 text-right font-semibold">
                              {t.head[2]}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {t.rows.map((r) => (
                            <tr key={r[0]} className="border-t border-line">
                              <td className="py-1.5 pr-2">{r[0]}</td>
                              <td className="py-1.5 pr-2 text-muted">{r[1]}</td>
                              <td className="py-1.5 text-right font-bold">
                                {r[2]}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </section>
      ))}
      <p className="mb-6 text-xs text-muted">
        General guidance only. It doesn&apos;t replace advice from your coach, a
        doctor, physio or dietitian about your own situation.
      </p>
    </Screen>
  );
}
