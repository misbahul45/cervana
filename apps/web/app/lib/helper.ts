export function toRupiah(value: number | string | null | undefined): string {
  if (value == null || isNaN(Number(value))) return 'Rp 0'

  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
    .format(Number(value))
    .replace(',00', '') 
}



