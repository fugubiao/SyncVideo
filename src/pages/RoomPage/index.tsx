import RoomService from '@/services/Room';
import { PlusOutlined } from '@ant-design/icons';
import {
  ActionType,
  ModalForm,
  PageContainer,
  ProColumns,
  ProFormItem,
  ProFormText,
  ProTable,
} from '@ant-design/pro-components';
import { Button, InputNumber, message, Popconfirm, Tag } from 'antd';
import { FormInstance } from 'antd/lib';
import { useCallback, useRef, useState } from 'react';

const RoomPage: React.FC = () => {
  const formRef = useRef<FormInstance>();
  const actionRef = useRef<ActionType>();
  const [open, setopen] = useState<boolean>(false);
  const [isUpdate, setIsUpdate] = useState<boolean>(false);

  const Create = useCallback(() => {
    setIsUpdate(false);
    setopen(true);
  }, []);
  const colunms: ProColumns<Rooms>[] = [
    {
      title: '房间号',
      dataIndex: 'Room_name',
      key: 'room_name',
    },
    {
      title: '创建时间',
      dataIndex: 'CreatedAt',
      key: 'CreatedAt',
      render: (_, record) =>
        record.CreatedAt !== undefined
          ? new Date(record.CreatedAt).toLocaleString()
          : record.CreatedAt,
    },
    {
      title: '最大在线人数',
      dataIndex: 'MaxNumber',
      key: 'MaxNumber',
    },
    {
      title: '活动',
      dataIndex: 'Online',
      key: 'Online',
      render: (_, record) =>
        record.Online ? (
          <Tag color="green">在线</Tag>
        ) : (
          <Tag color="volcano">离线</Tag>
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
          <Popconfirm
            title="确定要删除吗？"
            onConfirm={() => {
              console.log('record,', record);
              RoomService.delete(record.Room_id).then(() => {
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
              setopen(true);
              setIsUpdate(true);
              // 强制回填表单数据
              setTimeout(() => formRef.current?.setFieldsValue(record), 0);
              actionRef.current?.reload();
            }}
          >
            修改
          </a>
        </div>
      ),
    },
  ];

  return (
    <PageContainer>
      <ProTable
        rowKey="Room_id"
        key="RoomPage"
        actionRef={actionRef}
        columns={colunms}
        toolBarRender={() => [
          <Button
            key="create"
            onClick={Create}
            icon={<PlusOutlined />}
            type="primary"
          >
            新建
          </Button>,
        ]}
        request={async (params) => {
          const { pageSize, current, room_name } = params;
          const Params: QueryRoomType = {
            pageSize,
            pageIndex: current,
            room_name,
          };
          const res = await RoomService.Get(Params);
          if (res.data.code !== 200) {
            message.error(res.data.message);
            return {};
          }

          return {
            data: res.data.list,
            total: res.data.total,
          };
        }}
      ></ProTable>

      <ModalForm<Rooms>
        title={isUpdate ? '修改房间' : '创建房间'}
        open={open}
        formRef={formRef}
        // 控制弹窗关闭
        onOpenChange={setopen}
        // 提交逻辑
        onFinish={async (room) => {
          console.log('提交', room);
          const res = isUpdate
            ? await RoomService.update(room)
            : await RoomService.Post(room);
          if (res.data.code === 200) {
            message.success(res.data.message ?? '操作成功');
            actionRef.current?.reload();
            formRef.current?.resetFields();
            return true; // 返回 true 会自动关闭弹窗
          }
          message.error(res.data.message ?? '操作失败');
          return false; // 返回 false 弹窗保持打开
        }}
      >
        {/* 之前的隐藏字段 */}
        <ProFormText name="Room_id" hidden />
        <ProFormText name="VersionTimestamp" hidden />

        <ProFormText
          name="Room_name"
          label="房间号"
          rules={[{ required: true, message: '请输入房间号' }]} // 建议加上校验
        />
        <ProFormText name="Password" label="密码" />

        <ProFormItem name="MaxNumber" label="最大在线人数">
          <InputNumber max={5} min={1} style={{ width: '100%' }} />
        </ProFormItem>
      </ModalForm>
    </PageContainer>
  );
};

export default RoomPage;
