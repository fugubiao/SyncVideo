import RoomService from '@/services/Room';
import { PageContainer } from '@ant-design/pro-components';
import { Button, Card, Form, Input, message, Switch } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Player, PlayerReference } from 'video-react'; // 注意类型引用
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
    | 'error'
    | 'ready_count';
  Room_name?: string;
  pwd?: string;
  ts?: number;
  list?: any[];
  Count?: number;
  Total?: number;
  error?: string;
  is_buffering?: boolean; // 标记该暂停是否由缓冲引发
  Video?: playItem;
  message?: string;
};

const SyncVideoPage: React.FC = () => {
  // 状态管理
  const [url, setUrl] = useState<string>();
  const [roomName, setRoomName] = useState<string>('');
  const [roomID, setRoomID] = useState<React.Key | null>(null);
  const [pwd, setPwd] = useState<string>('');
  const [identity, setIdentity] = useState<boolean>(true); // true 房主 false 房客
  const identityRef = useRef(identity);
  useEffect(() => {
    identityRef.current = identity;
  }, [identity]);
  const [isConnected, setIsConnected] = useState(false); // 连接状态
  const [isReady, setIsReady] = useState(false); // 自己的准备状态
  const [isAllReady, setIsAllReady] = useState(false); // 是否全员准备就绪
  // 用于通知子组件表格刷新
  const [refreshQueueTrigger, setRefreshQueueTrigger] = useState(0);

  const playerRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // 同步锁：当前是否正在处理服务器传来的同步指令（此时不要触发发送）
  const isRemoteUpdate = useRef(false); //同步锁
  //缓冲状态锁：视频是否是因为缓冲而暂停
  const isBuffering = useRef(false);
  const bufferTimeOut = useRef<NodeJS.Timeout>();
  // 初始化加载本地存储
  useEffect(() => {
    const cachedPwd = localStorage.getItem('roomPwd');
    const cachedRoomName = localStorage.getItem('roomName');

    if (cachedPwd) setPwd(cachedPwd);
    if (cachedRoomName) setRoomName(cachedRoomName);
  }, []);

  // 监听播放器的原生事件
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
      if (bufferTimeOut.current) clearTimeout(bufferTimeOut.current);

      if (isRemoteUpdate.current) return;
      //当前是缓冲状态，则handlewaiting已经广播pause了，直接跳过。
      if (isBuffering.current) return;

      wsRef.current?.send(
        JSON.stringify({
          cmd: 'pause',
          ts: videoEl.currentTime,
          Room_name: roomName,
        }),
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
      if (bufferTimeOut.current) clearTimeout(bufferTimeOut.current);
      if (isRemoteUpdate.current) {
        // 这是一个由服务器命令触发的 seek，重置锁，不发送消息
        isRemoteUpdate.current = false;
        return;
      }

      isBuffering.current = false; // （seeked时）缓冲已经完成

      wsRef.current?.send(
        JSON.stringify({
          cmd: 'seek',
          ts: videoEl.currentTime,
          Room_name: roomName,
        }),
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
      if (isRemoteUpdate.current) return;
      isBuffering.current = true;

      //缓冲如果在一秒内完毕则不发送广播
      bufferTimeOut.current = setTimeout(() => {
        // 发送暂停指令
        wsRef.current?.send(
          JSON.stringify({
            cmd: 'buffer_start',
            ts: videoEl.currentTime,
            Room_name: roomName,
          }),
        );
      }, 500);
    };

    /**
     * 处理播放
     * 事件来源：
     * 1. 用户点击播放按钮
     * 2. 缓冲结束后自动播放
     * 3. 远程指令触发的播放（不应发送广播）：缓冲完成后已经广播一次paly，这里会再广播paly导致循环触发
     *  */
    const handlePlaying = () => {
      //如果是从缓冲恢复播放，清除缓冲的广播定时器
      if (bufferTimeOut.current) clearTimeout(bufferTimeOut.current);
      //拦截远程指令触发的 playing 事件
      console.log(
        '播放监视器触发，远程指令：',
        isRemoteUpdate.current,
        '缓冲状态：',
        isBuffering.current,
      );
      if (isRemoteUpdate.current) return;

      // 缓冲结束(即是缓冲完成触发的播放分支)
      if (isBuffering.current) {
        isBuffering.current = false;

        wsRef.current?.send(
          JSON.stringify({
            cmd: 'buffer_done',
            ts: videoEl.currentTime,
            Room_name: roomName,
          }),
        );
        console.log('我不卡了，发送缓冲完成指令');
        // 暂时本地保持暂停，等后端统一发 play 指令
        // videoEl.pause();
        return;
      }

      //点击触发的播放分支
      wsRef.current?.send(
        JSON.stringify({
          cmd: 'play',
          ts: videoEl.currentTime,
          Room_name: roomName,
        }),
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

  // 发送切换视频指令
  const handleSwitchVideo = useCallback(
    (videoItem: playItem) => {
      if (wsRef.current && isConnected) {
        wsRef.current.send(
          JSON.stringify({
            cmd: 'change_video',
            video: videoItem,
            Room_name: roomName,
          }),
        );

        message.loading('正在同步切换视频...', 1);
      } else {
        // 如果没连接，就只能本地切一下（降级处理）
        const targetUrl = identity ? videoItem.MasterUrl : videoItem.GuestUrl;
        setUrl(targetUrl);
      }
    },
    [isConnected, identity],
  ); // 依赖 identity

  // 核心：WebSocket 连接与消息处理
  const connectWs = useCallback(() => {
    if (!roomName) {
      message.error('请输入房间号');
      return;
    }

    // 避免重复连接
    if (wsRef.current) {
      wsRef.current.close();
    }

    RoomService.joinRoom(roomName, pwd)
      .then((res) => {
        if (res.data.code !== 200) {
          message.error(res.data.message);
          return;
        }
        setRoomID(res.data.data?.Room_id || null);
        const ws = new WebSocket('/ws');

        ws.onopen = () => {
          console.log('WebSocket 连接已打开');
          setIsConnected(true);
          // 连接成功后立即发送加入房间指令
          ws.send(
            JSON.stringify({ cmd: 'join', Room_name: roomName, pwd: pwd }),
          );

          // 缓存到本地
          localStorage.setItem('roomPwd', pwd);
          localStorage.setItem('roomName', roomName);
        };

        ws.onclose = () => {
          console.log('连接已关闭');
          setIsConnected(false);
          setUrl(undefined);
          setIsReady(false);
          setIsAllReady(false);
          wsRef.current = null;
        };

        ws.onerror = (error) => {
          console.error('WebSocket 发生错误:', error);
          message.error('连接服务器失败');
        };

        ws.onmessage = async (ev) => {
          const msg: WsMessage = JSON.parse(ev.data);

          // 获取 video 元素 (video-react 的封装)
          // video-react 的 ref.current.video 是实际的 HTMLVideoElement
          const videoEl = playerRef.current?.video?.video as HTMLVideoElement;

          if (msg.error) {
            message.error(msg.error);
            return;
          }

          switch (msg.cmd) {
            case 'joined':
              message.success(`成功加入房间: ${msg.Room_name}`);
              break;
            case 'play':
              console.log('play:不卡了，服务器发送了play');
              if (videoEl && msg.ts !== undefined) {
                isRemoteUpdate.current = true; //加锁

                // 时间误差修正
                if (
                  msg.ts !== undefined &&
                  Math.abs(videoEl.currentTime - msg.ts) > 0.3
                ) {
                  videoEl.currentTime = msg.ts;
                }

                await videoEl
                  .play()
                  .then(() => {
                    isRemoteUpdate.current = false;
                    console.log('play:播放成功');
                  })
                  .catch(() => {
                    isRemoteUpdate.current = false;
                    console.log('play:失败');
                  });
              }
              break;
            case 'pause':
              if (videoEl) {
                if (isBuffering.current) return;

                isRemoteUpdate.current = true;

                videoEl.pause();

                if (msg.ts !== undefined && msg.ts !== null)
                  videoEl.currentTime = msg.ts;
              }

              if (msg.is_buffering && !isBuffering.current) {
                console.log('我不卡，但我配合大家暂停，并向后端发送就绪报告');
                wsRef.current?.send(
                  JSON.stringify({ cmd: 'buffer_done', Room_name: roomName }),
                );
              }

              // 取消准备，切换视频
              if (!isAllReady) {
                message.info(`取消准备 或者 切换视频，已暂停播放`);
              }

              break;
            case 'seek':
              if (videoEl && msg.ts !== undefined) {
                // 【关键修改 4】加锁！告诉 handleSeeked 这是服务器让改的
                isRemoteUpdate.current = true;
                videoEl.currentTime = msg.ts;
                // 锁会在 handleSeeked 事件触发时被消费并重置
              }
              break;
            case 'queue':
              // 触发 UrlList 刷新
              setRefreshQueueTrigger((prev) => prev + 1);
              break;
            case 'ready_count':
              // 如果 msg.count === 0，说明服务器重置了，可以用来校验本地状态
              if (msg.Count === msg.Total && msg.Total && msg.Total > 0) {
                message.success('全员就绪，准备播放！');
                setIsAllReady(true);
              } else {
                setIsAllReady(false);
                message.info(`当前准备人数: ${msg.Count}/${msg.Total}`);
              }
              break;
            case 'user_leave':
              message.info('有用户离开了房间');
              break;
            // 处理切换视频指令
            case 'change_video':
              if (msg.Video) {
                const targetUrl = identityRef.current
                  ? msg.Video.MasterUrl
                  : msg.Video.GuestUrl;

                // 1. 切换 URL
                setUrl(targetUrl);

                // 2. 所有人强制取消“准备”状态，防止有人误操作直接播放
                setIsReady(false);

                // 3. 提示
                message.info(`当前视频已切换为: ${msg.Video.Title}`);

                // 4. 重置播放器时间 (可选，因为换源后通常也是从0开始)
                if (videoEl) videoEl.currentTime = 0;

                (playerRef.current as PlayerReference).load();
              }
              setIsAllReady(false); // 切视频必定导致未准备
              break;
            case 'error':
              message.error(msg.message || '收到未知错误');
              break;
          }
        };

        wsRef.current = ws;
      })
      .catch(() => {
        message.error('加入房间失败，请检查网络或稍后重试');
        return;
      });

    return () => {
      if (playerRef.current) {
        playerRef.current.pause();
        playerRef.current = null;
      }
    };
  }, [roomName, pwd, message, identity, playerRef, url]);

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
        console.log('发送前');
        wsRef.current.send(
          JSON.stringify({
            cmd: checked ? 'ready' : 'unready',
            Room_name: roomName,
          }),
        );
        console.log('发送后');

        setIsReady(checked);
      } else {
        message.warning('请先加入房间');
      }
    },
    [message, roomName],
  );

  // 播放控制 - 发送端
  const handleSendControl = useCallback((type: 'play' | 'pause') => {
    const videoEl = playerRef.current?.video?.video as HTMLVideoElement;
    if (videoEl && wsRef.current) {
      wsRef.current.send(
        JSON.stringify({
          cmd: type,
          ts: videoEl.currentTime,
          Room_name: roomName,
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
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
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
                <Button
                  danger
                  onClick={() => {
                    wsRef.current?.close();
                    setUrl(undefined);
                  }}
                  block
                >
                  退出房间
                </Button>
              )}
            </Form.Item>
          </Form>

          <div style={{ maxHeight: '400px', overflow: 'auto' }}>
            {isConnected && roomID ? (
              <UrlList
                roomID={roomID}
                refreshTrigger={refreshQueueTrigger}
                onPlayer={handleSwitchVideo}
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

      <Card
        title="同步播放器"
        style={{
          visibility: url === undefined || url === null ? 'hidden' : 'visible',
        }}
      >
        <div style={{ position: 'relative' }}>
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

          <Player ref={playerRef} key="Player">
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
          {/* 只有全员准备好了，才允许点击这些按钮 */}
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
