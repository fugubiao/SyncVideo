import React, { useEffect, useRef, useState } from 'react';
import './index.less';

const FloatingDiv: React.FC<{
  content: React.ReactNode;
  onClick?: () => void;
  refWidth?: number;
  refHeight?: number;
}> = ({ content, onClick, refWidth, refHeight }) => {
  const [position, setPosition] = useState({ x: 0, y: 0 }); // 位置
  const [velocity, setVelocity] = useState({ x: 1, y: 1 }); // 初始速度
  const [size] = useState({ width: 250, height: 180 }); // div大小
  const floatRef = useRef<HTMLDivElement>(null);
  const viewWidth = refWidth ?? window.innerWidth - 200;
  const viewHeight = refHeight ?? window.innerHeight;
  const interval = useRef<NodeJS.Timeout | null>(null);

  const floating = () => {
    let newX = position.x + velocity.x;
    let newY = position.y + velocity.y;

    // 碰撞检测与反弹逻辑
    if (newX + size.width > viewWidth || newX < 0) {
      // 右上角和左上角超出视口
      setVelocity({ ...velocity, x: -velocity.x }); // 水平方向反弹
    }
    if (newY + size.height > viewHeight || newY < 0) {
      // 右下角和左下角超出视口
      setVelocity({ ...velocity, y: -velocity.y }); // 垂直方向反弹
    }

    setPosition({ x: newX, y: newY });
  };

  useEffect(() => {
    const mouseOver = () => {
      if (interval.current) {
        clearInterval(interval.current);
        interval.current = null;
      }
    };

    const mouseOut = () => {
      if (!interval.current) {
        interval.current = setInterval(floating, 10);
      }
    };

    if (floatRef.current) {
      floatRef.current.addEventListener('mouseover', mouseOver);
      floatRef.current.addEventListener('mouseout', mouseOut);
      floatRef.current.addEventListener('click', mouseOut);
    }

    return () => {
      if (interval.current) clearInterval(interval.current);
      if (floatRef.current) {
        floatRef.current.removeEventListener('mouseover', mouseOver);
        floatRef.current.removeEventListener('mouseout', mouseOut);
        floatRef.current.removeEventListener('click', mouseOut);
      }
    };
  }, [position, velocity, size, viewWidth, viewHeight]);

  useEffect(() => {
    interval.current = setInterval(floating, 10); // 每10毫秒更新一次位置

    return () => clearInterval(interval.current!); // 清除定时器
  }, [position, velocity, size, viewWidth, viewHeight]);

  return (
    <div
      ref={floatRef}
      className="floating-div"
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
      }}
    >
      <div className="close" onClick={onClick}>
        ×
      </div>
      <div style={{ clear: 'both', padding: '0px 20px' }}>
        <div className="header"></div>
      </div>

      <div className="box">{content}</div>
    </div>
  );
};

export default FloatingDiv;
