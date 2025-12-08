import { ActionType, ModalForm, ProColumns, ProFormInstance, ProFormText, ProTable } from "@ant-design/pro-components";
import { PlusOutlined } from '@ant-design/icons';
import { Button, Tag, message ,Popconfirm } from "antd";
import {  useEffect, useRef, useState } from "react";
import axios from "axios";


const UrlList: React.FC<{ roomId: string | number, onPlayer?: (video: playItem) => void ,refreshTrigger?: number}> = ({ roomId, onPlayer,refreshTrigger }) => {
    const [open, setOpen] = useState(false);
    const [modalTitle, setModalTitle] = useState("添加视频");
    const formRef = useRef<ProFormInstance>();
    const actionRef = useRef<ActionType>();
    const [currenMaxPriority, setPriority] = useState(0);
    const [currentrow, setCurrentrow] = useState<playItem>();


    // 【新增】监听 refreshTrigger 变化，自动刷新表格
    useEffect(() => {
        if (refreshTrigger && refreshTrigger > 0) {
            actionRef.current?.reload();
        }
    }, [refreshTrigger]);

    const columns: ProColumns<playItem>[] = [
        {
            title: '视频标题',
            dataIndex: 'title',
            key: 'title',
            search: false,
        }, {
            title: '播放优先级',
            dataIndex: 'PlayPriority',
            key: 'PlayPriority',
            search: false,
        }, {
            title: '房主视频地址',
            dataIndex: 'masterUrl',
            key: 'masterUrl',
            ellipsis: true,
            search: false,
        }, {
            title: '房客视频地址',
            dataIndex: 'guestUrl',
            key: 'guestUrl',
            ellipsis: true,
            search: false,
        }, {
            title: '视频大小',
            dataIndex: 'size',
            key: 'size',
            search: false,
        }, {
            title: '状态',
            dataIndex: 'isPlaying',
            key: 'isPlaying',
            search: false,
            render: (_, record) => record.isPlaying ? <Tag color='green'>正在播放</Tag> : <Tag color='volcano'>未播放</Tag>
        }, 
        {
            title: '操作',
            dataIndex: 'option',
            key: 'option',
            search: false,
            render: (_, record) => <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                {onPlayer && <a key="play" onClick={async () => {
                    onPlayer(record);
                    // await axios.post(`/api/room/${roomId}/queue`, {...record,isPlaying:true});
                }}>播放</a>}
                <Popconfirm
                    title="确定要删除吗？"
                    onConfirm={() => {
                        axios.delete(`/api/room/${roomId}/queue/${record.id}`).then(() => {
                            actionRef.current?.reload();
                        });
                    }}
                    okText="是"
                    cancelText="否"
                >
                    <a key="delete">删除</a>
                </Popconfirm>

                <a key="update" onClick={() => {
                    setCurrentrow(record); // 记录当前行数据，供 onFinish 使用
                    setModalTitle("修改视频");
                    setOpen(true);
                    // 强制回填表单数据
                    setTimeout(() => formRef.current?.setFieldsValue(record), 0);
                    actionRef.current?.reload();
                }}>修改</a>


            </div>
        }
    ]

    return <><ProTable
        columns={columns}
        actionRef={actionRef}
        toolBarRender={() => {

            return [<Button icon={<PlusOutlined />}  key="addvideo" type="primary" onClick={() => {
                setOpen(true);
                setModalTitle("添加视频");
            }}>添加视频</Button>]
        }}
        request={async () => {
            // 获取列表
            const res = (await axios.get(`/api/room/${roomId}/queue`)).data;
            if (res.data && res.data.length > 0) {
                const maxPriority = Math.max(...res.data.map((item: playItem) => item.PlayPriority || 0));
                setPriority(maxPriority);
            }
            return {
                data: res.data,
                total: res.data.length,
                success: true,
            }

        }}
        rowKey="id"
        search={false}
        // search={false}
        pagination={false}
        dateFormatter="string"
    // headerTitle="播放列表"
    >

    </ProTable>
        <ModalForm
            title={modalTitle}
            open={open}
            formRef={formRef}

            onOpenChange={(visible) => {
                setOpen(visible);
                if (!visible) {
                    setCurrentrow(undefined); // 关闭时清空当前选中项
                    formRef.current?.resetFields();
                }
            }}
            onFinish={async (value) => {
                // 【关键修复 1】：如果是修改模式 (currentrow 存在)，必须带上 id
                // 【关键修复 2】：如果是修改模式，保持原有的优先级；如果是新增，才 +1
                const isUpdate = !!currentrow?.id;

                const newvalue = {
                    ...value,
                    id: isUpdate ? currentrow.id : undefined, // 核心修复：带上ID
                    PlayPriority: isUpdate ? currentrow.PlayPriority : (currenMaxPriority + 1),
                    isPlaying: false
                };

                console.log(isUpdate ? '修改视频' : '添加视频', newvalue);

                try {
                    await axios.post(`/api/room/${roomId}/queue`, newvalue);
                    message.success("操作成功");
                    // 提交成功后关闭弹窗并刷新列表
                    setOpen(false);
                    actionRef.current?.reload(); // 假设你定义了 actionRef 用于表格刷新
                    return true;
                } catch (error) {
                    console.error(error);
                    return false;
                }
            }}
        >


            <ProFormText label="视频标题" name="title" transform={(value: string) => value.trim()} />
            <ProFormText label="房主视频URL" name="masterUrl" transform={(value: string) => value.trim()} />
            <ProFormText label="房客视频URL" name="guestUrl" transform={(value: string) => value.trim()} />
            <ProFormText label="视频大小" name="size" transform={(value: string) => value.trim()} />

        </ModalForm>
    </>

}

export default UrlList;