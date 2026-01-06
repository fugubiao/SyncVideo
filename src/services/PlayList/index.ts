import axios from 'axios';
export default {
  get: (params: QueryPlayListType) => {
    return axios.get<ResponseModel<playItem>>('/api/PlayVideoService', {
      params,
    });
  },
  post: (data: playItem) => {
    return axios.post<BaseResponseModel>('/api/PlayVideoService', data);
  },
  delete: (id: React.Key) => {
    console.log('删除id', id);
    return axios.get<BaseResponseModel>(`/api/PlayVideoService/delect/${id}`);
  },
  update: (data: playItem) => {
    return axios.post<BaseResponseModel>('/api/PlayVideoService/update', data);
  },
};
