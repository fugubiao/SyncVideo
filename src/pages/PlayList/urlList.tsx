import PlayServicer from '@/services/PlayList';
import { PlusOutlined } from '@ant-design/icons';
import {
  ActionType,
  ModalForm,
  ProColumns,
  ProFormInstance,
  ProFormText,
  ProTable,
} from '@ant-design/pro-components';
import { Button, message, Popconfirm, Tag } from 'antd';
import React, { useCallback, useEffect, useRef, useState } from 'react';

const UrlList: React.FC<{
  roomID: React.Key;
  onPlayer?: (video: playItem) => void;
  refreshTrigger?: number;
}> = ({ roomID, onPlayer, refreshTrigger }) => {
  const [open, setOpen] = useState(false);
  const formRef = useRef<ProFormInstance<playItem>>();
  const actionRef = useRef<ActionType>();
  const [currenMaxPriority, setPriority] = useState(0);
  const [isUpdate, setIsUpdate] = useState<boolean>(false);

  // 【新增】监听 refreshTrigger 变化，自动刷新表格
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      actionRef.current?.reload();
    }
  }, [refreshTrigger]);

  const columns: ProColumns<playItem>[] = [
    {
      title: '视频标题',
      dataIndex: 'Title',
      key: 'Title',
    },
    {
      title: '播放优先级',
      dataIndex: 'PlayPriority',
      key: 'PlayPriority',
      search: false,
    },
    {
      title: '房主视频地址',
      copyable: true,
      dataIndex: 'MasterUrl',
      key: 'MasterUrl',
      ellipsis: true,
      search: false,
    },
    {
      title: '房客视频地址',
      copyable: true,
      dataIndex: 'GuestUrl',
      key: 'GuestUrl',
      ellipsis: true,
      search: false,
    },
    {
      title: '视频大小(MB)',
      dataIndex: 'Size',
      key: 'Size',
      search: false,
    },
    {
      title: '状态',
      dataIndex: 'IsPlayying',
      key: 'IsPlayying',
      search: false,
      render: (_, record) =>
        record.IsPlayying ? (
          <Tag color="green">正在播放</Tag>
        ) : (
          <Tag color="volcano">未播放</Tag>
        ),
    },
    {
      title: '操作',
      dataIndex: 'option',
      width: 120,
      key: 'option',
      search: false,
      render: (_, record) => (
        <div style={{ display: 'flex', justifyContent: 'space-around' }}>
          {onPlayer && (
            <a
              key="play"
              onClick={async () => {
                onPlayer(record);
              }}
            >
              播放
            </a>
          )}
          <Popconfirm
            title="确定要删除吗？"
            onConfirm={() => {
              console.log('删除记录', record.Id);
              PlayServicer.delete(record.Id).then(() => {
                actionRef.current?.reload();
              });
            }}
            okText="是"
            cancelText="否"
          >
            <a key="delete">删除</a>
          </Popconfirm>

          <a
            key="update"
            onClick={() => {
              setOpen(true);
              setIsUpdate(true);
              // 强制回填表单数据
              // setTimeout(() => formRef.current?.setFieldsValue(record), 0);
              formRef.current?.setFieldsValue(record);
              console.log('强制回填表单数据', record);
              actionRef.current?.reload();
            }}
          >
            修改
          </a>
        </div>
      ),
    },
  ];

  const addVideo = useCallback(() => {
    setOpen(true);
    setIsUpdate(false);
  }, []);

  return (
    <>
      <ProTable<playItem>
        columns={columns}
        actionRef={actionRef}
        toolBarRender={() => {
          return [
            <Button
              icon={<PlusOutlined />}
              key="addvideo"
              type="primary"
              onClick={addVideo}
            >
              添加视频
            </Button>,
          ];
        }}
        request={async (params) => {
          const { current, pageSize, Title } = params;
          const getParam: QueryPlayListType = {
            pageIndex: current,
            pageSize,
            title: Title,
            RoomId: roomID,
          };

          const res = await PlayServicer.get(getParam);

          if (res.data.code === 200) {
            if (res.data.list && res.data.list.length > 0) {
              const maxPriority = Math.max(
                ...res.data.list.map(
                  (item: playItem) => item.PlayPriority || 0,
                ),
              );
              setPriority(maxPriority);
            }

            return {
              data: res.data.list,
              total: res.data.total,
            };
          }

          message.error(res.data.message);
          return {};
        }}
        rowKey="id"
        dateFormatter="string"
      ></ProTable>

      <ModalForm<playItem>
        title={isUpdate ? '修改视频' : '添加视频'}
        open={open}
        formRef={formRef}
        onOpenChange={(visible) => {
          setOpen(visible);
          if (!visible) {
            formRef.current?.resetFields();
          }
        }}
        onFinish={async (value) => {
          const newvalue: playItem = {
            ...value,
            ...(isUpdate ? {} : { PlayPriority: currenMaxPriority + 1 }),
            IsPlayying: false,
            Room_id: roomID,
          };

          const res = isUpdate
            ? await PlayServicer.update(newvalue)
            : await PlayServicer.post(newvalue);
          if (res.data.code === 200) {
            message.success(res.data.message);

            // 关闭弹窗并刷新列表
            setOpen(false);
            setTimeout(() => {
              actionRef.current?.reload();
            }, 0);
            return true;
          }
          message.error(res.data.message);
          return false;
        }}
      >
        <ProFormText
          label="视频标题"
          name="Title"
          transform={(value: string) => value.trim()}
        />
        <ProFormText
          label="房主视频URL"
          name="MasterUrl"
          transform={(value: string) => value.trim()}
        />
        <ProFormText
          label="房客视频URL"
          name="GuestUrl"
          transform={(value: string) => value.trim()}
        />
        <ProFormText
          label="视频大小"
          name="Size"
          transform={(value) => Number(value)}
        />

        <ProFormText name="Id" hidden />
        <ProFormText name="VersionTimestamp" hidden />
        <ProFormText name="PlayPriority" hidden />
        <ProFormText name="Room_id" hidden />
      </ModalForm>
    </>
  );
};

export default UrlList;
