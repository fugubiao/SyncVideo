#!/usr/bin/env python3
import uvicorn
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import List, Optional
import uuid
import json
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import time

# ====== 内存数据库 ======
rooms = {}          # {room_id: Room}
client_room = {}    # {ws: room_id}

class Room:
    def __init__(self, pwd: str):
        self.pwd = pwd
        self.clients = set() # Set[WebSocket]
        self.queue = []               # List[dict]
        self.ready_set = set() # 已准备的客户端集合
        self.playing = False   # 播放状态
        self.current_ts = 0.0   # 当前时间戳
        self.last_update_sys_time = 0.0 # 记录最后一次操作的系统时间

class VideoItem(BaseModel):
    id: Optional[str] = None          # 新增时不传；修改时必传
    masterUrl: str                     # 主人（本地）url
    guestUrl: str                      # 客人（隧道）url
    title: Optional[str] = None
    PlayPriority: Optional[int] = None
    isPlaying: Optional[bool] = False  # 是否正在播放
    size: Optional[str] = None

# ====== HTTP 接口（CRUD 独立） ======
app = FastAPI(title="SyncPlay-FastAPI")

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class UnifiedResponse(BaseModel):
    code: int
    data: Optional[dict] = None
    message: Optional[str] = None

def success(data: Optional[dict] = None):
    # 注意：data 可能是 list 也可能是 dict，这里为了通用，UnifiedResponse 定义需灵活或直接返回 dict
    return JSONResponse(content={"code": 0, "data": data, "message": None})

def fail(code: int = 400, message: str = "error"):
    return JSONResponse(content={"code": code, "data": None, "message": message}, status_code=code)

# 屏蔽 Umi/Starlette 默认 HTML
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request, exc):
    return fail(exc.status_code, exc.detail)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    return fail(400, "参数错误")


# ====== 广播函数 (已修复) ======
async def broadcast(room_id: str, msg: dict):
    if room_id in rooms:
        room = rooms[room_id]
        dead = set()
        # 复制一份进行遍历，防止在 await 期间集合发生变化
        for ws in list(room.clients):
            try:
                await ws.send_json(msg)
            except Exception as e:
                # print(f"发送失败: {e}")
                dead.add(ws)
        room.clients -= dead


## 1. 查询整条队列
@app.get("/room/{room_id}/queue")
def get_queue(room_id: str):
    if room_id not in rooms: return success([])
    # room.queue 已经是 dict 列表了，直接返回即可，或者重新序列化
    return success(rooms[room_id].queue)

## 2. 新增或修改（带 id 就是修改）
# 【修改点1】这里必须改成 async def
@app.post("/room/{room_id}/queue")
async def upsert_queue(room_id: str, item: VideoItem):
    if room_id not in rooms: return fail(404, "房间不存在")
    room = rooms[room_id]
    
    result = None
    found = False
    if item.id:
        for idx, it in enumerate(room.queue):
            if it["id"] == item.id:
                room.queue[idx] = item.dict()
                result = item.dict()
                found = True
                break
    
    if not found:
        new_item = item.dict()
        if not new_item.get("id"):
            new_item["id"] = str(uuid.uuid4())
        room.queue.append(new_item)
        result = new_item

    # 【修改点2】既然已经是 async 函数，直接 await 广播即可，不需要 create_task
    # 如果一定要用 create_task，也可以，但 async def 是必须的
    await broadcast(room_id, {"cmd": "queue", "list": room.queue})
    
    return success(result)

## 3. 删除
# 【修改点3】这里也必须改成 async def
@app.delete("/room/{room_id}/queue/{item_id}")
async def delete_queue(room_id: str, item_id: str):
    if room_id not in rooms: return fail(404, "房间不存在")
    room = rooms[room_id]
    original_len = len(room.queue)
    room.queue = [it for it in room.queue if it["id"] != item_id]
    
    if len(room.queue) != original_len:
        # 【修改点4】改为 await
        await broadcast(room_id, {"cmd": "queue", "list": room.queue})
        
    return success({"deleted": item_id})
