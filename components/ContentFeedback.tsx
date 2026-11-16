"use client";

import { useEffect, useRef, useState } from "react";
import { FEEDBACK_REASONS, FEEDBACK_VERSION, type FeedbackAnswer, type FeedbackCounts, type FeedbackReason, type FeedbackSection } from "@/lib/contentFeedback";
import { track } from "@/lib/analytics";

type Result = { available: boolean; counts: FeedbackCounts; voted: boolean; token: string };

export default function ContentFeedback({ page, section }: { page: string; section: FeedbackSection }) {
  return <FeedbackForm key={`${page}:${section}:${FEEDBACK_VERSION}`} page={page} section={section} />;
}

function FeedbackForm({ page, section }: { page: string; section: FeedbackSection }) {
  const panel = useRef<HTMLElement>(null);
  const viewed = useRef(false);
  const [result, setResult] = useState<Result | null>(null);
  const [negative, setNegative] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ page, section, version: FEEDBACK_VERSION });
    void fetch(`/api/content-feedback?${query}`, { signal: controller.signal, cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error("Unavailable");
      const data = await response.json();
      if (data.available && data.counts && Number.isSafeInteger(data.counts.yes) && data.counts.yes >= 0 && Number.isSafeInteger(data.counts.no) && data.counts.no >= 0 && !controller.signal.aborted) setResult(data);
    }).catch(() => { /* 未設定・障害時は本文の閲覧を妨げない。 */ });
    return () => controller.abort();
  }, [page, section]);

  useEffect(() => {
    if (!result?.available || !panel.current || viewed.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(entries => {
      if (viewed.current || !entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= 0.5)) return;
      viewed.current = true;
      track("content_feedback_view", { item_id: page, section, measurement_version: FEEDBACK_VERSION });
      observer.disconnect();
    }, { threshold: 0.5 });
    observer.observe(panel.current);
    return () => observer.disconnect();
  }, [result?.available, page, section]);

  async function submit(answer: FeedbackAnswer, reason?: FeedbackReason) {
    if (!result || pending) return;
    setPending(true); setError(false);
    try {
      const response = await fetch("/api/content-feedback", { method: "POST", headers: { "content-type": "application/json", "x-feedback-token": result.token }, body: JSON.stringify({ page, section, version: FEEDBACK_VERSION, answer, ...(reason ? { reason } : {}) }) });
      if (!response.ok) throw new Error("Unavailable");
      const data = await response.json();
      if (!data.voted || !data.counts || !Number.isSafeInteger(data.counts.yes) || data.counts.yes < 0 || !Number.isSafeInteger(data.counts.no) || data.counts.no < 0) throw new Error("Invalid response");
      setResult({ ...result, counts: data.counts, voted: true });
      if (!data.duplicate) track("content_feedback_submit", { item_id: page, section, method: answer, measurement_version: FEEDBACK_VERSION });
    } catch { setError(true); }
    finally { setPending(false); }
  }

  if (!result?.available) return null;
  const total = result.counts.yes + result.counts.no;
  return <section ref={panel} className="content-feedback" aria-label="この情報への評価" aria-busy={pending}>
    <h2>この情報で、知りたかったことが分かりましたか？</h2>
    {result.voted ? <p role="status">回答を受け付けました。ご協力ありがとうございます。</p> : <>
      <div className="content-feedback-actions"><button type="button" disabled={pending} onClick={() => void submit("yes")}>分かった</button><button type="button" disabled={pending} aria-expanded={negative} onClick={() => setNegative(true)}>分からなかった</button></div>
      {negative && <fieldset disabled={pending}><legend>理由を教えてください（任意）</legend><div className="content-feedback-reasons">{FEEDBACK_REASONS.map(reason => <button type="button" key={reason.value} onClick={() => void submit("no", reason.value)}>{reason.label}</button>)}<button type="button" onClick={() => void submit("no")}>理由を選ばず回答する</button></div></fieldset>}
    </>}
    {error && <p role="alert">回答を保存できませんでした。時間をおいて、もう一度お試しください。</p>}
    <p className="content-feedback-count">この版の回答：{total.toLocaleString()}件（分かった {result.counts.yes.toLocaleString()}件／分からなかった {result.counts.no.toLocaleString()}件）</p>
    <p className="content-feedback-note">情報の分かりやすさを改善するためのアンケートです。街の評価や、統計の正しさを示すものではありません。<a href="/privacy#content-feedback">回答の取り扱い</a></p>
  </section>;
}
