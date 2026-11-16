import { useRef, useState, type FormEvent } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, FileText, Paperclip, Trash2, Upload } from 'lucide-react';
import { api, ApiError, downloadFile } from '../../lib/api';
import { fmtBytes, fmtDateTime } from '../../lib/format';
import type { DocMeta, Page } from '../../lib/types';
import { Banner, Button, Card, Empty, ErrorState, LoadMore, Screen, SkeletonRows } from '../../components/ui';

const MAX = 4 * 1024 * 1024;

export default function Documents() {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null), [clientErr, setClientErr] = useState('');
  const [dlErr, setDlErr] = useState(''), [confirmId, setConfirmId] = useState<string | null>(null);
  const del = useMutation({
    mutationFn: (id: string) => api(`/documents/${id}`, { method: 'DELETE' }),
    onSuccess: () => { setConfirmId(null); void qc.invalidateQueries({ queryKey: ['documents'] }); },
  });
  const list = useInfiniteQuery({
    queryKey: ['documents'], initialPageParam: 1,
    queryFn: ({ pageParam }) => api<Page<DocMeta>>(`/documents?page=${pageParam}&limit=15`),
    getNextPageParam: (p) => (p.page < p.pages ? p.page + 1 : undefined),
  });
  const upload = useMutation({
    mutationFn: (f: File) => { const form = new FormData(); form.append('file', f); return api('/documents', { method: 'POST', form }); },
    onSuccess: () => { setFile(null); if (input.current) input.current.value = ''; void qc.invalidateQueries({ queryKey: ['documents'] }); },
  });
  function pick(f: File | undefined) {
    setClientErr(''); upload.reset();
    if (f && f.size > MAX) { setClientErr(`That file is ${fmtBytes(f.size)}. The limit is 4 MB.`); setFile(null); return; }
    setFile(f ?? null);
  }
  function submit(e: FormEvent) { e.preventDefault(); if (file) upload.mutate(file); }
  const rows = list.data?.pages.flatMap((p) => p.data) ?? [];
  const upErr = upload.error instanceof ApiError ? upload.error.message : '';

  return (
    <Screen title="Documents" subtitle="Upload synthetic demonstration files only. Do not upload real medical documents.">
      <div className="cols">
        <div className="s4">
          <Card title="Upload a file" hint="PDF, PNG, JPEG or text, up to 4 MB">
            <form className="form" onSubmit={submit}>
              <div className="picker">
                <label htmlFor="file" className="sr-only">Choose a file (PDF, PNG, JPEG or text, up to 4 MB)</label>
                <input id="file" ref={input} className="sr-only" tabIndex={-1} type="file" accept=".pdf,.png,.jpg,.jpeg,.txt,application/pdf,image/png,image/jpeg,text/plain" onChange={(e) => pick(e.target.files?.[0])} />
                <Button type="button" variant="secondary" onClick={() => input.current?.click()}><Paperclip className="icon" aria-hidden />{file ? 'Choose a different file' : 'Choose file'}</Button>
                <p className="picker-name" aria-live="polite">{file ? `${file.name} (${fmtBytes(file.size)})` : 'No file selected'}</p>
              </div>
              {(clientErr || upErr) && <Banner kind="error">{clientErr || upErr}</Banner>}
              {upload.isSuccess && <Banner kind="success">Uploaded. Your file is stored privately.</Banner>}
              <Button type="submit" disabled={!file} loading={upload.isPending}><Upload className="icon" aria-hidden />Upload</Button>
            </form>
          </Card>
        </div>
        <div className="s8" aria-live="polite">
          {(dlErr || del.isError) && <div style={{ marginBottom: 16 }}><Banner kind="error">{dlErr || (del.error as Error).message}</Banner></div>}
          {list.isPending ? <SkeletonRows n={3} /> : list.isError ? <ErrorState error={list.error} retry={() => list.refetch()} /> : rows.length === 0 ? (
            <Card><Empty icon={<FileText />} title="No documents yet">Files you upload will be listed here with their details.</Empty></Card>
          ) : (
            <Card title="Your files" flush>
              <table className="tbl"><thead><tr><th>File</th><th>Details</th><th>Uploaded</th><th className="actions">Download</th></tr></thead>
                <tbody>{rows.map((d) => (
                  <tr key={d._id}>
                    <td data-label="File"><div className="cell-main"><b style={{ overflowWrap: 'anywhere' }}>{d.filename}</b><span className="num" title={d.checksum}>SHA-256 {d.checksum.slice(0, 12)}…</span></div></td>
                    <td data-label="Details" className="num"><div className="cell-main"><b>{fmtBytes(d.size)}</b><span>{d.mimeType}</span></div></td>
                    <td data-label="Uploaded" className="num">{fmtDateTime(d.uploadedAt)}</td>
                    <td className="actions">
                      {confirmId === d._id ? (
                        <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13.5 }}>Delete this file?</span>
                          <Button compact variant="danger" loading={del.isPending} onClick={() => del.mutate(d._id)}>Yes, delete</Button>
                          <Button compact variant="secondary" onClick={() => setConfirmId(null)}>Keep</Button>
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', gap: 8 }}>
                          <Button compact variant="secondary" aria-label={`Download ${d.filename}`} onClick={() => { setDlErr(''); downloadFile(d._id, d.filename).catch((e: Error) => setDlErr(e.message)); }}><Download className="icon" aria-hidden />Download</Button>
                          <Button compact variant="danger" aria-label={`Delete ${d.filename}`} onClick={() => setConfirmId(d._id)}><Trash2 className="icon" aria-hidden /></Button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}</tbody></table>
            </Card>
          )}
          <LoadMore hasNext={!!list.hasNextPage} loading={list.isFetchingNextPage} onClick={() => list.fetchNextPage()} />
        </div>
      </div>
    </Screen>
  );
}
