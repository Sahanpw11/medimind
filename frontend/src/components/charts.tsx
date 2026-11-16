import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface Pt { label: string; value: number }
export const nf = new Intl.NumberFormat('en-GB');

function Tip({ active, payload, unit }: { active?: boolean; payload?: { payload: Pt }[]; unit: string }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div style={{ background: 'var(--surface)', border: '0.5px solid var(--line)', borderRadius: 10, padding: '8px 12px', boxShadow: 'var(--shadow-pop)', fontSize: 13 }}>
      <div style={{ color: 'var(--ink-2)' }}>{p.label}</div>
      <div style={{ fontSize: 17, fontWeight: 600 }} className="num">{nf.format(p.value)} <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--ink-2)' }}>{unit}</span></div>
    </div>
  );
}

/** One question per chart, a single series in the brand accent. Bars <=24px, 4px rounded data end, hairline grid, tooltip + table view. */
export function BarPanel({ title, sub, data, unit, horizontal, cls }: { title: string; sub: string; data: Pt[]; unit: string; horizontal?: boolean; cls: string }) {
  const h = horizontal ? Math.max(140, data.length * 34 + 24) : 260;
  return (
    <section className={`panel ${cls}`} aria-label={title}>
      <h2>{title}</h2>
      <p className="panel-sub">{sub}</p>
      {data.length === 0 ? <p className="group-foot" style={{ padding: 0 }}>No data in this range.</p> : (
        <div role="img" aria-label={`${title}. ${data.map((d) => `${d.label} ${d.value}`).join(', ')}`} style={{ position: 'relative', flex: 1, minHeight: h }}>
          <div style={{ position: 'absolute', inset: 0 }}><ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 4, right: horizontal ? 36 : 4, bottom: 0, left: 0 }} barCategoryGap={8}>
              <CartesianGrid horizontal={!horizontal} vertical={!!horizontal} strokeWidth={1} />
              {horizontal ? (
                <>
                  <XAxis type="number" axisLine={false} tickLine={false} tickMargin={6} allowDecimals={false} />
                  <YAxis type="category" dataKey="label" width={132} axisLine={false} tickLine={false} tickFormatter={(v: string) => (v.length > 20 ? v.slice(0, 19) + '…' : v)} />
                </>
              ) : (
                <>
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tickMargin={6} interval={0} />
                  <YAxis axisLine={false} tickLine={false} width={36} allowDecimals={false} />
                </>
              )}
              <Tooltip cursor={{ fill: 'var(--surface-2)' }} content={<Tip unit={unit} />} />
              <Bar dataKey="value" fill="var(--accent)" barSize={horizontal ? 16 : 22} radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} isAnimationActive={false} label={horizontal ? { position: 'right', fontSize: 12, fill: 'var(--ink-2)' } : undefined} />
            </BarChart>
          </ResponsiveContainer></div>
        </div>
      )}
      <details>
        <summary>View data as a table</summary>
        <table><caption className="sr-only">{title}</caption><thead><tr><th scope="col">Item</th><th scope="col">{unit}</th></tr></thead>
          <tbody>{data.map((d) => <tr key={d.label}><th scope="row" style={{ fontWeight: 400 }}>{d.label}</th><td>{nf.format(d.value)}</td></tr>)}</tbody></table>
      </details>
    </section>
  );
}

