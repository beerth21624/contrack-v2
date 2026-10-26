// Opens the browser's print dialog ("Save as PDF") on a print-only document, the way BoqExportButtons does:
// mount the document synchronously, hand the page-number margin box the Sarabun family, set document.title (the
// default PDF file name), print, and undo it all on afterprint.
import { flushSync } from 'react-dom';
import { PRINT_FONT_VAR } from './BoqPrintDocument';

export function runBrowserPrint({ title, mount, unmount }: {
    /** The browser's default PDF file name. */
    title: string;
    /** Mounts the print document (a state update; it is flushed before the dialog opens). */
    mount: () => void;
    unmount: () => void;
}): void {
    const prevTitle = document.title;
    const root = document.documentElement;
    let done = false;
    const finish = () => {
        if (done) return;
        done = true;
        window.removeEventListener('afterprint', finish);
        document.title = prevTitle;
        root.style.removeProperty(PRINT_FONT_VAR);
        unmount();
    };
    // The page-number margin box only inherits from <html>; hand it the Sarabun family that body has.
    const font = getComputedStyle(document.body).getPropertyValue('--font-sarabun').trim();
    if (font !== '') root.style.setProperty(PRINT_FONT_VAR, font);
    flushSync(mount);
    document.title = title;
    window.addEventListener('afterprint', finish);
    window.print();
    // Browsers whose print() returns before the dialog closes fire afterprint later; the others are done now.
    if (!('onafterprint' in window)) finish();
}
