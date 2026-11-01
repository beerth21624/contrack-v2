// Test helper: renders a component under the Thai messages (the components read their texts with next-intl).
import type { ReactElement } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import th from '@/i18n/messages/th';

export const withIntl = (el: ReactElement): ReactElement => (
    <NextIntlClientProvider locale="th" messages={th} timeZone="Asia/Bangkok">{el}</NextIntlClientProvider>
);
