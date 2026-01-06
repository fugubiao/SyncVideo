import axios from 'axios';

export default {
  Get: (params: QueryRoomType) => {
    return axios.get<ResponseModel<Rooms>>('/api/RoomsService', {
      params,
    });
  },
  Post: (data: Rooms) => {
    return axios.post<BaseResponseModel<React.Key>>('/api/RoomsService', data);
  },
  delete: (id: React.Key) => {
    return axios.get<BaseResponseModel>(`/api/RoomsService/delect/${id}`);
  },
  update: (data: Rooms) => {
    return axios.post<BaseResponseModel>('/api/RoomsService/update', data);
  },
  joinRoom: (RoomName: string, Password?: string) => {
    return axios.get<BaseResponseModel<Rooms>>(`/api/RoomsService/join`, {
      params: { RoomName, Password },
    });
  },
};