# ====== WebSocket 入口（仅广播 + 同步） ======
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    room_id = None
    try:
        while True:
            data = json.loads(await ws.receive_text())
            cmd = data.get("cmd")
            
            # ---------- 加入房间 ----------
            if cmd == "join":
                # ... (保持不变) ...
                room_id = data["room_id"]
                pwd = data.get("pwd", "")
                if room_id not in rooms: rooms[room_id] = Room(pwd)
                room = rooms[room_id]
                if room.pwd != pwd:
                    await ws.send_json({"error": "wrong pwd"})
                    continue
                room.clients.add(ws)
                client_room[ws] = room_id
                
                real_ts = room.current_ts
                if room.playing:
                    # 如果正在播放，当前进度 = 记录的进度 + (当前系统时间 - 上次更新系统时间)
                    real_ts += (time.time() - room.last_update_sys_time)

                # 发送当前状态
                await ws.send_json({
                    "cmd": "joined", 
                    "room_id": room_id, 
                    "queue": room.queue, 
                    "playing": room.playing, 
                    "ts": room.real_ts
                })

            # ---------- 准备确认 ----------
            elif cmd == "ready":
                if ws in client_room:
                    room_id = client_room[ws]
                    room = rooms[room_id]
                    room.ready_set.add(ws)
                    await broadcast(room_id, {"cmd": "ready_count", "count": len(room.ready_set), "total": len(room.clients)})
                    
                    if len(room.ready_set) == len(room.clients) and len(room.clients) >= 1:
                        room.playing = True
                        await broadcast(room_id, {"cmd": "play", "ts": room.current_ts}) 
            #---------- 取消准备 ----------
            elif cmd == "unready":
                if ws in client_room:
                    room_id = client_room[ws]
                    room = rooms[room_id]
                    room.ready_set.discard(ws)
                    # 1. 广播新的准备人数
                    await broadcast(room_id, {"cmd": "ready_count", "count": len(room.ready_set), "total": len(room.clients)})
                    
                    # 2. 【新增】如果当前正在播放，有人取消准备，必须暂停！
                    if room.playing:
                        room.playing = False
                        # 广播暂停，保留当前进度
                        await broadcast(room_id, {"cmd": "pause", "ts": room.current_ts})

            # ---------- 播放控制 (修复 Bug 2: 播放/暂停重置为0) ----------
            elif cmd in ("play", "pause", "seek"):
                if ws in client_room:
                    room_id = client_room[ws]
                    room = rooms[room_id]
                    room.playing = (cmd == "play")
                    
                    # 【修复点】：无论 Play/Pause/Seek，只要前端传了 ts，都更新服务器时间
                    if "ts" in data:
                        room.current_ts = float(data["ts"])
                    
                    # 关键：更新系统时间锚点
                    room.last_update_sys_time = time.time()
                    await broadcast(room_id, {"cmd": cmd, "ts": room.current_ts})

            # ---------- 切换视频 (修复 Bug 1: 准备状态未重置) ----------
            elif cmd == "change_video":
                if ws in client_room:
                    room_id = client_room[ws]
                    room = rooms[room_id]
                    
                    target_video = data.get("video")
                    target_id = target_video.get("id") if target_video else None
                    # 1. 重置播放状态
                    room.playing = False
                    room.current_ts = 0.0
                    
                    # 【修复点】：强制清空所有人的准备状态
                    room.ready_set.clear()
                    
                   # 2. 【新增】更新内存队列中 VideoItem 的 isPlaying 状态
                    if target_id:
                        for item in room.queue:
                            if item.get("id") == target_id:
                                item["isPlaying"] = True
                            else:
                                item["isPlaying"] = False
                    
                    # 3. 广播切换视频指令
                    await broadcast(room_id, {
                        "cmd": "change_video", 
                        "video": target_video
                    })
                    
                    # 4. 【新增】广播最新的队列 (让前端表格更新绿色Tag)
                    await broadcast(room_id, {
                        "cmd": "queue", 
                        "list": room.queue
                    })
                    
                    # 5. 广播准备人数归零
                    await broadcast(room_id, {"cmd": "ready_count", "count": 0, "total": len(room.clients)})
    except WebSocketDisconnect:
        # print("Client disconnected")
        room_id = client_room.pop(ws, None)
        if room_id and room_id in rooms:
            room = rooms[room_id]
            room.clients.discard(ws)
            room.ready_set.discard(ws)
            if not room.clients:
                # 房间没人了，可以选择删除房间或保留
                # del rooms[room_id] 
                pass
            else:
                await broadcast(room_id, {"cmd": "user_leave", "count": len(room.clients)})
        

if __name__ == "__main__":
    uvicorn.run('main:app', host="0.0.0.0", port=55061, reload=True)