type AlertBannerProps = {
  visible: boolean;
  message: string;
};

export function AlertBanner({ visible, message }: AlertBannerProps) {
  if (!visible) {
    return null;
  }

  return (
    <div className="rounded-xl border border-rose-500/40 bg-rose-500/15 px-4 py-3 text-sm text-rose-100 shadow-lg shadow-rose-900/30">
      <p className="font-semibold">Engagement Warning</p>
      <p className="text-rose-100/90">{message}</p>
    </div>
  );
}
