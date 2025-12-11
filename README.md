
# SyncVideo

# 与你的朋友一起同步看视频，前提是至少准备两个隧道用于请求网络资源。



# 和你的朋友一起同步观看视频
## 一、前提：
- **两个http隧道** : 部署此项目者准备字段
- **dufs小型文件服务器**:https://github.com/sigoden/dufs/releases
- **python** : 至少python 3.8的版本，用于启动后端程序
## 二、准备环境
#### python
```
pip install fastapi "uvicorn[standard]" pydantic
```

建议版本:
- fastapi>=0.95.0

- uvicorn[standard]>=0.22.0

- pydantic>=1.10.0

### 项目打包

```
yarn install
yarn build
```

## 三、项目部署
**1.部署文件服务器**

将下载的```dufs.exe```放入需要视频同一个文件夹，在命令行窗口启动文件服务器，指定同隧道约定的本地端口：
```
dufs --bind 0.0.0.0 --port 8081
```
**2.部署syncVideo**
  UP主将项目部署在WSL中。在Linux 中安装好NGINX,配置文件默认在etc/nginx在etc/nginx/conf.d 下新建一个```.conf```的配置文件，例如```yourconfig.conf``` 核心配置如下：
  ```
  server {
    listen 你的端口;
    server_name localhost;
    root /var/***; # 确保这是你 yarn build 后的 dist 目录路径
    index index.html;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src * data:; media-src *; connect-src *;";
    location / {
        try_files $uri $uri/ /index.html;
    }
    location /api/ {
        rewrite ^/api/(.*)$ /$1 break;
        proxy_pass http://127.0.0.1:55061;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
        location /ws {
        proxy_pass http://127.0.0.1:55061;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;}
  }
```
其中```proxy_http```中指定的55061是后端程序接口，可以在```main.py```文件中修改。

写完nginx配置可重新读取配置:
```language
nginx -s reload 
```
或者重启nginx
```language
sudo systemctl restart nginx
```

**3.启动python服务**
  确保python已经配置好环境，执行：
  ```language
  python main.py
```

确定好前后端服务均已启动，开启隧道
![image.png](https://raw.githubusercontent.com/bucketio/img7/main/2025/12/11/1765421656574-22f44845-b9fa-4c45-bde5-ec07f2e83b10.png 'image.png')

朋友即可通过隧道访问该项目和服务器视频文件资源。


