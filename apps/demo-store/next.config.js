import { withWebMCP } from '@webmcp1/next/plugin';

export default withWebMCP({
  name: 'WebMCP Demo Store',
  description: 'AI-ready e-commerce store powered by WebMCP',
  endpoint: '/api/mcp',
})({
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
});
