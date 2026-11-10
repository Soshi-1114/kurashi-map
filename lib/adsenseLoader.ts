// 一文書一回。React StrictMode・同じ枠の再レンダーで配信数を増やさない。
let loading: Promise<void> | undefined;

export function loadAdsense(clientId: string): Promise<void> {
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = "kurashimap-adsense";
    script.async = true;
    script.crossOrigin = "anonymous";
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("AdSense script unavailable"));
    document.head.appendChild(script);
  });
  return loading;
}

export function requestAdsenseSlot() {
  const target = window as Window & { adsbygoogle?: object[] };
  (target.adsbygoogle = target.adsbygoogle || []).push({});
}
