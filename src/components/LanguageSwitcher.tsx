'use client';

import React from 'react';
import { Button, Tooltip } from 'antd';
import { GlobalOutlined } from '@ant-design/icons';
import { useAppLocale } from '@/i18n/LocaleProvider';

export const LanguageSwitcher: React.FC = () => {
  const { locale, setLocale } = useAppLocale();

  const toggle = () => {
    setLocale(locale === 'th' ? 'en' : 'th');
  };

  return (
    <Tooltip title={locale === 'th' ? 'Switch to English' : 'เปลี่ยนเป็นภาษาไทย'}>
      <Button
        type="text"
        size="small"
        icon={<GlobalOutlined style={{ fontSize: 16, color: 'rgba(255,255,255,.75)' }} />}
        onClick={toggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          color: 'rgba(255,255,255,.85)',
          fontWeight: 600,
          fontSize: 13,
          border: '1px solid rgba(255,255,255,.15)',
          // A pill like the project badge and the account button next to it.
          borderRadius: 999,
          padding: '2px 10px',
          height: 32,
          background: 'rgba(255,255,255,.06)',
          transition: 'all .2s',
        }}
      >
        {locale === 'th' ? 'EN' : 'TH'}
      </Button>
    </Tooltip>
  );
};
