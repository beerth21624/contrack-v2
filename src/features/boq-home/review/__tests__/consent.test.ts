import { describe, expect, it } from 'vitest';
import { CONSENT_TEXT, reviewClickAction, type AiReviewGate } from '../consent';

const ready: AiReviewGate = { signedIn: true, moduleEnabled: true, workspaceId: 'ws-1', rowCount: 212 };

describe('reviewClickAction', () => {
    it('asks for consent only when the model could actually be used', () => {
        expect(reviewClickAction(ready)).toBe('ask');
    });

    it('opens the rules-only review without asking when the model cannot be used', () => {
        expect(reviewClickAction({ ...ready, signedIn: false })).toBe('rules');
        expect(reviewClickAction({ ...ready, moduleEnabled: false })).toBe('rules');
        expect(reviewClickAction({ ...ready, workspaceId: undefined })).toBe('rules');
        expect(reviewClickAction({ ...ready, rowCount: 0 })).toBe('rules');
    });
});

describe('CONSENT_TEXT', () => {
    it('tells the user what is sent, that nothing is changed, that it costs, and that it only runs on confirm', () => {
        expect(CONSENT_TEXT.sends).toContain('ไม่ส่งชื่อเจ้าของบ้าน');
        expect(CONSENT_TEXT.hints).toContain('ไม่แก้ตัวเลขใด');
        expect(CONSENT_TEXT.cost).toContain('ค่าใช้จ่าย');
        expect(CONSENT_TEXT.cost).toContain('ไม่ทำงานเองเมื่อแก้ข้อมูล');
    });
});
