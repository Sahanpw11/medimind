import { useEffect, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { ArrowRight, MapPin, Search, Stethoscope } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { daysLabel } from '../../lib/format';
import type { Doctor, Page } from '../../lib/types';
import { Avatar, Card, Empty, ErrorState, LoadMore, Screen, SelectField, SkeletonRows } from '../../components/ui';

export default function Doctors() {
  const [sp] = useSearchParams();
  const [q, setQ] = useState(sp.get('q') ?? ''), [specialty, setSpecialty] = useState('');
  useEffect(() => { setQ(sp.get('q') ?? ''); }, [sp]); // header search can change ?q= while this page is open
  const specs = useQuery({ queryKey: ['specialties'], queryFn: () => api<{ data: string[] }>('/doctors/specialties'), staleTime: 600_000 });
  const list = useInfiniteQuery({
    queryKey: ['doctors', q, specialty], initialPageParam: 1,
    queryFn: ({ pageParam }) => api<Page<Doctor>>(`/doctors?page=${pageParam}&limit=24&q=${encodeURIComponent(q)}${specialty ? `&specialty=${encodeURIComponent(specialty)}` : ''}`),
    getNextPageParam: (p) => (p.page < p.pages ? p.page + 1 : undefined),
  });
  const rows = list.data?.pages.flatMap((p) => p.data) ?? [];
  return (
    <Screen title="Find a doctor" subtitle="Search by name or specialty, then choose an available time.">
      <div className="stack lg">
        <Card>
          <div className="filters">
            <div className="field"><label htmlFor="doc-q">Search</label><div className="search"><Search aria-hidden /><input id="doc-q" className="input" type="search" placeholder="Name or specialty" value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
            <SelectField label="Specialty" value={specialty} onChange={(e) => setSpecialty(e.target.value)}>
              <option value="">All specialties</option>
              {specs.data?.data.map((s) => <option key={s}>{s}</option>)}
            </SelectField>
          </div>
        </Card>
        <div aria-live="polite">
          {list.isPending ? <SkeletonRows n={5} /> : list.isError ? <ErrorState error={list.error} retry={() => list.refetch()} /> : rows.length === 0 ? (
            <Card><Empty icon={<Stethoscope />} title="No doctors found">Try a different name or choose All specialties.</Empty></Card>
          ) : (
            <>
              <p className="group-foot" style={{ paddingBottom: 10 }}>{list.data!.pages[0].total} doctors</p>
              <div className="doc-grid">
                {rows.map((d) => (
                  <Link key={d._id} to={`/doctors/${d._id}`} className="doc-card" aria-label={`${d.name}, ${d.specialty}`}>
                    <div className="top"><Avatar name={d.name} large /><div><h3>{d.name}</h3><p className="meta">{d.specialty}</p></div></div>
                    <p className="meta" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><MapPin className="icon" aria-hidden />{d.clinic?.city ?? 'City not listed'}</p>
                    <div className="foot"><span>{daysLabel(d.availability.map((a) => a.dayOfWeek))}</span><span className="go">View times <ArrowRight className="icon" aria-hidden /></span></div>
                  </Link>
                ))}
              </div>
              <LoadMore hasNext={!!list.hasNextPage} loading={list.isFetchingNextPage} onClick={() => list.fetchNextPage()} />
            </>
          )}
        </div>
      </div>
    </Screen>
  );
}
