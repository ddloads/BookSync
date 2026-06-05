import { describe, expect, it } from 'vitest'
import { buildDownloadPreparation } from '../downloadPreparation'

describe('buildDownloadPreparation', () => {
  it('skips activation bytes for AAXC downloads that already have a voucher', () => {
    const plan = buildDownloadPreparation({
      downloadUrlObj: {
        download_url: 'https://example.test/book.aaxc',
        format: 'aaxc',
        voucher: { key: 'deadbeef', iv: 'cafebabe' },
      },
    })

    expect(plan).toEqual({
      downloadUrl: 'https://example.test/book.aaxc',
      audibleFormat: 'aaxc',
      audibleVoucher: { key: 'deadbeef', iv: 'cafebabe' },
      requiresActivationBytes: false,
    })
  })

  it('requires activation bytes for classic AAX downloads', () => {
    const plan = buildDownloadPreparation({
      downloadUrlObj: {
        download_url: 'https://example.test/book.aax',
        format: 'aax',
        voucher: null,
      },
    })

    expect(plan).toEqual({
      downloadUrl: 'https://example.test/book.aax',
      audibleFormat: 'aax',
      audibleVoucher: null,
      requiresActivationBytes: true,
    })
  })
})
