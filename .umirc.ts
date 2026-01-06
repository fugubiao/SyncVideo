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
      target: 'http://localhost:5000/api/', //http://localhost:5000/api
      changeOrigin: true,
      pathRewrite: { '^/api/': '' },
    },

    '/ws': {
      target: 'ws://localhost:5000', // ← 只写到端口  ws://localhost:5000
      ws: true, // ← 允许升级
      changeOrigin: true,
      secure: false,
      // 关键：把浏览器发来的 upgrade 头原封不动带过去
      headers: {
        connection: 'upgrade',
        upgrade: 'websocket',
      },
    },
  },
  routes: [
    {
      path: '/',
      redirect: '/syncVideo',
    },
    {
      name: '房间大厅',
      path: '/RoomPage',
      component: './RoomPage',
      icon: 'Home',
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
    // memo.plugin('terser-webpack-plugin').use(TerserPlugin, [
    //   {
    //     terserOptions: {
    //       output: {
    //         comments: false, //去除注释
    //       },
    //       warnings: false, //去除黄色警告
    //       compress: {
    //         drop_console: true,
    //         drop_debugger: true,
    //         pure_funcs: ['console.log'], //移除console.log 避免console.error
    //       },
    //     },
    //   },
    // ]);
  },
});
