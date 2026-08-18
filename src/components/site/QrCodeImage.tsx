import { useEffect, useState } from "react";
import QRCode from "qrcode";

type Props = {
  value: string;
  size?: number;
  className?: string;
  alt?: string;
};

/**
 * Renders a scannable QR code as an <img> (PNG data URL), so it can be
 * screenshotted, right-click-saved, or downloaded via `useQrDataUrl`.
 */
export function QrCodeImage({ value, size = 256, className, alt = "QR code" }: Props) {
  const dataUrl = useQrDataUrl(value, size);
  if (!dataUrl) {
    return (
      <div
        className={className}
        style={{ width: size, height: size }}
        aria-hidden
      />
    );
  }
  return <img src={dataUrl} width={size} height={size} alt={alt} className={className} />;
}

export function useQrDataUrl(value: string, size = 256): string | null {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!value) {
      setDataUrl(null);
      return;
    }
    QRCode.toDataURL(value, { width: size, margin: 1, errorCorrectionLevel: "M" })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch((err) => {
        console.error("[QrCodeImage] failed to render QR", err);
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  return dataUrl;
}

export async function downloadQrCode(value: string, filename: string, size = 512) {
  try {
    const url = await QRCode.toDataURL(value, { width: size, margin: 2 });
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".png") ? filename : `${filename}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (err) {
    console.error("[downloadQrCode] failed", err);
    throw err;
  }
}
