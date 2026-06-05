export type DownloadUrlResult = {
  download_url?: string | null
  format?: string | null
  voucher?: { key?: string | null; iv?: string | null } | null
}

export type DownloadPreparation = {
  downloadUrl: string
  audibleFormat: 'aax' | 'aaxc'
  audibleVoucher: { key: string; iv: string } | null
  requiresActivationBytes: boolean
}

export function buildDownloadPreparation({ downloadUrlObj }: { downloadUrlObj: DownloadUrlResult }): DownloadPreparation {
  const downloadUrl = downloadUrlObj.download_url
  if (!downloadUrl) throw new Error('Failed to retrieve download URL from Audible.')

  const audibleFormat = downloadUrlObj.format === 'aaxc' ? 'aaxc' : 'aax'
  const audibleVoucher = downloadUrlObj.voucher
    ? {
        key: String(downloadUrlObj.voucher.key),
        iv: String(downloadUrlObj.voucher.iv),
      }
    : null

  return {
    downloadUrl,
    audibleFormat,
    audibleVoucher,
    requiresActivationBytes: audibleFormat === 'aax',
  }
}
