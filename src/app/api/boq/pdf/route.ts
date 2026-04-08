import { type NextRequest, NextResponse } from 'next/server';
import puppeteer, { type PDFOptions } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

export const maxDuration = 60; // Increase max duration for Vercel

export async function POST(request: NextRequest) {
    let browser;
    try {
        // Get BOQ data from the request body
        const boqData = (await request.json()) as unknown;

        const isLocal = !process.env.VERCEL_URL;

        browser = await puppeteer.launch({
            args: isLocal ? puppeteer.defaultArgs() : chromium.args,
            executablePath: isLocal 
                ? (process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
                : await chromium.executablePath(),
            headless: true,
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1400, height: 0 });

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

        // Navigate to the PDF page first
        await page.goto(`${baseUrl}/pdf/boq`, {
            waitUntil: 'networkidle2',
            timeout: 30000,
        });

        // Inject the BOQ data into localStorage, then reload
        await page.evaluate((data: string) => {
            localStorage.setItem('boq-pdf-data', data);
        }, JSON.stringify(boqData));

        // Reload so the page picks up the data
        await page.reload({ waitUntil: 'networkidle2' });

        // Wait a moment for React to render
        await new Promise(resolve => setTimeout(resolve, 1000));

        const pdfOption: PDFOptions = {
            printBackground: true,
            format: 'A4',
            landscape: true,
            margin: {
                top: '8mm',
                bottom: '8mm',
                left: '10mm',
                right: '10mm',
            },
        };

        const pdf = await page.pdf(pdfOption);
        const buffer = Buffer.from(pdf);

        await page.close();
        await browser.close();

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Disposition': 'inline; filename="BOQ-Summary.pdf"',
                'Content-Type': 'application/pdf',
                'Content-Length': buffer.length.toString(),
            },
        });
    } catch (error) {
        if (browser) {
            await browser.close();
        }
        const message = error instanceof Error ? error.message : 'Failed to generate PDF';
        console.error('PDF generation error:', message);
        return NextResponse.json(
            { error: message },
            { status: 500 }
        );
    }
}
