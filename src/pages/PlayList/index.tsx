import RoomService from '@/services/Room';
import { PageContainer } from '@ant-design/pro-components';
import { Button, Input, InputRef, message, Modal } from 'antd';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import UrlList from './urlList';
const PlayListPage: React.FC = () => {
  const [roomId, setRoomId] = useState<React.Key>();
  const [roomName, setRoomName] = useState<string>();
  const [open, setopen] = useState(true);
  const inputRef = useRef<InputRef>(null);
  const inputPassRef = useRef<InputRef>(null);
  const onOk = useCallback(() => {
    const inputRoomName = inputRef.current?.input?.value;
    const roomPwd = inputPassRef.current?.input?.value;
    if (roomPwd) localStorage.setItem('roomPwd', roomPwd);
    if (inputRoomName) {
      setRoomName(inputRoomName);
      localStorage.setItem('roomName', inputRoomName);
      RoomService.joinRoom(inputRoomName, roomPwd).then((res) => {
        if (res.data.code === 200) {
          message.success('加入房间成功');
          let room_id = res.data.data.Room_id;
          setRoomId(room_id);
          localStorage.setItem('roomId', room_id.toString());
          setopen(false);
        } else {
          message.error(`加入房间失败:${res.data.message}`);
        }
      });
    }
  }, []);
  const onCancel = useCallback(() => {
    setopen(false);
  }, []);
  useEffect(() => {
    const savedRoomId = localStorage.getItem('roomId');
    const savaeRoomName = localStorage.getItem('roomName');

    if (savaeRoomName) setRoomName(savaeRoomName);
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

      {roomId?.toString() && (
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
              房间ID:{roomName}
            </div>
            <Button onClick={() => setopen(true)}>修改</Button>
          </div>
          <UrlList roomID={roomId} />
        </div>
      )}
    </PageContainer>
  );
};
export default PlayListPage;
