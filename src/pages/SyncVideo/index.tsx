import { PageContainer } from '@ant-design/pro-components';
import { Button, Card, Form, Input, message, Switch } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Player } from 'video-react'; // 注意类型引用
import 'video-react/dist/video-react.css';
import UrlList from '../PlayList/urlList';

// 定义消息类型，方便维护
type WsMessage = {
  cmd:
    | 'join'
    | 'play'
    | 'pause'
    | 'seek'
    | 'change_video'
    | 'ready'
    | 'unready'
    | 'queue'
    | 'joined'
    | 'user_leave'
    | 'ready_count';
  room_id?: string;
  pwd?: string;
  ts?: number;
  list?: any[];
  count?: number;
  total?: number;
  error?: string;
  video?: any;
};

const SyncVideoPage: React.FC = () => {
  // 状态管理
  const [url, setUrl] = useState<string>();
  const [roomId, setRoomId] = useState<string>('');
  const [pwd, setPwd] = useState<string>('');
  const [identity, setIdentity] = useState<boolean>(true); // true 房主 false 房客
  const identityRef = useRef(identity);
  useEffect(() => {
    identityRef.current = identity;
  }, [identity]);
  const [isConnected, setIsConnected] = useState(false); // 连接状态
  const [isReady, setIsReady] = useState(false); // 自己的准备状态
  const [isAllReady, setIsAllReady] = useState(false); // 【新增】标记是否全员准备就绪
  // 用于通知子组件表格刷新
  const [refreshQueueTrigger, setRefreshQueueTrigger] = useState(0);
  // Refs
  // Player 的类型根据 video-react 文档，通常是 Component 或者有特定的 Ref 类型
  // 这里假设 video-react 的 Player 暴露了 internalPlayer 或者类似的 video 元素访问方式
  // 如果 video-react 的 ref 不好用，原生 <video> 也是完全可以的
  const playerRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // true 代表正在处理服务器传来的同步指令，此时不要触发发送
  const isRemoteUpdate = useRef(false); //同步锁
  //缓冲状态锁：视频是否是因为缓冲而暂停
  const isBuffering = useRef(false);
  // 初始化加载本地存储
  useEffect(() => {
    const cachedPwd = localStorage.getItem('roomPwd');
    const cachedRoomId = localStorage.getItem('roomId');
    if (cachedPwd) setPwd(cachedPwd);
    if (cachedRoomId) setRoomId(cachedRoomId);
  }, []);

  // 监听播放器的原生事件
  // 这样无论是点自带按钮，还是拖进度条，都能同步
  useEffect(() => {
    // video-react 的底层 HTMLVideoElement 对象
    const videoEl = playerRef.current?.video?.video as HTMLVideoElement;

    if (!videoEl || !isConnected) return;

    /**
     * 处理暂停
     * 事件来源：
     * 1. 用户点击暂停按钮
     * 2. 远程指令(缓冲开始)触发的 pause（不应发送广播）
     * @returns
     */
    const handlePause = () => {
      console.log('来自远程的暂停', isRemoteUpdate.current);
      if (isRemoteUpdate.current) return;
      console.log('当前的缓冲状态', isBuffering.current);
      //当前是缓冲状态，则handlewaiting已经广播pause了，直接跳过。
      if (isBuffering.current) return;

      wsRef.current?.send(
        JSON.stringify({ cmd: 'pause', ts: videoEl.currentTime }),
      );
    };

    /**
     * 进度条拖动完成事件处理
     * 事件来源：
     * 1. 用户拖动进度条完成
     * 2. 远程指令触发的 seek（不应发送广播）
     * @returns
     */
    const handleSeeked = () => {
      if (isRemoteUpdate.current) {
        // 这是一个由服务器命令触发的 seek，重置锁，不发送消息
        isRemoteUpdate.current = false;
        return;
      }

      isBuffering.current = false; // （seeked时）缓冲已经完成

      wsRef.current?.send(
        JSON.stringify({ cmd: 'seek', ts: videoEl.currentTime }),
      );
    };

    /**
     * 缓冲事件处理
     * 事件来源：
     * 1. 网络状况不佳，视频数据不足以继续播放
     * 2. 用户跳转到未缓冲的时间点
     * @returns
     */
    const handleWaiting = () => {
      console.log(
        `处于缓冲,isRemoteUpdate:${isRemoteUpdate.current},isBuffering:${isBuffering.current}`,
      );
      if (isRemoteUpdate.current) return;

      // 标记为缓冲状态
      isBuffering.current = true;

      // 发送暂停指令
      wsRef.current?.send(
        JSON.stringify({ cmd: 'pause', ts: videoEl.currentTime }),
      );
    };

    /**
     * 处理播放
     * 事件来源：
     * 1. 用户点击播放按钮
     * 2. 缓冲结束后自动播放
     * 3. 远程指令触发的播放（不应发送广播）：缓冲完成后已经广播一次paly，这里会再广播paly导致循环触发
     *  */
    const handlePlaying = () => {
      console.log('来自远程的播放', isRemoteUpdate.current);
      //拦截远程指令触发的 playing 事件
      if (isRemoteUpdate.current) return;

      // 缓冲结束
      if (isBuffering.current) {
        isBuffering.current = false; // 【清除标记】
      }
      //广播播放
      wsRef.current?.send(
        JSON.stringify({ cmd: 'play', ts: videoEl.currentTime }),
      );
    };

    // 绑定事件
    videoEl.addEventListener('pause', handlePause);
    videoEl.addEventListener('seeked', handleSeeked);
    videoEl.addEventListener('waiting', handleWaiting);
    videoEl.addEventListener('playing', handlePlaying);

    return () => {
      // 清理事件
      videoEl.removeEventListener('pause', handlePause);
      videoEl.removeEventListener('seeked', handleSeeked);
      videoEl.removeEventListener('waiting', handleWaiting);
      videoEl.removeEventListener('playing', handlePlaying);
    };
  }, [isConnected, url]); // 当连接状态或视频源改变时重新绑定

  // 【新增】发送切换视频指令
  const handleSwitchVideo = useCallback(
    (videoItem: any) => {
      if (wsRef.current && isConnected) {
        wsRef.current.send(
          JSON.stringify({
            cmd: 'change_video',
            video: videoItem,
          }),
        );
        message.loading('正在同步切换视频...', 1);
      } else {
        // 如果没连接，就只能本地切一下（降级处理）
        const targetUrl = identity ? videoItem.masterUrl : videoItem.guestUrl;
        setUrl(targetUrl);
      }
    },
    [isConnected, identity],
  ); // 依赖 identity

  // 核心：WebSocket 连接与消息处理
  const connectWs = useCallback(() => {
    if (!roomId) {
      message.error('请输入房间号');
      return;
    }

    // 避免重复连接
    if (wsRef.current) {
      wsRef.current.close();
    }

    // const wsUrl = `ws://${window.location.hostname}:55061/ws`; // 建议根据环境配置
    // 这里的 /ws/ 可能被 umi 代理，如果直连后端端口需写全
    // const ws = new WebSocket('/ws/');
    const ws = new WebSocket('/ws');

    ws.onopen = () => {
      console.log('WebSocket 连接已打开');
      setIsConnected(true);
      // 连接成功后立即发送加入房间指令
      ws.send(JSON.stringify({ cmd: 'join', room_id: roomId, pwd: pwd }));

      // 缓存到本地
      localStorage.setItem('roomPwd', pwd);
      localStorage.setItem('roomId', roomId);
    };

    ws.onclose = () => {
      console.log('连接已关闭');
      setIsConnected(false);
      setIsReady(false);
      wsRef.current = null;
    };

    ws.onerror = (error) => {
      console.error('WebSocket 发生错误:', error);
      message.error('连接服务器失败');
    };

    ws.onmessage = async (ev) => {
      const msg: WsMessage = JSON.parse(ev.data);
      console.log('收到消息:', msg);

      // 获取 video 元素 (video-react 的封装)
      // video-react 的 ref.current.video 是实际的 HTMLVideoElement
      const videoEl = playerRef.current?.video?.video as HTMLVideoElement;

      if (msg.error) {
        message.error(msg.error);
        return;
      }

      switch (msg.cmd) {
        case 'joined':
          message.success(`成功加入房间: ${msg.room_id}`);
          break;
        case 'play':
          if (videoEl && msg.ts !== undefined) {
            isRemoteUpdate.current = true; //加锁
            // // 允许 0.3 秒的误差，避免频繁 seek 导致卡顿
            // if (Math.abs(videoEl.currentTime - msg.ts) > 0.5) {
            //     videoEl.currentTime = msg.ts;
            // }
            // 时间误差修正
            console.log('时间误差：', videoEl.currentTime - msg.ts);
            if (
              msg.ts !== undefined &&
              Math.abs(videoEl.currentTime - msg.ts) > 0.3
            ) {
              videoEl.currentTime = msg.ts;
            }
            await videoEl
              .play()
              .catch((e) => console.log('自动播放被拦截:', e));

            // 稍微延时解锁，因为 play() 是异步的，可能稍后才触发事件
            setTimeout(() => {
              isRemoteUpdate.current = false;
            }, 500);
          }
          break;
        case 'pause':
          if (videoEl) {
            console.log(`是否暂停:${isBuffering.current}`);
            if (isBuffering.current) return;

            isRemoteUpdate.current = true;

            videoEl.pause();

            // if (msg.ts !== undefined) videoEl.currentTime = msg.ts;
            if (msg.ts !== undefined) videoEl.currentTime = msg.ts;
            // 暂停的事件触发很快，可以不需要太长的延时，但为了保险依然可以在事件回调里解
          }
          // 如果是因为有人取消准备导致的暂停，给个提示
          if (!isAllReady) {
            // 这里逻辑稍微有点绕，因为pause可能是手动点的，也可能是服务器强制的
            // 可以简单提示一下
            message.info(`播放已暂停，请确认不是“未准备”导致的`);
          }
          break;
        case 'seek':
          if (videoEl && msg.ts !== undefined) {
            console.log('收到远程 Seek 指令:', msg.ts);
            // 【关键修改 4】加锁！告诉 handleSeeked 这是服务器让改的
            isRemoteUpdate.current = true;
            videoEl.currentTime = msg.ts;
            // 锁会在 handleSeeked 事件触发时被消费并重置
          }
          break;
        case 'queue':
          // 【新增】收到后端最新的队列（包含最新的 isPlaying 状态）
          // 触发 UrlList 刷新
          setRefreshQueueTrigger((prev) => prev + 1);
          break;
        case 'ready_count':
          // 如果 msg.count === 0，说明服务器重置了，可以用来校验本地状态
          if (msg.count === msg.total && msg.total && msg.total > 0) {
            message.success('全员就绪，准备播放！');
            setIsAllReady(true);
          } else {
            setIsAllReady(false);
            message.info(`当前准备人数: ${msg.count}/${msg.total}`);
          }
          break;
        case 'user_leave':
          message.info('有用户离开了房间');
          break;
        // 【新增】处理切换视频指令
        case 'change_video':
          if (msg.video) {
            // const targetUrl = identity ? msg.video.masterUrl : msg.video.guestUrl;
            const targetUrl = identityRef.current
              ? msg.video.masterUrl
              : msg.video.guestUrl;
            console.log('收到切片指令:', msg.video.title, targetUrl);

            // 1. 切换 URL
            setUrl(targetUrl);

            // 2. 所有人强制取消“准备”状态，防止有人误操作直接播放
            setIsReady(false);

            // 3. 提示
            message.info(`当前视频已切换为: ${msg.video.title}`);

            // 4. 重置播放器时间 (可选，因为换源后通常也是从0开始)
            if (videoEl) videoEl.currentTime = 0;
          }
          setIsAllReady(false); // 切视频必定导致未准备
          break;
      }
    };

    wsRef.current = ws;
  }, [roomId, pwd, message, identity]);

  // 组件卸载时断开连接
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // 准备/取消准备
  const toggleReady = useCallback(
    (checked: boolean) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({ cmd: checked ? 'ready' : 'unready' }),
        );
        setIsReady(checked);
      } else {
        message.warning('请先加入房间');
      }
    },
    [message],
  );

  // 播放控制 - 发送端
  const handleSendControl = useCallback((type: 'play' | 'pause') => {
    const videoEl = playerRef.current?.video?.video as HTMLVideoElement;
    if (videoEl && wsRef.current) {
      wsRef.current.send(
        JSON.stringify({
          cmd: type,
          ts: videoEl.currentTime,
        }),
      );
    }
  }, []);

  return (
    <PageContainer>
      <Card title="加入房间" style={{ marginBottom: 16 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '25% 75%',
            gap: '20px',
          }}
        >
          <Form layout="vertical">
            <Form.Item label="房间号">
              <Input
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                disabled={isConnected}
              />
            </Form.Item>
            <Form.Item label="密码">
              <Input.Password
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                disabled={isConnected}
              />
            </Form.Item>
            <Form.Item label="身份">
              <Switch
                checkedChildren="房主"
                unCheckedChildren="房客"
                checked={identity}
                onChange={setIdentity}
              />
              <span style={{ marginLeft: 8, fontSize: 12, color: '#999' }}>
                (决定使用哪个视频源)
              </span>
            </Form.Item>
            <Form.Item>
              {!isConnected ? (
                <Button type="primary" onClick={connectWs} block>
                  加入房间
                </Button>
              ) : (
                <Button danger onClick={() => wsRef.current?.close()} block>
                  退出房间
                </Button>
              )}
            </Form.Item>
          </Form>

          <div style={{ maxHeight: '400px', overflow: 'auto' }}>
            {isConnected && roomId ? (
              <UrlList
                roomId={roomId}
                refreshTrigger={refreshQueueTrigger}
                onPlayer={(video) => {
                  handleSwitchVideo(video);
                }}
              />
            ) : (
              <div
                style={{ textAlign: 'center', marginTop: 50, color: '#ccc' }}
              >
                请先加入房间以加载播放列表
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card title="同步播放器">
        <div style={{ position: 'relative' }}>
          {/* 【新增】权限控制遮罩层 */}
          {/* 只有连接了ws，且没有全员准备好，才显示遮罩禁止操作 */}
          {isConnected && !isAllReady && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 10,
                background: 'rgba(0,0,0,0.5)', // 半透明黑色
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '18px',
                cursor: 'not-allowed',
                backdropFilter: 'blur(2px)',
              }}
            >
              <div>
                <p style={{ marginBottom: 8 }}>等待全员准备...</p>
                <Switch
                  checkedChildren="我已准备"
                  unCheckedChildren="点击准备"
                  checked={isReady}
                  onChange={toggleReady}
                  // 遮罩层内部允许点击这个开关（通过pointer-events处理或者层级处理）
                  // 但简单的做法是把开关放到遮罩外面，或者把遮罩只盖在 video 上
                />
              </div>
            </div>
          )}

          <Player ref={playerRef} key={url}>
            <source src={url} />
          </Player>
        </div>

        <div
          style={{
            marginTop: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          {/* 把准备开关放在外面，保证随时可点 */}
          <Switch
            checkedChildren="已准备"
            unCheckedChildren="未准备"
            checked={isReady}
            onChange={toggleReady}
            disabled={!isConnected}
          />
          {/* 只有全员准备好了，才允许点击这些按钮（或者你也可以依赖遮罩层挡住） */}
          <Button
            onClick={() => handleSendControl('play')}
            disabled={!isConnected || !isAllReady}
          >
            同步播放
          </Button>
          <Button
            onClick={() => handleSendControl('pause')}
            disabled={!isConnected}
          >
            同步暂停
          </Button>
        </div>
      </Card>
    </PageContainer>
  );
};

export default SyncVideoPage;
