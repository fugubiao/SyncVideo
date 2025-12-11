import { defineConfig } from '@umijs/max';

const TerserPlugin = require('terser-webpack-plugin');
export default defineConfig({
  antd: {},
  access: {},
  model: {},
  initialState: {},
  request: {},
  layout: {
    title: '@umijs/max',
  },
  proxy: {
    '/api/': {
      target: '	http://localhost:55061', //http://frp-sea.com:58532
      changeOrigin: true,
      pathRewrite: { '^/api': '' },
    },

    '/ws': {
      target: 'ws://localhost:55061', // 1. 目标只写域名，不要带 /ws
      ws: true,
      changeOrigin: true,
      secure: false, // 2. 允许自签名或隧道证书
      // 3. 不写 pathRewrite，这样前端请求 /ws，代理就原样转发 /ws 给后端
    },
  },
  routes: [
    {
      path: '/',
      redirect: '/syncVideo',
    },
    {
      name: '播放列表',
      path: '/playlist',
      component: './PlayList',
      icon: 'PlayCircle',
    },
    {
      name: '一起看剧',
      path: '/syncVideo',
      component: './SyncVideo',
      icon: 'Camera',
    },
  ],
  npmClient: 'yarn',
  chainWebpack(memo, args) {
    memo.plugin('terser-webpack-plugin').use(TerserPlugin, [
      {
        terserOptions: {
          output: {
            comments: false, //去除注释
          },
          warnings: false, //去除黄色警告
          compress: {
            drop_console: true,
            drop_debugger: true,
            pure_funcs: ['console.log'], //移除console.log 避免console.error
          },
        },
      },
    ]);
  },
});
