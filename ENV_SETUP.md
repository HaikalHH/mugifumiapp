# Environment Variables Setup

## Environment Variables yang Perlu Ditambahkan

Tambahkan environment variables berikut ke file `.env` atau `.env.local`:

```bash
# Ultramsg Configuration (sudah ada)
ULTRAMSG_INSTANCE_ID=instance146361
ULTRAMSG_TOKEN=0dphdxuuhgdfhtja

# Ultramsg Phone Numbers for Reports (sudah ada)
ULTRAMSG_PHONES=+6281275167471,+6281378471123,+6281276167733,+6281261122306

# Ultramsg Phone Numbers for Order Notifications (BARU - tambahkan ini)
ULTRAMSG_ORDER_PHONE_JAKARTA=+628986723926
ULTRAMSG_ORDER_PHONE_BANDUNG=+6281276167733

# Cron Job Secret (sudah ada)
CRON_SECRET=mugifumi_cron_2025_s3cr3t_k3y_xYz123

```

## Penjelasan Environment Variables

### Yang Sudah Ada:
- `ULTRAMSG_INSTANCE_ID`: Instance ID untuk Ultramsg API
- `ULTRAMSG_TOKEN`: Token untuk Ultramsg API
- `ULTRAMSG_PHONES`: Nomor WhatsApp untuk menerima report (comma-separated)
- `CRON_SECRET`: Secret key untuk cron job

### Yang Baru Ditambahkan:
- `ULTRAMSG_ORDER_PHONE_JAKARTA`: Nomor WhatsApp untuk notifikasi order Jakarta
- `ULTRAMSG_ORDER_PHONE_BANDUNG`: Nomor WhatsApp untuk notifikasi order Bandung

## Cara Kerja:

1. **Report Notifications**: Dikirim ke semua nomor di `ULTRAMSG_PHONES`
2. **Order Notifications**: Dikirim ke nomor yang sesuai dengan region:
   - Order Jakarta → `ULTRAMSG_ORDER_PHONE_JAKARTA`
   - Order Bandung → `ULTRAMSG_ORDER_PHONE_BANDUNG`

## Fallback Values:

Jika environment variables tidak diset, sistem akan menggunakan default values:
- Jakarta: `+628986723926`
- Bandung: `+6281276167733`

## Setup di Vercel/Production:

Tambahkan environment variables di dashboard Vercel atau platform hosting lainnya dengan nilai yang sama.
