/** @type {import('next').NextConfig} */
const nextConfig = {
  // Halaman /juventus sudah dihapus; tautan lama diarahkan ke halaman penggantinya.
  async redirects() {
    return [
      { source: '/juventus', has: [{ type: 'query', key: 'tab', value: 'skuad' }], destination: '/skuad', permanent: false },
      { source: '/juventus', has: [{ type: 'query', key: 'tab', value: 'statistik' }], destination: '/statistik', permanent: false },
      { source: '/juventus', destination: '/', permanent: false },
    ];
  },
};

export default nextConfig;
