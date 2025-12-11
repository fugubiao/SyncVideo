import { PageContainer } from '@ant-design/pro-components';
import { Button, Input, InputRef, Modal } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import UrlList from './urlList';

const PlayListPage: React.FC = () => {
  const [roomId, setRoomId] = useState<string>();
  const [open, setopen] = useState(true);
  const inputRef = useRef<InputRef>(null);
  const inputPassRef = useRef<InputRef>(null);
  const onOk = useCallback(() => {
    const roomId = inputRef.current?.input?.value;
    const roomPwd = inputPassRef.current?.input?.value;
    if (roomPwd) localStorage.setItem('roomPwd', roomPwd);
    if (roomId) {
      setRoomId(roomId);
      localStorage.setItem('roomId', roomId);
    }
    setopen(false);
  }, []);
  const onCancel = useCallback(() => {
    setopen(false);
  }, []);
  useEffect(() => {
    const savedRoomId = localStorage.getItem('roomId');
    if (savedRoomId) {
      setRoomId(savedRoomId);
      setopen(false);
    } else setopen(true);
  }, []);
  return (
    <PageContainer>
      <Modal open={open} onOk={onOk} title="请输入房间ID" onCancel={onCancel}>
        <div
          style={{
            display: 'grid',
            width: '300px',
            gridTemplateColumns: '30% 70%',
          }}
        >
          <span>房间ID:</span>
          <Input ref={inputRef} type="text" title="请输入房间号" />
        </div>
        <div
          style={{
            display: 'grid',
            width: '300px',
            gridTemplateColumns: '30% 70%',
          }}
        >
          <span>房间密码（可选）:</span>
          <Input ref={inputPassRef} type="text" title="请输入房间密码" />
        </div>
      </Modal>

      {roomId && (
        <div>
          <div
            style={{
              width: '200px',
              display: 'grid',
              gridTemplateColumns: '45% 40%',
              marginLeft: '20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center' }}>
              房间ID:{roomId}
            </div>
            <Button onClick={() => setopen(true)}>修改</Button>
          </div>
          <UrlList roomId={roomId} />
        </div>
      )}
    </PageContainer>
  );
};
export default PlayListPage;
