import { t } from '../i18n';
export const formatDate = (value?: string) =>
  value
    ? new Date(value).toLocaleString(t('pl-PL'), {
        timeZone: 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';
