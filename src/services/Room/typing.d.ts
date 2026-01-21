interface Rooms {
  Room_id: string;
  room_name: string;
  Password?: string;
  CreatedAt?: string;
  OnLine?: boolean;
  MaxNumber?: number;
  VersionTimestamp?: React.Key;
}

type QueryRoomType = {
  room_name?: string;
  pageIndex?: number;
  pageSize?: number;
};
