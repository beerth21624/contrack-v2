import { WORKSPACE_NAME_MAX_LENGTH, WorkspaceName } from './workspace-name.value-object';

describe('WorkspaceName', () => {
    it('trims the name', () => {
        const name = WorkspaceName.create('  Acme  ');
        expect(name.ok && name.value.value).toBe('Acme');
    });

    it('accepts exactly the maximum length', () => {
        expect(WorkspaceName.create('x'.repeat(WORKSPACE_NAME_MAX_LENGTH)).ok).toBe(true);
    });

    it.each(['', '   ', '\n\t'])('rejects an empty name (%j)', raw => {
        const name = WorkspaceName.create(raw);
        expect(name.ok).toBe(false);
        if (!name.ok) expect(name.error.code).toBe('validation_failed');
    });

    it('rejects a name longer than the maximum', () => {
        const name = WorkspaceName.create('x'.repeat(WORKSPACE_NAME_MAX_LENGTH + 1));
        expect(!name.ok && name.error.code).toBe('validation_failed');
    });

    it('accepts Thai text', () => {
        const name = WorkspaceName.create('บริษัท ก่อสร้าง (ส่วนตัว)');
        expect(name.ok && name.value.value).toBe('บริษัท ก่อสร้าง (ส่วนตัว)');
    });

    it('compares by value', () => {
        expect(WorkspaceName.rehydrate('A').equals(WorkspaceName.rehydrate('A'))).toBe(true);
        expect(WorkspaceName.rehydrate('A').equals(WorkspaceName.rehydrate('B'))).toBe(false);
    });
});
