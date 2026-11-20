import axios from 'axios'

// 唯一 HTTP 出口（docs/frontend/08 §1）
const request = axios.create({
  timeout: 10000,
})

export default request
