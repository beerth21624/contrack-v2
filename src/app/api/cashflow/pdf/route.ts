import { type NextRequest, NextResponse } from 'next/server';
import puppeteer, { type PDFOptions } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

export const maxDuration = 60; // Increase max duration for Vercel

export async function POST(request: NextRequest) {
    let browser;
    try {
        const quotationData = (await request.json()) as unknown;

        const isLocal = !process.env.VERCEL_URL;

        browser = await puppeteer.launch({
            args: isLocal ? puppeteer.defaultArgs() : chromium.args,
            executablePath: isLocal 
                ? (process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
                : await chromium.executablePath(),
            headless: true,
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1000, height: 0 });

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

        // Navigate to the quotation PDF page first
        await page.goto(`${baseUrl}/pdf/quotation`, {
            waitUntil: 'networkidle2',
            timeout: 30000,
        });

        // Inject the quotation data into localStorage, then reload
        await page.evaluate((data: string) => {
            localStorage.setItem('quotation-pdf-data', data);
        }, JSON.stringify(quotationData));

        // Reload so the page picks up the data
        await page.reload({ waitUntil: 'networkidle2' });

        // Wait a moment for React to render
        await new Promise(resolve => setTimeout(resolve, 1000));

        const pdfOption: PDFOptions = {
            printBackground: true,
            format: 'A4',
            landscape: false,
            margin: {
                top: '10mm',
                bottom: '10mm',
                left: '12mm',
                right: '12mm',
            },
        };

        const pdf = await page.pdf(pdfOption);
        const buffer = Buffer.from(pdf);

        await page.close();
        await browser.close();

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Disposition': 'inline; filename="Quotation-CashFlow.pdf"',
                'Content-Type': 'application/pdf',
                'Content-Length': buffer.length.toString(),
            },
        });
    } catch (error) {
        if (browser) {
            await browser.close();
        }
        const errorMessage = error instanceof Error ? error.message : 'Failed to generate PDF';
        console.error('Quotation PDF generation error:', errorMessage);
        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}
