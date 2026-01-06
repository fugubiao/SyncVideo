/**播放列表 */
type playItem = {
  Id: React.Key;
  /**
   * 房主url
   */
  MasterUrl: string;
  /**
   * 房客url
   */
  GuestUrl: string;
  /**
   * 视频大小
   */
  Size?: number;
  /**
   * 标题
   */
  Title?: string;
  /**
   * 播放优先级
   */
  PlayPriority?: number;
  /**
   * 是否正在播放
   */
  IsPlayying?: boolean;
  /**
   * （最后一次修改）版本时间戳（秒）
   */
  VersionTimestamp: React.Key;

  /**
   * 房间id
   */
  room_id: React.Key;
};

type QueryPlayListType = {
  title?: string;
  pageIndex?: number;
  pageSize?: number;
};
