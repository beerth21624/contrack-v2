import { type NextRequest, NextResponse } from 'next/server';
import puppeteer, { type PDFOptions } from 'puppeteer';

export async function POST(request: NextRequest) {
    let browser;
    try {
        const payload = (await request.json()) as unknown;

        browser = await puppeteer.launch({
            headless: true,
            executablePath:
                process.platform === 'win32'
                    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
                    : process.platform === 'linux'
                        ? '/usr/bin/chromium-browser'
                        : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            args: [
                '--no-sandbox',
                '--headless',
                '--disable-gpu',
                '--disable-dev-shm-usage',
            ],
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1400, height: 0 });

        const baseUrl = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';

        // Navigate to the PDF page first
        await page.goto(`${baseUrl}/pdf/schedule`, {
            waitUntil: 'networkidle2',
            timeout: 30000,
        });

        // Inject the schedule data into localStorage, then reload
        await page.evaluate((data: string) => {
            localStorage.setItem('schedule-pdf-data', data);
        }, JSON.stringify(payload));

        // Reload so the page picks up the data
        await page.reload({ waitUntil: 'networkidle2' });

        // Wait a moment for React to render
        await new Promise(resolve => setTimeout(resolve, 1000));

        const pdfOption: PDFOptions = {
            printBackground: true,
            format: 'A4',
            landscape: true,
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
                'Content-Disposition': 'inline; filename="Schedule-Timeline.pdf"',
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
