import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, ClipboardList, HeartPulse, Pill } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { fmtDate } from '../../lib/format';
import { useMedia } from '../../lib/hooks';
import type { MedicalRecord, Page } from '../../lib/types';
import { Button, Card, Empty, ErrorState, LoadMore, Screen, SkeletonRows } from '../../components/ui';

function Detail({ r, onBack }: { r: MedicalRecord; onBack?: () => void }) {
  const bp = r.vitals?.systolicBP && r.vitals?.diastolicBP ? `${r.vitals.systolicBP}/${r.vitals.diastolicBP} mmHg` : null;
  const hr = r.vitals?.heartRate ? `${r.vitals.heartRate} bpm` : null;
  return (
    <article className="card" aria-label={`Visit on ${fmtDate(r.visitAt)}`}>
      <div className="card-head">
        <div>
          {onBack && <Button type="button" variant="plain" compact onClick={onBack} style={{ marginLeft: -14, marginBottom: 4 }}><ChevronLeft className="icon" aria-hidden />All records</Button>}
          <h2 style={{ fontSize: 20 }}>{fmtDate(r.visitAt)}</h2>
          <p className="hint">{r.doctorName}, {r.specialty}</p>
        </div>
        {r.followUpRequired && <span className="chip accent">Follow-up advised</span>}
      </div>
      <div className="card-body stack lg">
        <section>
          <h3 className="group-title" style={{ margin: '0 0 8px' }}>Diagnoses</h3>
          <div className="group" style={{ boxShadow: 'none' }}>
            <table className="tbl"><thead><tr><th scope="col">Code</th><th scope="col">Description</th></tr></thead>
              <tbody>{r.diagnoses.map((d) => <tr key={d.code}><td data-label="Code" className="num"><b>{d.code}</b></td><td data-label="Description">{d.description}</td></tr>)}</tbody></table>
          </div>
        </section>
        <section>
          <h3 className="group-title" style={{ margin: '0 0 8px' }}>Vitals at this visit</h3>
          {bp || hr ? (
            <dl className="dl">
              {bp && <div className="kv"><dt style={{ display: 'flex', gap: 6, alignItems: 'center' }}><HeartPulse className="icon" aria-hidden />Blood pressure</dt><dd className="num" style={{ fontSize: 20, fontWeight: 600 }}>{bp}</dd></div>}
              {hr && <div className="kv"><dt style={{ display: 'flex', gap: 6, alignItems: 'center' }}><HeartPulse className="icon" aria-hidden />Heart rate</dt><dd className="num" style={{ fontSize: 20, fontWeight: 600 }}>{hr}</dd></div>}
            </dl>
          ) : <p style={{ color: 'var(--ink-2)' }}>No vitals were recorded.</p>}
        </section>
        <section>
          <h3 className="group-title" style={{ margin: '0 0 8px' }}>Medications</h3>
          {r.medications.length ? <div className="timeline-dx">{r.medications.map((m) => <span key={m} className="chip neutral"><Pill className="icon" aria-hidden />{m}</span>)}</div> : <p style={{ color: 'var(--ink-2)' }}>None prescribed at this visit.</p>}
        </section>
        <section>
          <h3 className="group-title" style={{ margin: '0 0 8px' }}>Doctor&apos;s notes</h3>
          <p>{r.notes || 'No notes were added.'}</p>
        </section>
      </div>
      <div className="card-foot">Synthetic record for demonstration. Not medical advice.</div>
    </article>
  );
}

export default function Records() {
  const { user } = useAuth();
  const wide = useMedia('(min-width: 1024px)');
  const [sp, setSp] = useSearchParams();
  const q = useInfiniteQuery({
    queryKey: ['records', user!.profileId], initialPageParam: 1,
    queryFn: ({ pageParam }) => api<Page<MedicalRecord>>(`/medical-records/patient/${user!.profileId}?page=${pageParam}&limit=12`),
    getNextPageParam: (p) => (p.page < p.pages ? p.page + 1 : undefined),
  });
  const rows = q.data?.pages.flatMap((p) => p.data) ?? [];
  const selectedId = sp.get('r');
  const selected = rows.find((r) => r._id === selectedId) ?? (wide ? rows[0] : undefined);
  const select = (id: string | null) => setSp(id ? { r: id } : {}, { replace: true });
  useEffect(() => { if (wide && !selectedId && rows[0]) setSp({ r: rows[0]._id }, { replace: true }); }, [wide, rows.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = (
    <Card title="Visits" hint={`${q.data?.pages[0].total ?? 0} on record`} flush>
      {rows.map((r) => (
        <button key={r._id} type="button" className="row record-row" aria-current={selected?._id === r._id ? 'true' : undefined} onClick={() => select(r._id)}>
          <span className="row-main"><span className="row-title">{r.diagnoses.map((d) => d.description).join(', ')}</span><span className="row-sub">{r.doctorName}</span></span>
          <span className="row-detail num">{fmtDate(r.visitAt)}</span>
          <ChevronRight className="icon chev" aria-hidden />
        </button>
      ))}
    </Card>
  );

  return (
    <Screen title="Medical records" subtitle="Synthetic visit history. Only you and doctors you have seen can view it.">
      {q.isPending ? <SkeletonRows n={3} /> : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : rows.length === 0 ? (
        <Card><Empty icon={<ClipboardList />} title="No records yet">After a completed visit, your doctor can add a record that will show here.</Empty></Card>
      ) : wide ? (
        <div className="cols">
          <div className="s5">{list}<LoadMore hasNext={!!q.hasNextPage} loading={q.isFetchingNextPage} onClick={() => q.fetchNextPage()} /></div>
          <div className="s7 detail-sticky">{selected && <Detail r={selected} />}</div>
        </div>
      ) : selected ? (
        <Detail r={selected} onBack={() => select(null)} />
      ) : (
        <>{list}<LoadMore hasNext={!!q.hasNextPage} loading={q.isFetchingNextPage} onClick={() => q.fetchNextPage()} /></>
      )}
    </Screen>
  );
}
