interface Rooms {
  Room_id: React.Key;
  room_name: string;
  Password?: string;
  CreatedAt?: string;
  Online?: boolean;
  MaxNumber?: number;
  VersionTimestamp?: React.Key;
}

type QueryRoomType = {
  room_name?: string;
  pageIndex?: number;
  pageSize?: number;
};
