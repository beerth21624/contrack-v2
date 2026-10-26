import {
    Body, type CallHandler, Controller, type ExecutionContext, Get, HttpCode, HttpStatus, Injectable, type NestInterceptor,
    Param, PayloadTooLargeException, Post, Query, Res, StreamableFile, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { type Observable, catchError, throwError } from 'rxjs';
import { z } from 'zod';
import { type FileDto, MAX_FILE_BYTES, filePurposeSchema } from '@contrack/contract';
import type { AuthenticatedUser } from '../../../shared/application/ports';
import { DomainError } from '../../../shared/domain/domain-error';
import { CurrentUser, Public } from '../../../shared/presentation/auth';
import { DomainHttpException, ZodPipe, unwrap } from '../../../shared/presentation/http';
import { ReadFileContentUseCase } from '../application/use-cases/read-file-content.use-case';
import { UploadFileUseCase } from '../application/use-cases/upload-file.use-case';

/** The part multer (memory storage) hands over for field `file`. */
interface UploadedPart {
    originalname: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
}

const uploadFormSchema = z.object({ purpose: filePurposeSchema });
type UploadForm = z.infer<typeof uploadFormSchema>;

/** multer stops at MAX_FILE_BYTES with 413; the contract answers every refused file with 422 unprocessable. */
@Injectable()
class UploadErrorsInterceptor implements NestInterceptor {
    intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
        return next.handle().pipe(catchError((error: unknown) => throwError(() => (error instanceof PayloadTooLargeException
            ? new DomainHttpException(DomainError.unprocessable('The file is too large', { maxBytes: MAX_FILE_BYTES }))
            : error))));
    }
}

/** RFC 5987 file name for Content-Disposition (Thai names survive). */
function contentDisposition(name: string): string {
    const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
    return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

@Controller('files')
export class FilesController {
    constructor(private readonly upload: UploadFileUseCase, private readonly content: ReadFileContentUseCase) {}

    /** multipart/form-data: `file` + `purpose`. */
    @Post()
    @HttpCode(HttpStatus.CREATED)
    @UseInterceptors(UploadErrorsInterceptor, FileInterceptor('file', {
        limits: { fileSize: MAX_FILE_BYTES, files: 1, fields: 10 },
        defParamCharset: 'utf8',
    }))
    async create(
        @CurrentUser() user: AuthenticatedUser,
        @UploadedFile() file: UploadedPart | undefined,
        @Body(new ZodPipe(uploadFormSchema)) form: UploadForm,
    ): Promise<FileDto> {
        if (file === undefined) throw new DomainHttpException(DomainError.validation('Attach the file in field "file"'));
        return unwrap(await this.upload.execute({
            actorId: user.userId,
            purpose: form.purpose,
            name: file.originalname,
            contentType: file.mimetype,
            bytes: file.buffer,
        }));
    }

    /** The bytes behind a signed link (no bearer token: used in <img src> / <a href>). */
    @Public()
    @Get(':id/content')
    async read(
        @Param('id') id: string,
        @Query('exp') exp: string | undefined,
        @Query('sig') sig: string | undefined,
        @Res({ passthrough: true }) res: Response,
    ): Promise<StreamableFile> {
        const found = unwrap(await this.content.execute({
            fileId: id,
            exp: typeof exp === 'string' ? exp : undefined,
            sig: typeof sig === 'string' ? sig : undefined,
        }));
        res.setHeader('Cache-Control', `private, max-age=${found.maxAgeSeconds}`);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        return new StreamableFile(found.bytes, {
            type: found.file.contentType,
            disposition: contentDisposition(found.file.name),
            length: found.bytes.byteLength,
        });
    }
}
