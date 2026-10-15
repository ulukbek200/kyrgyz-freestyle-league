import {fileURLToPath} from 'node:url';
import {defineConfig,loadEnv} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({command,mode})=>{
 if(command==='build'){
  const value=process.env.VITE_API_URL||loadEnv(mode,fileURLToPath(new URL('.',import.meta.url)),'VITE_').VITE_API_URL;
  let url:URL;try{url=new URL(value);}catch{throw new Error('Production build requires VITE_API_URL as an absolute HTTPS API URL');}
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||/^(localhost|127\.|0\.|\[?::1\]?)/i.test(url.hostname)||url.hostname.endsWith('.localhost')||!url.pathname.endsWith('/api'))throw new Error('VITE_API_URL must be a public HTTPS URL ending in /api, without credentials');
 }
 return {root:fileURLToPath(new URL('.',import.meta.url)),plugins:[react()],server:{port:5173,strictPort:true},build:{rollupOptions:{output:{manualChunks(id){if(!id.includes('node_modules'))return;if(id.includes('antd')||id.includes('@ant-design')||id.includes('@rc-component'))return 'design-system';if(id.includes('react')||id.includes('scheduler'))return 'react-vendor';if(id.includes('lucide-react'))return 'icons';if(id.includes('i18next'))return 'i18n'}}}}};});
