'use client';
/* eslint-disable @next/next/no-img-element -- a generated data: url, printed as a plain image */

// ─── A PromptPay QR from the EMVCo payload the server built (GET /invoices/:id/promptpay) ───
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export function PromptPayQr({ payload, size = 150, alt = '' }: { payload: string; size?: number; alt?: string }) {
    const [src, setSrc] = useState<string | null>(null);
    useEffect(() => {
        let alive = true;
        QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', margin: 1, width: size * 3 })
            .then(url => { if (alive) setSrc(url); })
            .catch(() => { if (alive) setSrc(null); });
        return () => { alive = false; };
    }, [payload, size]);
    if (src === null) return <div style={{ width: size, height: size }} aria-hidden="true" />;
    return <img src={src} alt={alt} width={size} height={size} style={{ width: size, height: size, imageRendering: 'pixelated' }} />;
}
